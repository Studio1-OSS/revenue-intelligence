import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/db";
import { processPending } from "@/lib/ai/pipeline";
export const maxDuration = 300;
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "processing", 30);
  const { retry } = await jsonBody(
    request,
    z.object({ retry: z.boolean().optional() }),
  );
  return json(await processPending(ctx, { retry }));
});
