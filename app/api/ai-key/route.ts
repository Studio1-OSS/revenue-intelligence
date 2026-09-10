import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { database, rateLimit, requireOwner, rows } from "@/lib/db";
import { encryptKey, decryptKey } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { CHAT_MODEL_IDS } from "@/lib/ai/models";
import { Nebius, EMBEDDING_MODEL } from "@/lib/ai/nebius";
import { metered } from "@/lib/ai/service";
export const maxDuration = 120;
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  await rateLimit(ctx, "key-verification", 5, 3600);
  const { key: suppliedKey, model } = await jsonBody(
    request,
    z.object({
      key: z
        .union([z.string().trim().min(16).max(4096), z.literal("")])
        .optional(),
      model: z.enum(CHAT_MODEL_IDS),
    }),
  );
  let key = suppliedKey;
  if (!key) {
    const [stored] = await rows<{ ciphertext: string }>(
      "SELECT ciphertext FROM ai_provider_keys WHERE workspace_id=?",
      [ctx.workspaceId],
    );
    if (!stored)
      throw new AppError(
        "AI_KEY_REQUIRED",
        "Add your Nebius key before verifying a model.",
        402,
      );
    key = decryptKey(stored.ciphertext, ctx.workspaceId);
  }
  const ciphertext = encryptKey(key, ctx.workspaceId);
  const ai = new Nebius(key, model);
  await metered(ctx, "key-verification", EMBEDDING_MODEL, () =>
    ai.embed(["Verify workspace AI connection."]),
  );
  await metered(ctx, "key-verification", model, () =>
    ai.complete(
      'Return JSON {"connected":true}.',
      "Verify connection.",
      true,
      1024,
    ),
  );
  await database().execute({
    sql: "INSERT INTO ai_provider_keys(workspace_id,ciphertext,hint,model,verified_at,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET ciphertext=excluded.ciphertext,hint=excluded.hint,model=excluded.model,verified_at=excluded.verified_at,updated_by=excluded.updated_by",
    args: [
      ctx.workspaceId,
      ciphertext,
      key.slice(-4),
      model,
      new Date().toISOString(),
      ctx.userId,
    ],
  });
  return json({ verified: true });
});
export const DELETE = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  await database().execute({
    sql: "DELETE FROM ai_provider_keys WHERE workspace_id=?",
    args: [ctx.workspaceId],
  });
  return json({ removed: true });
});
export const GET = route(async (request) => {
  const ctx = await context(request);
  const [key] = await rows(
    "SELECT hint,model,verified_at AS verifiedAt FROM ai_provider_keys WHERE workspace_id=?",
    [ctx.workspaceId],
  );
  return json({ key: key || null });
});
