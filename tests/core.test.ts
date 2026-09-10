import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { generateKeyPair, SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import type { WorkspaceContext } from "../lib/types";

let sessionUser: { sub: string; email: string; name: string } | null = null;
mock.module("../lib/auth0", () => ({
  auth0: () => ({
    getSession: async () => (sessionUser ? { user: sessionUser } : null),
    middleware: async () => {
      const response = NextResponse.next();
      response.cookies.set("session-test", "rolled");
      return response;
    },
  }),
  authConfigured: () => true,
}));
const {
  database,
  resolveWorkspace,
  mapIdentity,
  requireOwner,
  snapshot,
  rows,
  searchChunks,
  rateLimit,
} = await import("../lib/db");
const { encryptKey, decryptKey, validSecret } = await import("../lib/crypto");
const { ingest, parseCSV, chunkText } = await import("../lib/ingest");
const { Nebius, DIMENSIONS } = await import("../lib/ai/nebius");
const { DEFAULT_CHAT_MODEL, CHAT_MODEL_IDS, EMBEDDING_MODEL } =
  await import("../lib/ai/models");
const { workspaceAI } = await import("../lib/ai/service");
const { processPending, parseDetection } = await import("../lib/ai/pipeline");
const { answerQuestion, parseAnswer } = await import("../lib/ai/chat");
const { verifyBearer } = await import("../lib/mcp-auth");
const { sameOrigin, readBody } = await import("../lib/http");
const uploads = await import("../app/api/uploads/route");
const keys = await import("../app/api/ai-key/route");
const chat = await import("../app/api/chat/route");
const cron = await import("../app/api/cron/embed-pending/route");
const mcp = await import("../app/api/mcp/route");
const { proxy } = await import("../proxy");
const { pageData } = await import("../lib/page-data");
const tallySettings = await import("../app/api/integrations/tally/route");
const tallyWebhook = await import("../app/api/webhooks/tally/[id]/route");
const sourceSettings = await import("../app/api/integrations/sources/route");
const sourceSync = await import("../app/api/integrations/sources/sync/route");
let directory: string, one: WorkspaceContext, two: WorkspaceContext;
const secret = "a1".repeat(32),
  key = "test-nebius-private-key-123456";
const body =
  "We need the export issue resolved before we can sign off on another year. The renewal is blocked by export failures.";
const quote =
  "We need the export issue resolved before we can sign off on another year.";
const vector = Array.from({ length: DIMENSIONS }, (_, i) => (i === 0 ? 1 : 0));
const document = {
  company: "Acme",
  domain: "acme.example",
  title: "Renewal call",
  body,
  arr: 120000,
  owner: "Alex",
  renewal: "2026-10-01",
};
const userOne = { sub: "auth0|one", email: "shared@example.com", name: "One" };
const userTwo = { sub: "auth0|two", email: "shared@example.com", name: "Two" };
const request = (
  path: string,
  payload: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "revenue-tests-"));
  process.env.TURSO_DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.KEY_ENCRYPTION_SECRET = secret;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.CRON_SECRET = "c".repeat(48);
  await database().executeMultiple(
    await readFile(
      new URL("../db/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await database().executeMultiple(
    await readFile(
      new URL("../db/migrations/002_health_triggers.sql", import.meta.url),
      "utf8",
    ),
  );
  one = await resolveWorkspace(userOne);
  await database().executeMultiple(
    await readFile(
      new URL("../db/migrations/003_qwen_embeddings.sql", import.meta.url),
      "utf8",
    ),
  );
  two = await resolveWorkspace(userTwo);
  await database().executeMultiple(
    await readFile(
      new URL("../db/migrations/005_external_sources.sql", import.meta.url),
      "utf8",
    ),
  );
  await database().executeMultiple(
    await readFile(
      new URL("../db/migrations/004_tally_integration.sql", import.meta.url),
      "utf8",
    ),
  );
});
afterAll(async () => {
  database().close();
  await rm(directory, { recursive: true, force: true });
});

