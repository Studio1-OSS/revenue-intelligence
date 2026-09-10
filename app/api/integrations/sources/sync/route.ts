import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { requireOwner, rateLimit } from "@/lib/db";
import { syncExternal } from "@/lib/integrations/external";
export const maxDuration = 300;
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  await rateLimit(ctx, "external-sync", 10);
  const { id } = await jsonBody(request, z.object({ id: z.string().uuid() }));
  return json(await syncExternal(ctx, id));
});
