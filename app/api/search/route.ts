import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { rateLimit } from "@/lib/db";
import { searchEvidence } from "@/lib/ai/chat";
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "search");
  const { query, domain } = await jsonBody(
    request,
    z.object({
      query: z.string().trim().min(2).max(2000),
      domain: z.string().max(253).optional(),
    }),
  );
  return json({ results: await searchEvidence(ctx, query, domain) });
});
