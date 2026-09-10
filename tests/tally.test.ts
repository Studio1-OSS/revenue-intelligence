import { beforeAll, afterAll, test, expect } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { createHmac } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveWorkspace, rows, snapshot } from "../lib/db";
import {
  connectTally,
  disconnectTally,
  receiveTally,
  tallyStatus,
  verifyTallyPayload,
} from "../lib/integrations/tally";
import { decryptKey } from "../lib/crypto";
import type { WorkspaceContext } from "../lib/types";

let db: Client, directory: string;
let one: WorkspaceContext, two: WorkspaceContext;
let connectionId: string, secret: string;
const oldSecret = process.env.KEY_ENCRYPTION_SECRET;
const oldOrigin = process.env.NEXT_PUBLIC_APP_URL;
const event = (id = "submission-one", formId = "testForm") => ({
  eventId: `event-${id}`,
  eventType: "FORM_RESPONSE",
  data: {
    formId,
    submissionId: id,
    submissionPdfUrl: "https://private.example/?accessToken=do-not-store",
    fields: [
      { label: "Company", type: "INPUT_TEXT", value: "Test company" },
      { label: "Company domain", type: "INPUT_TEXT", value: "test.example" },
      {
        label: "Feedback",
        type: "TEXTAREA",
        value:
          "We cannot renew until the export failures are fixed. Please help our team.",
      },
      {
        label: "Email",
        type: "INPUT_EMAIL",
        value: "private-do-not-store@example.com",
      },
    ],
  },
});
const signed = (payload: unknown, signingSecret = secret) => ({
  body: JSON.stringify(payload),
  signature: createHmac("sha256", signingSecret)
    .update(JSON.stringify(payload))
    .digest("base64"),
});
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tally-tests-"));
  db = createClient({ url: `file:${join(directory, "test.db")}` });
  process.env.KEY_ENCRYPTION_SECRET = "ca".repeat(32);
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  for (const name of [
    "001_initial.sql",
    "002_health_triggers.sql",
    "003_qwen_embeddings.sql",
    "004_tally_integration.sql",
  ])
    await db.executeMultiple(
      await readFile(
        new URL(`../db/migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  one = await resolveWorkspace({ sub: "auth0|tally-one" }, null, db);
  two = await resolveWorkspace({ sub: "auth0|tally-two" }, null, db);
  const setup = await connectTally(one, { formId: "testForm" }, db);
  connectionId = setup.connection!.id;
  secret = setup.signingSecret;
});
afterAll(async () => {
  db.close();
  await rm(directory, { recursive: true, force: true });
  if (oldSecret === undefined) delete process.env.KEY_ENCRYPTION_SECRET;
  else process.env.KEY_ENCRYPTION_SECRET = oldSecret;
  if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = oldOrigin;
});

test("Tally setup is owner-only and stored secrets are tenant- and purpose-bound", async () => {
  await expect(
    connectTally({ ...two, role: "member" }, { formId: "testForm" }, db),
  ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
  await expect(
    disconnectTally({ ...one, role: "member" }, db),
  ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
  const [stored] = await rows<{ secret_ciphertext: string }>(
    "SELECT secret_ciphertext FROM tally_connections WHERE id=?",
    [connectionId],
    db,
  );
  expect(stored.secret_ciphertext).not.toContain(secret);
  expect(
    decryptKey(
      stored.secret_ciphertext,
      one.workspaceId,
      undefined,
      `tally:${connectionId}`,
    ),
  ).toBe(secret);
  expect(() =>
    decryptKey(
      stored.secret_ciphertext,
      two.workspaceId,
      undefined,
      `tally:${connectionId}`,
    ),
  ).toThrow();
  expect(() => decryptKey(stored.secret_ciphertext, one.workspaceId)).toThrow();
  expect(JSON.stringify(await tallyStatus(one, db))).not.toContain(secret);
  expect(JSON.stringify(await tallyStatus(one, db))).not.toContain(
    "ciphertext",
  );
  expect(await tallyStatus(two, db)).toBeNull();
  await expect(
    connectTally(one, { formId: "testForm" }, db),
  ).rejects.toMatchObject({ code: "ALREADY_CONNECTED" });
});
test("HMAC rejects unsigned, malformed, tampered, and foreign-secret deliveries", async () => {
  const { body, signature } = signed(event());
  for (const value of [
    null,
    "garbage",
    signature.replace(/^./, signature[0] === "A" ? "B" : "A"),
  ])
    await expect(
      receiveTally(connectionId, body, value, db),
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  await expect(
    receiveTally(
      connectionId,
      body.replace("Test company", "Other company"),
      signature,
      db,
    ),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  const wrong = signed(event(), "wrong-key");
  await expect(
    receiveTally(connectionId, wrong.body, wrong.signature, db),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  expect(
    verifyTallyPayload(JSON.stringify(event(), null, 2), signature, secret),
  ).toEqual(event());
  expect((await snapshot(one, db)).evidence).toEqual([]);
});
test("wrong form and ambiguous or incomplete field mappings are rejected", async () => {
  const wrongForm = signed(event("wrong", "otherForm"));
  await expect(
    receiveTally(connectionId, wrongForm.body, wrongForm.signature, db),
  ).rejects.toMatchObject({ code: "WRONG_FORM" });
  const duplicate = event("ambiguous");
  duplicate.data.fields.push(duplicate.data.fields[0]);
  const d = signed(duplicate);
  await expect(
    receiveTally(connectionId, d.body, d.signature, db),
  ).rejects.toMatchObject({ code: "INVALID_FIELDS" });
  const missing = event("missing");
  missing.data.fields.shift();
  const m = signed(missing);
  await expect(
    receiveTally(connectionId, m.body, m.signature, db),
  ).rejects.toThrow();
});
test("signed submission queues evidence only in its connection workspace without retaining extra PII", async () => {
  const payload = { ...event(), workspaceId: two.workspaceId };
  const { body, signature } = signed(payload);
  expect(await receiveTally(connectionId, body, signature, db)).toMatchObject({
    documents: 1,
    chunks: 1,
  });
  const data = await snapshot(one, db);
  expect(data.evidence).toHaveLength(1);
  expect(data.pending).toBe(1);
  expect(data.usage).toBe(0);
  expect(data.key).toBeNull();
  expect(data.evidence[0].source).toBe("Tally: testForm");
  expect(JSON.stringify(data)).not.toContain("do-not-store");
  expect((await snapshot(two, db)).evidence).toEqual([]);
  expect((await tallyStatus(one, db))!.lastReceivedAt).toBeTruthy();
});
test("submission IDs deduplicate retries even when Tally changes the event ID", async () => {
  const payload = { ...event(), eventId: "another-event-for-same-submission" };
  const { body, signature } = signed(payload);
  expect(await receiveTally(connectionId, body, signature, db)).toMatchObject({
    documents: 0,
    duplicate: true,
  });
  expect((await tallyStatus(one, db))!.importedCount).toBe(1);
  expect((await snapshot(one, db)).evidence).toHaveLength(1);
});
test("a failed import rolls back its receipt so the same submission can be retried", async () => {
  await db.executeMultiple(
    "CREATE TRIGGER fail_tally_import BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'test_failure'); END;",
  );
  const { body, signature } = signed(event("retry-me"));
  try {
    await expect(
      receiveTally(connectionId, body, signature, db),
    ).rejects.toThrow();
    expect(
      (
        await db.execute(
          "SELECT * FROM tally_receipts WHERE submission_id='retry-me'",
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.execute("DROP TRIGGER fail_tally_import");
  }
  expect(await receiveTally(connectionId, body, signature, db)).toMatchObject({
    documents: 1,
  });
});
test("receipt constraints reject another workspace", async () => {
  await expect(
    db.execute({
      sql: "INSERT INTO tally_receipts(workspace_id,connection_id,form_id,submission_id,event_id,received_at) VALUES(?,?, 'testForm','foreign','foreign','now')",
      args: [two.workspaceId, connectionId],
    }),
  ).rejects.toThrow();
});
test("disconnect blocks delivery; reconnect rotates credentials and preserves receipts", async () => {
  const old = signed(event());
  await disconnectTally(one, db);
  await expect(
    receiveTally(connectionId, old.body, old.signature, db),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const setup = await connectTally(one, { formId: "testForm" }, db);
  expect(setup.connection!.id).toBe(connectionId);
  expect(setup.signingSecret).not.toBe(secret);
  expect(setup.connection!.lastReceivedAt).toBeNull();
  await expect(
    receiveTally(connectionId, old.body, old.signature, db),
  ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  secret = setup.signingSecret;
  const retry = signed(event());
  expect(
    await receiveTally(connectionId, retry.body, retry.signature, db),
  ).toMatchObject({ duplicate: true });
  expect((await snapshot(one, db)).evidence).toHaveLength(2);
});
