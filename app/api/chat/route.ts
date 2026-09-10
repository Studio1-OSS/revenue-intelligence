import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { rateLimit, rows } from "@/lib/db";
import { answerQuestion } from "@/lib/ai/chat";
export const maxDuration = 120;
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "chat", 10);
  const { query, domain, threadId } = await jsonBody(
    request,
    z.object({
      query: z.string().trim().min(2).max(2000),
      domain: z.string().max(253).optional(),
      threadId: z.string().uuid().optional(),
    }),
  );
  return json(await answerQuestion(ctx, query, domain, threadId));
});
export const GET = route(async (request) => {
  const ctx = await context(request);
  return json({
    threads: await rows(
      "SELECT id,title,created_at AS createdAt FROM chat_threads WHERE workspace_id=? AND user_id=? ORDER BY created_at DESC LIMIT 50",
      [ctx.workspaceId, ctx.userId],
    ),
  });
});
