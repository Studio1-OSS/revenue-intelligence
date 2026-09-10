import "server-only";
import { randomUUID } from "node:crypto";
import { database, rows } from "../db";
import { decryptKey } from "../crypto";
import { AppError } from "../errors";
import type { WorkspaceContext } from "../types";
import { Nebius } from "./nebius";

export async function workspaceAI(ctx: WorkspaceContext) {
  const [key] = await rows<{ ciphertext: string; model: string }>(
    "SELECT ciphertext,model FROM ai_provider_keys WHERE workspace_id=?",
    [ctx.workspaceId],
  );
  if (!key)
    throw new AppError(
      "AI_KEY_REQUIRED",
      "Add and verify a Nebius key before using AI.",
      402,
    );
  return new Nebius(decryptKey(key.ciphertext, ctx.workspaceId), key.model);
}
export async function metered<T extends { tokens: number }>(
  ctx: WorkspaceContext,
  operation: string,
  model: string,
  call: () => Promise<T>,
): Promise<T> {
  const id = randomUUID();
  await database().execute({
    sql: "INSERT INTO usage_events(id,workspace_id,user_id,operation,model,status,created_at) VALUES(?,?,?,?,?,'started',?)",
    args: [
      id,
      ctx.workspaceId,
      ctx.userId,
      operation,
      model,
      new Date().toISOString(),
    ],
  });
  try {
    const result = await call();
    await database().execute({
      sql: "UPDATE usage_events SET tokens=?,status='success' WHERE id=? AND workspace_id=?",
      args: [result.tokens, id, ctx.workspaceId],
    });
    return result;
  } catch (error) {
    await database().execute({
      sql: "UPDATE usage_events SET status='failed' WHERE id=? AND workspace_id=?",
      args: [id, ctx.workspaceId],
    });
    throw error;
  }
}
