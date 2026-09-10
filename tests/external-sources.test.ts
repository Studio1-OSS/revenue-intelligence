import { beforeAll, afterAll, test, expect } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveWorkspace, snapshot } from "../lib/db";
import { decryptKey } from "../lib/crypto";
import {
  connectExternal,
  disconnectExternal,
  externalStatus,
  syncExternal,
} from "../lib/integrations/external";
import {
  fetchSourcePage,
  sourceConfig,
  type SourceConfig,
} from "../lib/integrations/external-providers";
import type { WorkspaceContext } from "../lib/types";

let db: Client,
  directory: string,
  serial = 0;
const previousSecret = process.env.KEY_ENCRYPTION_SECRET;
const github: SourceConfig = {
  provider: "github",
  repository: "example/customer-feedback",
  company: "Test customer",
  domain: "customer.example",
  label: "customer-test",
};
const airtable: SourceConfig = {
  provider: "airtable",
  baseId: "app12345678901234",
  tableId: "tbl12345678901234",
};
const body = "We cannot renew until exports work reliably for the entire team.";
const issue = (number = 1, text = body) => ({
  number,
  title: "Export reliability",
  body: text,
  state: "open",
  html_url: "https://attacker.example/do-not-fetch",
});
const record = (suffix = "1") => ({
  id: `rec1234567890123${suffix}`,
  fields: {
    Company: "Customer",
    "Company domain": "customer.example",
    Feedback: body,
    Title: "Renewal discussion",
    Email: "do-not-import@example.com",
    Attachments: [{ url: "http://localhost/private" }],
  },
});
const transport = (payload: unknown, status = 200) =>
  (async () => Response.json(payload, { status })) as unknown as typeof fetch;
