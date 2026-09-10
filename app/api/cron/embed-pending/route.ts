import { json, route } from "@/lib/http";
import { database, rows } from "@/lib/db";
import { validSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { processPending } from "@/lib/ai/pipeline";
import { CHAT_MODEL_IDS } from "@/lib/ai/models";
import type { WorkspaceContext } from "@/lib/types";
export const maxDuration = 300;
export const GET = route(async (request) => {
  if (
    !validSecret(
      request.headers.get("authorization"),
      process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : undefined,
    )
  )
    throw new AppError("UNAUTHORIZED", "Invalid cron authorization.", 401);
  const candidates = await rows<WorkspaceContext>(
    `SELECT w.id AS workspaceId,w.name AS workspaceName,m.user_id AS userId,m.role,u.email,u.name FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id AND m.role='owner' JOIN users u ON u.id=m.user_id JOIN ai_provider_keys k ON k.workspace_id=w.id WHERE k.model IN (?,?) AND EXISTS(SELECT 1 FROM chunks c WHERE c.workspace_id=w.id AND c.status='pending') AND NOT EXISTS(SELECT 1 FROM workspace_jobs j WHERE j.workspace_id=w.id AND j.expires_at>?) ORDER BY (SELECT MAX(created_at) FROM usage_events e WHERE e.workspace_id=w.id) ASC LIMIT 1`,
    [...CHAT_MODEL_IDS, Date.now()],
  );
  if (!candidates.length) return json({ processed: 0, failed: 0 });
  return json(await processPending(candidates[0]));
});