describe("Auth0 identity and authorization", () => {
  test("keys identity by sub, never email", () => {
    expect(mapIdentity(userOne).id).not.toBe(mapIdentity(userTwo).id);
    expect(mapIdentity(userOne).id).toBe(
      mapIdentity({ ...userOne, email: "changed@example.com" }).id,
    );
  });
  test("rejects missing and machine identities", () => {
    expect(() => mapIdentity({})).toThrow();
    expect(() => mapIdentity({ sub: "client@clients" })).toThrow();
  });
  test("provisioning is idempotent", async () => {
    const again = await resolveWorkspace(userOne);
    expect(again.workspaceId).toBe(one.workspaceId);
    expect(
      (
        await rows("SELECT * FROM workspace_members WHERE user_id=?", [
          one.userId,
        ])
      ).length,
    ).toBe(1);
  });
  test("rejects another workspace even when explicitly requested", async () => {
    await expect(
      resolveWorkspace(userOne, two.workspaceId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  test("members cannot administer AI credentials", () => {
    expect(() => requireOwner({ ...one, role: "member" })).toThrow();
  });
  test("JWT issuer, audience, expiry, scope and signature are checked", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const token = await new SignJWT({ scope: "read:insights" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("auth0|one")
      .setIssuer("https://tenant.auth0.com/")
      .setAudience("revenue-api")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    expect(
      (await verifyBearer(token, "tenant.auth0.com", "revenue-api", publicKey))
        .sub,
    ).toBe("auth0|one");
    await expect(
      verifyBearer(token, "other.auth0.com", "revenue-api", publicKey),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      verifyBearer(token, "tenant.auth0.com", "wrong-audience", publicKey),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const expired = await new SignJWT({ scope: "read:insights" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("auth0|one")
      .setIssuer("https://tenant.auth0.com/")
      .setAudience("revenue-api")
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(privateKey);
    await expect(
      verifyBearer(expired, "tenant.auth0.com", "revenue-api", publicKey),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const unscoped = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("auth0|one")
      .setIssuer("https://tenant.auth0.com/")
      .setAudience("revenue-api")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    await expect(
      verifyBearer(unscoped, "tenant.auth0.com", "revenue-api", publicKey),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_SCOPE" });
    await expect(
      verifyBearer(token + "bad", "tenant.auth0.com", "revenue-api", publicKey),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
describe("BYOK and provider failures", () => {
  test("encrypts with a random nonce and binds ciphertext to its workspace", () => {
    const encrypted = encryptKey(key, one.workspaceId);
    expect(encrypted).not.toContain(key);
    expect(encryptKey(key, one.workspaceId)).not.toBe(encrypted);
    expect(decryptKey(encrypted, one.workspaceId)).toBe(key);
    expect(() => decryptKey(encrypted, two.workspaceId)).toThrow();
    expect(() =>
      decryptKey(encrypted.slice(0, -3) + "zzz", one.workspaceId),
    ).toThrow();
  });
  test("refuses weak encryption configuration", () => {
    expect(() => encryptKey(key, one.workspaceId, "weak-secret")).toThrow();
  });
  test("there is no shared key fallback", async () => {
    await expect(workspaceAI(one)).rejects.toMatchObject({
      code: "AI_KEY_REQUIRED",
    });
    await expect(processPending(one)).rejects.toMatchObject({
      code: "AI_KEY_REQUIRED",
    });
    expect(() => new Nebius("", DEFAULT_CHAT_MODEL)).toThrow();
  });
  test("provider errors are sanitized and distinguish rejected keys and rate limits", async () => {
    const denied = new Nebius(
      key,
      DEFAULT_CHAT_MODEL,
      (async () =>
        new Response(`secret ${key}`, {
          status: 401,
        })) as unknown as typeof fetch,
    );
    const limited = new Nebius(
      key,
      DEFAULT_CHAT_MODEL,
      (async () =>
        new Response("private body", {
          status: 429,
        })) as unknown as typeof fetch,
    );
    await expect(denied.embed(["test"])).rejects.toMatchObject({
      code: "AI_KEY_INVALID",
    });
    await expect(limited.embed(["test"])).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
    });
    try {
      await denied.embed(["test"]);
    } catch (e) {
      expect(String(e)).not.toContain(key);
    }
  });
  test("rejects wrong embedding dimensions", async () => {
    const ai = new Nebius(key, DEFAULT_CHAT_MODEL, (async () =>
      Response.json({
        data: [{ index: 0, embedding: [1, 2] }],
      })) as unknown as typeof fetch);
    await expect(ai.embed(["test"])).rejects.toMatchObject({
      code: "AI_INVALID_EMBEDDING",
    });
  });
  test("only the two supported models are accepted, with exact case-sensitive IDs", () => {
    expect(() => new Nebius(key, "Qwen/old-model")).toThrow();
    expect(() => new Nebius(key, "nvidia/nemotron-3_5-lightning")).toThrow();
  });
  test("routes each chat model to its endpoint and keeps Qwen embeddings global", async () => {
    for (const model of CHAT_MODEL_IDS) {
      const calls: { url: string; body: Record<string, unknown> }[] = [];
      const ai = new Nebius(key, model, (async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          `Bearer ${key}`,
        );
        return String(url).endsWith("embeddings")
          ? Response.json({ data: [{ index: 0, embedding: vector }] })
          : Response.json({
              choices: [{ message: { content: '{"ok":true}' } }],
            });
      }) as typeof fetch);
      await ai.embed(["Evidence"]);
      await ai.complete("Return JSON.", "Question");
      expect(calls[0]).toEqual({
        url: "https://api.tokenfactory.nebius.com/v1/embeddings",
        body: {
          model: EMBEDDING_MODEL,
          input: ["Evidence"],
          dimensions: 1536,
          encoding_format: "float",
        },
      });
      expect(calls[1].url).toBe(
        model === DEFAULT_CHAT_MODEL
          ? "https://api.tokenfactory.nebius.com/v1/chat/completions"
          : "https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions",
      );
      expect(calls[1].body.model).toBe(model);
    }
  });
});
describe("Import and grounding", () => {
  test("CSV handles quoted commas, newlines and BOM", () => {
    const parsed = parseCSV(
      '\ufeffcompany,domain,title,body\nAcme,acme.example,"Renewal, Q4","A long customer quote, with a comma.\nAnd a second line."',
    );
    expect(parsed[0].title).toBe("Renewal, Q4");
    expect(parsed[0].body).toContain("\n");
  });
  test("rejects malformed CSV and unsafe domains", () => {
    expect(() =>
      parseCSV("company,domain,title,body\nAcme,https://evil.example,X,short"),
    ).toThrow();
  });
  test("chunks preserve bounded overlapping source text", () => {
    const text = "Customer renewal evidence. ".repeat(400);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2000 && text.includes(c))).toBe(
      true,
    );
    expect(chunks[0].slice(-200)).toBe(chunks[1].slice(0, 200));
  });
  test("rejects invented signal quotes and citations", () => {
    expect(() =>
      parseDetection(
        JSON.stringify({
          signals: [
            {
              kind: "risk",
              title: "Risk",
              detail: "Risk",
              quote: "Invented customer quotation",
              confidence: 90,
            },
          ],
          competitors: [],
        }),
        body,
      ),
    ).toThrow();
    expect(() =>
      parseAnswer(
        JSON.stringify({
          answer: "A claim",
          citations: [{ id: "foreign", quote }],
        }),
        [],
      ),
    ).toThrow();
  });
});
describe("Upload to retrieval to cited chat", () => {
  test("imports atomic tenant-scoped documents and FTS records", async () => {
    await ingest(one, [document], "Manual", "manual");
    await ingest(
      two,
      [
        {
          ...document,
          title: "Other tenant secret",
          body: "Confidential expansion plans for another tenant, never expose this record.",
        },
      ],
      "Manual",
      "manual",
    );
    const first = await snapshot(one),
      second = await snapshot(two);
    expect(first.accounts.length).toBe(1);
    expect(first.evidence[0].title).toBe("Renewal call");
    expect(second.evidence[0].title).toBe("Other tenant secret");
    expect(first.evidence[0].id).not.toBe(second.evidence[0].id);
  });
  test("foreign-key constraints reject cross-workspace document ownership", async () => {
    const [company] = await rows<{ id: string }>(
      "SELECT id FROM companies WHERE workspace_id=?",
      [two.workspaceId],
    );
    const [source] = await rows<{ id: string }>(
      "SELECT id FROM sources WHERE workspace_id=?",
      [one.workspaceId],
    );
    await expect(
      database().execute({
        sql: "INSERT INTO documents(id,workspace_id,company_id,source_id,title,body,created_at) VALUES('bad',?,?,?,'bad','bad','now')",
        args: [one.workspaceId, company.id, source.id],
      }),
    ).rejects.toThrow();
  });
  test("processes evidence through Nebius-compatible responses and persists usage", async () => {
    const ai = new Nebius(key, DEFAULT_CHAT_MODEL, (async (
      url: string | URL | Request,
    ) =>
      String(url).endsWith("embeddings")
        ? Response.json({
            data: [{ index: 0, embedding: vector }],
            usage: { total_tokens: 12 },
          })
        : Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    signals: [
                      {
                        kind: "risk",
                        title: "Renewal blocked",
                        detail: "Exports must be repaired before renewal.",
                        quote,
                        confidence: 93,
                      },
                    ],
                    competitors: [],
                  }),
                },
              },
            ],
            usage: { total_tokens: 42 },
          })) as unknown as typeof fetch);
    const result = await processPending(one, { provider: ai });
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    const state = await snapshot(one);
    expect(state.pending).toBe(0);
    expect(state.signals[0].quote).toBe(quote);
    expect(state.usage).toBe(54);
    const again = await processPending(one, { provider: ai });
    expect(again.processed).toBe(0);
  });
  test("hybrid retrieval excludes other workspaces and respects account filters", async () => {
    const hits = await searchChunks(one.workspaceId, "renewal export", vector);
    expect(hits.length).toBe(1);
    expect(hits[0].title).toBe("Renewal call");
    expect(
      await searchChunks(one.workspaceId, "renewal", vector, "another.example"),
    ).toEqual([]);
  });
  test("obsolete vectors are not searched; re-embedding preserves classifications across retries", async () => {
    const before = (await snapshot(one)).signals;
    await database().execute({
      sql: "UPDATE chunk_embeddings SET model='BAAI/bge-en-icl' WHERE workspace_id=?",
      args: [one.workspaceId],
    });
    expect(
      await searchChunks(one.workspaceId, "zzznomatchzzz", vector),
    ).toEqual([]);
    await database().execute({
      sql: "UPDATE chunks SET status='pending' WHERE workspace_id=?",
      args: [one.workspaceId],
    });
    let fail = true;
    const ai = new Nebius(key, DEFAULT_CHAT_MODEL, (async (url) => {
      expect(String(url).endsWith("embeddings")).toBe(true);
      if (fail) return new Response("Unavailable", { status: 503 });
      return Response.json({ data: [{ index: 0, embedding: vector }] });
    }) as typeof fetch);
    expect((await processPending(one, { provider: ai })).failed).toBe(1);
    fail = false;
    expect(
      (await processPending(one, { provider: ai, retry: true })).processed,
    ).toBe(1);
    expect((await snapshot(one)).signals).toEqual(before);
    expect(
      (await searchChunks(one.workspaceId, "zzznomatchzzz", vector)).length,
    ).toBe(1);
  });
  test("chat returns source-verified citations and rejects foreign threads", async () => {
    const ai = new Nebius(key, DEFAULT_CHAT_MODEL, (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      if (String(url).endsWith("embeddings"))
        return Response.json({
          data: [{ index: 0, embedding: vector }],
          usage: { total_tokens: 4 },
        });
      const input = JSON.parse(
        JSON.parse(String(init?.body)).messages[1].content,
      );
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                answer: "The renewal is blocked by the export issue. [1]",
                citations: [{ id: input.evidence[0].id, quote }],
              }),
            },
          },
        ],
        usage: { total_tokens: 20 },
      });
    }) as unknown as typeof fetch);
    const answer = await answerQuestion(
      one,
      "Why is the renewal at risk?",
      undefined,
      undefined,
      ai,
    );
    expect(answer.citations[0].quote).toBe(quote);
    expect(answer.threadId).toBeTruthy();
    await expect(
      answerQuestion(two, "Read this thread", undefined, answer.threadId!, ai),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (
        await rows("SELECT * FROM chat_messages WHERE workspace_id=?", [
          two.workspaceId,
        ])
      ).length,
    ).toBe(0);
  });
  test("an active processing lease rejects duplicate runs", async () => {
    await database().execute({
      sql: "INSERT INTO workspace_jobs(workspace_id,lease_id,expires_at) VALUES(?,'test',?)",
      args: [one.workspaceId, Date.now() + 50000],
    });
    await expect(
      processPending(one, { provider: new Nebius(key, DEFAULT_CHAT_MODEL) }),
    ).rejects.toMatchObject({ code: "PROCESSING_ACTIVE" });
    await database().execute({
      sql: "DELETE FROM workspace_jobs WHERE workspace_id=?",
      args: [one.workspaceId],
    });
  });
  test("resolving and reopening a signal recalculates account health", async () => {
    const [signal] = await rows<{ id: string }>(
      "SELECT id FROM signals WHERE workspace_id=?",
      [one.workspaceId],
    );
    expect((await snapshot(one)).accounts[0].health).toBe(60);
    await database().execute({
      sql: "UPDATE signals SET status='resolved' WHERE id=? AND workspace_id=?",
      args: [signal.id, one.workspaceId],
    });
    expect((await snapshot(one)).accounts[0].health).toBe(75);
    await database().execute({
      sql: "UPDATE signals SET status='open' WHERE id=? AND workspace_id=?",
      args: [signal.id, one.workspaceId],
    });
    expect((await snapshot(one)).accounts[0].health).toBe(60);
  });
  test("MCP tools support discovery, source retrieval, and tenant isolation", async () => {
    const { Client } =
      await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } =
      await import("@modelcontextprotocol/sdk/inMemory.js");
    const { createMcpServer } = await import("../lib/mcp-server");
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createMcpServer(one),
      client = new Client({ name: "test-client", version: "1" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const catalog = await client.listTools();
      expect(catalog.tools.map((t) => t.name).sort()).toEqual([
        "account_overview",
        "get_source",
        "list_accounts",
        "search_evidence",
      ]);
      const accounts = await client.callTool({
        name: "list_accounts",
        arguments: { query: "Acme" },
      });
      expect(accounts.isError).not.toBe(true);
      const [foreign] = await rows<{ id: string }>(
        "SELECT id FROM documents WHERE workspace_id=?",
        [two.workspaceId],
      );
      const denied = await client.callTool({
        name: "get_source",
        arguments: { id: foreign.id },
      });
      expect(denied.isError).toBe(true);
      const [own] = await rows<{ id: string }>(
        "SELECT id FROM chunks WHERE workspace_id=?",
        [one.workspaceId],
      );
      const source = await client.callTool({
        name: "get_source",
        arguments: { id: own.id },
      });
      expect(source.isError).not.toBe(true);
      expect(JSON.stringify(source)).toContain("Renewal call");
      const noKey = await client.callTool({
        name: "search_evidence",
        arguments: { query: "renewal" },
      });
      expect(JSON.stringify(noKey)).toContain("AI_KEY_REQUIRED");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
describe("API boundaries", () => {
  test("unauthenticated uploads and chat are rejected", async () => {
    sessionUser = null;
    expect((await uploads.POST(request("/api/uploads", document))).status).toBe(
      401,
    );
    expect(
      (await chat.POST(request("/api/chat", { query: "risk?" }))).status,
    ).toBe(401);
  });
  test("logged-in AI calls without a key return AI_KEY_REQUIRED", async () => {
    sessionUser = userOne;
    const response = await chat.POST(request("/api/chat", { query: "risk?" }));
    expect(response.status).toBe(402);
    expect((await response.json()).error).toBe("AI_KEY_REQUIRED");
  });
  test("client-selected tenant IDs do not grant access", async () => {
    sessionUser = userOne;
    expect(
      (
        await uploads.POST(
          request("/api/uploads", document, {
            "x-workspace-id": two.workspaceId,
          }),
        )
      ).status,
    ).toBe(403);
  });
  test("cross-origin mutations and oversized streaming bodies are rejected", async () => {
    expect(() =>
      sameOrigin(
        request("/api/chat", {}, { origin: "https://attacker.example" }),
      ),
    ).toThrow();
    await expect(
      readBody(request("/api/uploads", { body: "x".repeat(1000) }), 100),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });
  test("cron and MCP reject invalid authorization", async () => {
    expect(validSecret(null, "x".repeat(40))).toBe(false);
    expect(
      (
        await cron.GET(
          new Request("http://localhost:3000/api/cron/embed-pending"),
        )
      ).status,
    ).toBe(401);
    expect((await mcp.POST(request("/api/mcp", {}))).status).toBe(401);
  });
  test("encrypted key metadata never exposes stored plaintext or ciphertext", async () => {
    sessionUser = userOne;
    await database().execute({
      sql: "INSERT INTO ai_provider_keys(workspace_id,ciphertext,hint,model,verified_at,updated_by) VALUES(?,?,?,?,?,?)",
      args: [
        one.workspaceId,
        encryptKey(key, one.workspaceId),
        key.slice(-4),
        DEFAULT_CHAT_MODEL,
        new Date().toISOString(),
        one.userId,
      ],
    });
    const response = await keys.GET(
      new Request("http://localhost:3000/api/ai-key"),
    );
    const text = await response.text();
    expect(text).not.toContain(key);
    expect(text).not.toContain("ciphertext");
    expect(JSON.stringify(await snapshot(one))).not.toContain(key);
  });
  test("model changes verify the saved key, enforce owner access, and preserve settings on failure", async () => {
    sessionUser = userOne;
    const originalFetch = globalThis.fetch;
    let rejected = false;
    const calls: string[] = [];
    globalThis.fetch = (async (url, init) => {
      calls.push(String(url));
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        `Bearer ${key}`,
      );
      if (rejected)
        return new Response("Private provider error", { status: 403 });
      return String(url).endsWith("embeddings")
        ? Response.json({ data: [{ index: 0, embedding: vector }] })
        : Response.json({
            choices: [{ message: { content: '{"connected":true}' } }],
          });
    }) as typeof fetch;
    try {
      expect(
        (await keys.POST(request("/api/ai-key", { model: "not-supported" })))
          .status,
      ).toBe(400);
      expect(calls.length).toBe(0);
      const saved = await keys.POST(
        request("/api/ai-key", { model: CHAT_MODEL_IDS[1] }),
      );
      expect(saved.status).toBe(200);
      expect(await saved.text()).not.toContain(key);
      expect(calls).toEqual([
        "https://api.tokenfactory.nebius.com/v1/embeddings",
        "https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions",
      ]);
      expect((await workspaceAI(one)).model).toBe(CHAT_MODEL_IDS[1]);
      rejected = true;
      expect(
        (await keys.POST(request("/api/ai-key", { model: DEFAULT_CHAT_MODEL })))
          .status,
      ).toBe(502);
      expect((await workspaceAI(one)).model).toBe(CHAT_MODEL_IDS[1]);
      sessionUser = userTwo;
      expect(
        (await keys.POST(request("/api/ai-key", { model: DEFAULT_CHAT_MODEL })))
          .status,
      ).toBe(402);
      await database().execute({
        sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'member')",
        args: [one.workspaceId, two.userId],
      });
      const count = calls.length;
      expect(
        (
          await keys.POST(
            request(
              "/api/ai-key",
              { model: DEFAULT_CHAT_MODEL },
              { "x-workspace-id": one.workspaceId },
            ),
          )
        ).status,
      ).toBe(403);
      expect(calls.length).toBe(count);
    } finally {
      globalThis.fetch = originalFetch;
      sessionUser = userOne;
      await database().execute({
        sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?",
        args: [one.workspaceId, two.userId],
      });
    }
  });
  test("rate limit uses atomic database counters", async () => {
    await rateLimit(one, "test", 1);
    await expect(rateLimit(one, "test", 1)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
  test("deleting evidence cascades to embeddings, FTS and signals", async () => {
    const [doc] = await rows<{ id: string }>(
      "SELECT id FROM documents WHERE workspace_id=?",
      [one.workspaceId],
    );
    await database().execute({
      sql: "DELETE FROM documents WHERE workspace_id=? AND id=?",
      args: [one.workspaceId, doc.id],
    });
    expect(await searchChunks(one.workspaceId, "export", vector)).toEqual([]);
    expect((await snapshot(one)).signals).toEqual([]);
    expect((await snapshot(one)).accounts[0].health).toBe(75);
    expect((await snapshot(two)).evidence.length).toBe(1);
  });
});

describe("Tally HTTP integration", () => {
  test("settings require a session, same-origin mutations, and workspace ownership", async () => {
    sessionUser = null;
    expect(
      (
        await tallySettings.GET(
          new Request("http://localhost:3000/api/integrations/tally"),
        )
      ).status,
    ).toBe(401);
    sessionUser = userOne;
    expect(
      (
        await tallySettings.POST(
          request(
            "/api/integrations/tally",
            { formId: "testForm" },
            { origin: "https://attacker.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await tallySettings.POST(
          request(
            "/api/integrations/tally",
            { formId: "testForm" },
            { "x-workspace-id": two.workspaceId },
          ),
        )
      ).status,
    ).toBe(403);
    await database().execute({
      sql: "INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'member')",
      args: [two.workspaceId, one.userId],
    });
    try {
      expect(
        (
          await tallySettings.POST(
            request(
              "/api/integrations/tally",
              { formId: "testForm" },
              { "x-workspace-id": two.workspaceId },
            ),
          )
        ).status,
      ).toBe(403);
    } finally {
      await database().execute({
        sql: "DELETE FROM workspace_members WHERE workspace_id=? AND user_id=?",
        args: [two.workspaceId, one.userId],
      });
      sessionUser = null;
    }
  });
  test("signed webhook -> queued chunks -> mocked Nebius processing -> cited answer", async () => {
    sessionUser = {
      sub: "auth0|tally-pipeline",
      email: "tally@example.com",
      name: "Tally test",
    };
    const ctx = await resolveWorkspace(sessionUser);
    const setupResponse = await tallySettings.POST(
      request("/api/integrations/tally", { formId: "testForm" }),
    );
    expect(setupResponse.status).toBe(201);
    const { connection, signingSecret } = await setupResponse.json();
    expect(
      await (
        await tallySettings.GET(
          new Request("http://localhost:3000/api/integrations/tally"),
        )
      ).text(),
    ).not.toContain(signingSecret);
    sessionUser = null;
    const endpoint = `/api/webhooks/tally/${connection.id}`;
    expect(
      (await proxy(new NextRequest(`http://localhost:3000${endpoint}`))).status,
    ).toBe(200);
    expect(
      (
        await proxy(
          new NextRequest(
            "http://localhost:3000/api/webhooks/tally/not-a-uuid",
          ),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await proxy(
          new NextRequest("http://localhost:3000/api/integrations/tally"),
        )
      ).status,
    ).toBe(401);
    const payload = {
      eventId: "event-http",
      eventType: "FORM_RESPONSE",
      data: {
        formId: "testForm",
        submissionId: "submission-http",
        fields: [
          { label: "Company", value: "Pipeline test" },
          { label: "Company domain", value: "pipeline.example" },
          { label: "Feedback", value: body },
        ],
      },
    };
    const signature = createHmac("sha256", signingSecret)
      .update(JSON.stringify(payload))
      .digest("base64");
    const params = { params: Promise.resolve({ id: connection.id }) };
    expect(
      (await tallyWebhook.POST(request(endpoint, payload), params)).status,
    ).toBe(401);
    expect(
      (
        await tallyWebhook.POST(
          request(endpoint, payload, {
            "content-length": "100001",
            "Tally-Signature": signature,
          }),
          params,
        )
      ).status,
    ).toBe(413);
    const delivery = () =>
      new Request(`http://localhost:3000${endpoint}`, {
        method: "POST",
        headers: { "Tally-Signature": signature },
        body: JSON.stringify(payload),
      });
    expect((await tallyWebhook.POST(delivery(), params)).status).toBe(202);
    expect((await tallyWebhook.POST(delivery(), params)).status).toBe(200);
    expect((await snapshot(ctx)).pending).toBe(1);
    const ai = new Nebius(key, DEFAULT_CHAT_MODEL, (async (url, init) => {
      if (String(url).endsWith("embeddings"))
        return Response.json({ data: [{ index: 0, embedding: vector }] });
      const input = JSON.parse(
        JSON.parse(String(init?.body)).messages[1].content,
      );
      const content = Array.isArray(input.evidence)
        ? {
            answer: "The renewal is blocked by export failures. [1]",
            citations: [{ id: input.evidence[0].id, quote }],
          }
        : {
            signals: [
              {
                kind: "risk",
                title: "Renewal blocked",
                detail: "Exports must be repaired.",
                quote,
                confidence: 90,
              },
            ],
            competitors: [],
          };
      return Response.json({
        choices: [{ message: { content: JSON.stringify(content) } }],
      });
    }) as typeof fetch);
    expect((await processPending(ctx, { provider: ai })).processed).toBe(1);
    expect((await snapshot(ctx)).signals[0].quote).toBe(quote);
    const answer = await answerQuestion(
      ctx,
      "Why is renewal at risk?",
      undefined,
      undefined,
      ai,
    );
    expect(answer.citations[0].quote).toBe(quote);
    expect((await snapshot(ctx)).evidence).toHaveLength(1);
  });
});

describe("External source HTTP boundaries", () => {
  test("source endpoints reject signed-out and cross-origin requests", async () => {
    sessionUser = null;
    expect(
      (
        await sourceSettings.GET(
          new Request("http://localhost:3000/api/integrations/sources"),
        )
      ).status,
    ).toBe(401);
    expect(
      (await sourceSync.POST(request("/api/integrations/sources/sync", {})))
        .status,
    ).toBe(401);
    sessionUser = userOne;
    expect(
      (
        await sourceSettings.POST(
          request(
            "/api/integrations/sources",
            {},
            { origin: "https://attacker.example" },
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await sourceSync.POST(
          request(
            "/api/integrations/sources/sync",
            {},
            { "x-workspace-id": two.workspaceId },
          ),
        )
      ).status,
    ).toBe(403);
    sessionUser = null;
  });
  test("owner can verify, sync, retrieve an original source link, and disconnect without exposing the token", async () => {
    sessionUser = {
      sub: "auth0|github-http",
      email: "github@example.com",
      name: "GitHub HTTP",
    };
    const ctx = await resolveWorkspace(sessionUser);
    const oldFetch = globalThis.fetch;
    const token = "github-fixture-private-token";
    globalThis.fetch = (async (_, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        `Bearer ${token}`,
      );
      return Response.json([
        { number: 7, title: "Export problem", body, state: "open" },
      ]);
    }) as typeof fetch;
    try {
      const response = await sourceSettings.POST(
        request("/api/integrations/sources", {
          config: {
            provider: "github",
            repository: "example/customer-feedback",
            company: "Test account",
            domain: "account.example",
            label: "",
          },
          token,
        }),
      );
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(JSON.stringify(result)).not.toContain(token);
      const id = result.connections[0].id;
      expect(
        (
          await sourceSync.POST(
            request("/api/integrations/sources/sync", { id }),
          )
        ).status,
      ).toBe(200);
      const doc = (await snapshot(ctx)).evidence[0];
      const { sourceEvidence } = await import("../lib/evidence");
      expect((await sourceEvidence(ctx.workspaceId, doc.id))?.sourceUrl).toBe(
        "https://github.com/example/customer-feedback/issues/7",
      );
      expect(await sourceEvidence(two.workspaceId, doc.id)).toBeNull();
      expect(
        (
          await sourceSettings.DELETE(
            request("/api/integrations/sources", { id }),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await sourceSync.POST(
            request("/api/integrations/sources/sync", { id }),
          )
        ).status,
      ).toBe(404);
      expect((await snapshot(ctx)).evidence).toHaveLength(1);
    } finally {
      globalThis.fetch = oldFetch;
      sessionUser = null;
    }
  });
});

describe("Real workspace entry points", () => {
  test("signed-out pages redirect to Auth0, never sample data", async () => {
    sessionUser = null;
    const response = await proxy(
      new NextRequest("http://localhost:3000/accounts/acme.example"),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("returnTo")).toBe(
      "/accounts/acme.example",
    );
    await expect(pageData()).rejects.toThrow("NEXT_REDIRECT");
  });
  test("demo is explicitly public but its data API still requires a session", async () => {
    sessionUser = null;
    expect(
      (await proxy(new NextRequest("http://localhost:3000/demo/accounts")))
        .status,
    ).toBe(200);
    expect(
      (await proxy(new NextRequest("http://localhost:3000/api/uploads")))
        .status,
    ).toBe(401);
  });
  test("a new signed-in user gets an empty real workspace and private cache headers", async () => {
    sessionUser = {
      sub: "auth0|fresh-production-test",
      email: "fresh@example.com",
      name: "Fresh",
    };
    try {
      const data = await pageData();
      expect(data.demo).toBe(false);
      expect(data.data.accounts).toEqual([]);
      expect(data.data.evidence).toEqual([]);
      expect(data.owner).toBe(true);
      const response = await proxy(
        new NextRequest("http://localhost:3000/dashboard"),
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.cookies.get("session-test")?.value).toBe("rolled");
    } finally {
      sessionUser = null;
    }
  });
  test("production blocks incomplete configuration rather than pretending to work", async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = "production";
    try {
      const response = await proxy(
        new NextRequest("https://revenue.example.com/dashboard"),
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        error: "SERVICE_NOT_CONFIGURED",
      });
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
});