async function workspace() {
  return resolveWorkspace({ sub: `auth0|external-${++serial}` }, null, db);
}
async function connected(
  ctx: WorkspaceContext,
  config: SourceConfig = github,
  token = "",
  fetcher = transport([issue()]),
) {
  return (await connectExternal(ctx, { config, token }, db, fetcher))
    .connections[0].id;
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "external-source-tests-"));
  db = createClient({ url: `file:${join(directory, "test.db")}` });
  process.env.KEY_ENCRYPTION_SECRET = "be".repeat(32);
  for (const file of [
    "001_initial.sql",
    "002_health_triggers.sql",
    "003_qwen_embeddings.sql",
    "005_external_sources.sql",
  ])
    await db.executeMultiple(
      await readFile(
        new URL(`../db/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
});
afterAll(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
  if (previousSecret === undefined) delete process.env.KEY_ENCRYPTION_SECRET;
  else process.env.KEY_ENCRYPTION_SECRET = previousSecret;
});

test("only workspace owners can connect, sync, or disconnect sources", async () => {
  const owner = await workspace(),
    member = { ...owner, role: "member" as const };
  await expect(connected(member)).rejects.toMatchObject({
    code: "OWNER_REQUIRED",
  });
  const id = await connected(owner);
  await expect(syncExternal(member, id, db)).rejects.toMatchObject({
    code: "OWNER_REQUIRED",
  });
  await expect(disconnectExternal(member, id, db)).rejects.toMatchObject({
    code: "OWNER_REQUIRED",
  });
});
test("configuration blocks arbitrary URLs, traversal, and unsupported providers", () => {
  for (const repository of [
    "https://evil.example/repo",
    "../private",
    "example/../secret",
    "example/repo?x=y",
    "example/repo#fragment",
  ])
    expect(sourceConfig.safeParse({ ...github, repository }).success).toBe(
      false,
    );
  expect(
    sourceConfig.safeParse({ ...airtable, baseId: "https://evil.example" })
      .success,
  ).toBe(false);
  expect(sourceConfig.safeParse({ provider: "slack" }).success).toBe(false);
});
test("public GitHub reads use no token, fixed origin, explicit label and state, and no redirects", async () => {
  let calls = 0;
  const result = await fetchSourcePage(github, "", null, (async (url, init) => {
    calls++;
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe("https://api.github.com");
    expect(parsed.pathname).toBe("/repos/example/customer-feedback/issues");
    expect(parsed.searchParams.get("labels")).toBe("customer-test");
    expect(parsed.searchParams.get("state")).toBe("all");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    return Response.json([
      issue(),
      { ...issue(2), pull_request: { url: "https://evil.example" } },
    ]);
  }) as typeof fetch);
  expect(calls).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.items).toHaveLength(1);
  expect(result.items[0].url).toBe(
    "https://github.com/example/customer-feedback/issues/1",
  );
  expect(result.items[0].document.domain).toBe("customer.example");
});
test("private source tokens are encrypted, workspace-bound, and absent from status", async () => {
  const ctx = await workspace(),
    other = await workspace(),
    token = "private-test-token";
  const id = await connected(ctx, github, token, (async (_, init) => {
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      `Bearer ${token}`,
    );
    return Response.json([issue()]);
  }) as typeof fetch);
  const stored = (
    await db.execute({
      sql: "SELECT token_ciphertext FROM external_connections WHERE id=?",
      args: [id],
    })
  ).rows[0];
  expect(String(stored.token_ciphertext)).not.toContain(token);
  expect(
    decryptKey(
      String(stored.token_ciphertext),
      ctx.workspaceId,
      undefined,
      `source:${id}`,
    ),
  ).toBe(token);
  expect(() =>
    decryptKey(
      String(stored.token_ciphertext),
      other.workspaceId,
      undefined,
      `source:${id}`,
    ),
  ).toThrow();
  expect(() =>
    decryptKey(String(stored.token_ciphertext), ctx.workspaceId),
  ).toThrow();
  expect(JSON.stringify(await externalStatus(ctx, db))).not.toContain(token);
  expect(JSON.stringify(await externalStatus(ctx, db))).not.toContain(
    "ciphertext",
  );
  expect(await externalStatus(other, db)).toEqual([]);
  await expect(syncExternal(other, id, db)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(disconnectExternal(other, id, db)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
test("setup verifies access without importing; sync queues evidence and repeated sync is unchanged", async () => {
  const ctx = await workspace(),
    id = await connected(ctx);
  expect((await snapshot(ctx, db)).evidence).toEqual([]);
  expect(await syncExternal(ctx, id, db, transport([issue()]))).toMatchObject({
    imported: 1,
    updated: 0,
    hasMore: false,
  });
  const first = await snapshot(ctx, db);
  expect(first.pending).toBe(1);
  expect(first.key).toBeNull();
  expect(first.usage).toBe(0);
  expect(await syncExternal(ctx, id, db, transport([issue()]))).toMatchObject({
    imported: 0,
    unchanged: 1,
  });
  expect((await snapshot(ctx, db)).evidence[0].id).toBe(first.evidence[0].id);
});
test("updates preserve document IDs, remove obsolete vectors and signals, and requeue chunks", async () => {
  const ctx = await workspace(),
    id = await connected(ctx);
  await syncExternal(ctx, id, db, transport([issue()]));
  const before = await snapshot(ctx, db);
  const chunk = (
    await db.execute({
      sql: "SELECT id FROM chunks WHERE workspace_id=?",
      args: [ctx.workspaceId],
    })
  ).rows[0];
  await db.execute({
    sql: "INSERT INTO signals(id,workspace_id,company_id,chunk_id,kind,title,detail,quote,confidence,created_at) VALUES(?,?,?,?,'risk','Risk','Risk',?,90,'now')",
    args: [
      `signal-${id}`,
      ctx.workspaceId,
      before.accounts[0].id,
      chunk.id,
      body,
    ],
  });
  const vector = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
  await db.execute({
    sql: "INSERT INTO chunk_embeddings(workspace_id,chunk_id,model,embedding) VALUES(?,?,?,vector32(?))",
    args: [
      ctx.workspaceId,
      chunk.id,
      "Qwen/Qwen3-Embedding-8B",
      JSON.stringify(vector),
    ],
  });
  expect(
    await syncExternal(
      ctx,
      id,
      db,
      transport([
        {
          ...issue(
            1,
            "Exports are fixed and we have confirmed our renewal for another year.",
          ),
          state: "closed",
        },
      ]),
    ),
  ).toMatchObject({ updated: 1, imported: 0 });
  const after = await snapshot(ctx, db);
  expect(after.evidence[0].id).toBe(before.evidence[0].id);
  expect(after.evidence[0].body).toContain("State: closed");
  expect(after.signals).toEqual([]);
  expect(after.pending).toBe(1);
  expect(after.accounts[0].health).toBe(75);
  expect(
    (
      await db.execute({
        sql: "SELECT * FROM chunk_embeddings WHERE workspace_id=?",
        args: [ctx.workspaceId],
      })
    ).rows,
  ).toHaveLength(0);
});
test("GitHub pagination includes PR-only pages and persists progress", async () => {
  const ctx = await workspace();
  const fixture = (async (url) =>
    new URL(String(url)).searchParams.get("page") === "1"
      ? Response.json(
          Array.from({ length: 20 }, (_, i) => ({
            ...issue(i + 1),
            pull_request: {},
          })),
        )
      : Response.json([issue(21)])) as typeof fetch;
  const id = await connected(ctx, github, "", fixture);
  expect(await syncExternal(ctx, id, db, fixture)).toMatchObject({
    imported: 0,
    skipped: 20,
    hasMore: true,
  });
  expect((await externalStatus(ctx, db))[0].hasMore).toBe(true);
  expect(await syncExternal(ctx, id, db, fixture)).toMatchObject({
    imported: 1,
    hasMore: false,
  });
});
test("Airtable reads only supported fields into evidence and follows its opaque offset safely", async () => {
  const ctx = await workspace();
  let offsetSeen = false;
  const fixture = (async (url, init) => {
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe("https://api.airtable.com");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer test-airtable-token",
    );
    const offset = parsed.searchParams.get("offset");
    if (offset) {
      expect(offset).toBe("cursor/record?x=y");
      offsetSeen = true;
      return Response.json({ records: [record("2")] });
    }
    return Response.json({ records: [record()], offset: "cursor/record?x=y" });
  }) as typeof fetch;
  const id = await connected(ctx, airtable, "test-airtable-token", fixture);
  expect(await syncExternal(ctx, id, db, fixture)).toMatchObject({
    imported: 1,
    hasMore: true,
  });
  expect(await syncExternal(ctx, id, db, fixture)).toMatchObject({
    imported: 1,
    hasMore: false,
  });
  expect(offsetSeen).toBe(true);
  const data = await snapshot(ctx, db);
  expect(data.evidence).toHaveLength(2);
  expect(JSON.stringify(data)).not.toContain("do-not-import");
  expect(JSON.stringify(data)).not.toContain("localhost/private");
  await expect(
    fetchSourcePage(airtable, "", null, fixture),
  ).rejects.toMatchObject({ code: "SOURCE_TOKEN_REQUIRED" });
});
test("invalid Airtable records fail the entire batch without silently skipping feedback", async () => {
  const ctx = await workspace(),
    id = await connected(
      ctx,
      airtable,
      "test-token",
      transport({ records: [record()] }),
    );
  const invalid = {
    ...record("2"),
    fields: { ...record("2").fields, "Company domain": "not a domain" },
  };
  await expect(
    syncExternal(ctx, id, db, transport({ records: [record(), invalid] })),
  ).rejects.toMatchObject({ code: "SOURCE_INVALID_RECORD" });
  expect((await snapshot(ctx, db)).evidence).toEqual([]);
  expect((await externalStatus(ctx, db))[0].lastSyncedAt).toBeNull();
});
test("upstream failures are sanitized and access failures never persist credentials", async () => {
  const ctx = await workspace();
  for (const status of [401, 403, 404, 429, 500]) {
    try {
      await connected(
        ctx,
        github,
        "secret-do-not-log",
        transport({ message: "secret-do-not-log" }, status),
      );
      throw new Error("unexpected success");
    } catch (e) {
      expect(String(e)).not.toContain("secret-do-not-log");
    }
  }
  expect(await externalStatus(ctx, db)).toEqual([]);
  await expect(
    fetchSourcePage(github, "", null, transport([], 429)),
  ).rejects.toMatchObject({ code: "SOURCE_RATE_LIMITED" });
  await expect(
    fetchSourcePage(github, "", null, (async () => {
      throw new Error("private provider detail");
    }) as unknown as typeof fetch),
  ).rejects.toMatchObject({ code: "SOURCE_UNAVAILABLE" });
});
test("long issue text is explicitly truncated; oversized responses are rejected", async () => {
  const page = await fetchSourcePage(
    github,
    "",
    null,
    transport([issue(1, "x".repeat(30000))]),
  );
  expect(page.truncated).toBe(1);
  expect(page.items[0].document.body.length).toBeLessThanOrEqual(20000);
  expect(page.items[0].document.body).toContain("truncated");
  await expect(
    fetchSourcePage(
      github,
      "",
      null,
      transport([issue(1, "x".repeat(2_000_001))]),
    ),
  ).rejects.toMatchObject({ code: "SOURCE_TOO_LARGE" });
});
test("sync and AI processing share a workspace lease", async () => {
  const ctx = await workspace(),
    id = await connected(ctx);
  await db.execute({
    sql: "INSERT INTO workspace_jobs VALUES(?,'processing',?)",
    args: [ctx.workspaceId, Date.now() + 300000],
  });
  await expect(
    syncExternal(ctx, id, db, transport([issue()])),
  ).rejects.toMatchObject({ code: "PROCESSING_ACTIVE" });
});
test("disconnect during an upstream fetch aborts writes and releases the sync lease", async () => {
  const ctx = await workspace(),
    id = await connected(ctx);
  await expect(
    syncExternal(ctx, id, db, (async () => {
      await disconnectExternal(ctx, id, db);
      return Response.json([issue()]);
    }) as unknown as typeof fetch),
  ).rejects.toMatchObject({ code: "CONNECTION_CHANGED" });
  expect((await snapshot(ctx, db)).evidence).toEqual([]);
  expect(
    (
      await db.execute({
        sql: "SELECT * FROM workspace_jobs WHERE workspace_id=?",
        args: [ctx.workspaceId],
      })
    ).rows,
  ).toHaveLength(0);
});
test("failed database writes roll back records and cursor so retry remains safe", async () => {
  const ctx = await workspace(),
    id = await connected(ctx);
  await db.executeMultiple(
    "CREATE TRIGGER fail_source BEFORE INSERT ON external_records BEGIN SELECT RAISE(ABORT,'fixture_failure'); END;",
  );
  try {
    await expect(
      syncExternal(ctx, id, db, transport([issue()])),
    ).rejects.toThrow();
  } finally {
    await db.execute("DROP TRIGGER fail_source");
  }
  expect((await snapshot(ctx, db)).evidence).toEqual([]);
  expect((await externalStatus(ctx, db))[0].lastSyncedAt).toBeNull();
  expect(await syncExternal(ctx, id, db, transport([issue()]))).toMatchObject({
    imported: 1,
  });
});
test("disconnect removes the token, retains evidence, and reconnect does not duplicate records", async () => {
  const ctx = await workspace(),
    id = await connected(ctx, github, "test-token");
  await syncExternal(ctx, id, db, transport([issue()]));
  await disconnectExternal(ctx, id, db);
  expect((await externalStatus(ctx, db))[0]).toMatchObject({
    enabled: false,
    hasToken: false,
    documents: 1,
  });
  await expect(syncExternal(ctx, id, db)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    connected(ctx, {
      ...github,
      company: "Wrong customer",
      domain: "other.example",
    }),
  ).rejects.toMatchObject({ code: "MAPPING_CHANGED" });
  expect(await connected(ctx, github, "replacement-token")).toBe(id);
  expect(await syncExternal(ctx, id, db, transport([issue()]))).toMatchObject({
    unchanged: 1,
  });
});
