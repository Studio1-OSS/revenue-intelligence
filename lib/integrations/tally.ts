import "server-only";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { database, rateLimit, requireOwner, rows } from "../db";
import { encryptKey, decryptKey } from "../crypto";
import { AppError } from "../errors";
import { documentInput, ingest } from "../ingest";
import type { WorkspaceContext } from "../types";

export const tallySetup = z.object({
  formId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{3,100}$/, "Enter the form ID from its Tally link."),
});
type Connection = {
  id: string;
  workspace_id: string;
  form_id: string;
  secret_ciphertext: string;
  enabled: number;
  last_received_at: string | null;
  imported_count: number;
};

export async function tallyStatus(ctx: WorkspaceContext, db = database()) {
  const [connection] = await rows<{
    id: string;
    formId: string;
    enabled: number;
    lastReceivedAt: string | null;
    importedCount: number;
  }>(
    "SELECT id,form_id AS formId,enabled,last_received_at AS lastReceivedAt,imported_count AS importedCount FROM tally_connections WHERE workspace_id=?",
    [ctx.workspaceId],
    db,
  );
  return connection
    ? {
        ...connection,
        enabled: Boolean(connection.enabled),
        endpoint: new URL(
          `/api/webhooks/tally/${connection.id}`,
          process.env.NEXT_PUBLIC_APP_URL,
        ).href,
      }
    : null;
}

export async function connectTally(
  ctx: WorkspaceContext,
  input: z.infer<typeof tallySetup>,
  db = database(),
) {
  requireOwner(ctx);
  const { formId } = tallySetup.parse(input);
  const [existing] = await rows<{ id: string }>(
    "SELECT id FROM tally_connections WHERE workspace_id=?",
    [ctx.workspaceId],
    db,
  );
  const id = existing?.id || randomUUID();
  const signingSecret = randomBytes(32).toString("base64url");
  const ciphertext = encryptKey(
    signingSecret,
    ctx.workspaceId,
    undefined,
    `tally:${id}`,
  );
  const result = await db.execute({
    sql: `INSERT INTO tally_connections(id,workspace_id,form_id,secret_ciphertext,created_at) VALUES(?,?,?,?,?)
      ON CONFLICT(workspace_id) DO UPDATE SET form_id=excluded.form_id,secret_ciphertext=excluded.secret_ciphertext,enabled=1,last_received_at=NULL
      WHERE tally_connections.enabled=0 AND tally_connections.id=excluded.id`,
    args: [id, ctx.workspaceId, formId, ciphertext, new Date().toISOString()],
  });
  if (!result.rowsAffected)
    throw new AppError(
      "ALREADY_CONNECTED",
      "Disconnect the existing form before replacing its settings.",
      409,
    );
  return { connection: await tallyStatus(ctx, db), signingSecret };
}

export async function disconnectTally(ctx: WorkspaceContext, db = database()) {
  requireOwner(ctx);
  await db.execute({
    sql: "UPDATE tally_connections SET enabled=0,secret_ciphertext='' WHERE workspace_id=?",
    args: [ctx.workspaceId],
  });
}

export function verifyTallyPayload(
  body: string,
  signature: string | null,
  secret: string,
): unknown {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature))
    throw new AppError(
      "INVALID_SIGNATURE",
      "Webhook signature is invalid.",
      401,
    );
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new AppError("INVALID_JSON", "Invalid webhook JSON.");
  }
  // Tally documents signing JSON.stringify(payload), before any schema transforms.
  const expected = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "base64")))
    throw new AppError(
      "INVALID_SIGNATURE",
      "Webhook signature is invalid.",
      401,
    );
  return payload;
}

const eventSchema = z.object({
  eventId: z.string().min(1).max(120),
  eventType: z.literal("FORM_RESPONSE"),
  data: z.object({
    formId: z.string().min(1).max(100),
    submissionId: z.string().min(1).max(120),
    fields: z
      .array(z.object({ label: z.string().max(500), value: z.unknown() }))
      .max(100),
  }),
});

export function tallyDocument(payload: unknown, formId: string) {
  const event = eventSchema.parse(payload);
  if (event.data.formId !== formId)
    throw new AppError(
      "WRONG_FORM",
      "This connection belongs to a different form.",
      403,
    );
  const fields = new Map<string, unknown>();
  const allowed = new Set(["company", "company domain", "feedback", "title"]);
  for (const field of event.data.fields) {
    const label = field.label.trim().toLowerCase();
    if (!allowed.has(label)) continue;
    if (fields.has(label))
      throw new AppError(
        "INVALID_FIELDS",
        `Use only one field named ${label}.`,
      );
    fields.set(label, field.value);
  }
  const document = documentInput.parse({
    company: fields.get("company"),
    domain: fields.get("company domain"),
    body: fields.get("feedback"),
    title: fields.get("title") || "Customer feedback via Tally",
  });
  return { event, document };
}

export async function receiveTally(
  id: string,
  body: string,
  signature: string | null,
  db = database(),
) {
  const [connection] = await rows<Connection>(
    "SELECT * FROM tally_connections WHERE id=? AND enabled=1",
    [id],
    db,
  );
  if (!connection)
    throw new AppError("NOT_FOUND", "Webhook connection is unavailable.", 404);
  const secret = decryptKey(
    connection.secret_ciphertext,
    connection.workspace_id,
    undefined,
    `tally:${id}`,
  );
  const payload = verifyTallyPayload(body, signature, secret);
  const { event, document } = tallyDocument(payload, connection.form_id);
  // Tenant identity comes exclusively from the verified connection, never the payload.
  const ctx: WorkspaceContext = {
    workspaceId: connection.workspace_id,
    userId: "",
    role: "member",
    email: "",
    name: "Tally",
    workspaceName: "",
  };
  await rateLimit(ctx, `tally:${id}`, 60, 60, db);
  return ingest(ctx, [document], `Tally: ${connection.form_id}`, "manual", db, {
    connectionId: id,
    formId: connection.form_id,
    submissionId: event.data.submissionId,
    eventId: event.eventId,
    ciphertext: connection.secret_ciphertext,
  });
}
