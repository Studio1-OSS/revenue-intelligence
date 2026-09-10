import { z } from "zod";
import { context, json, jsonBody, route } from "@/lib/http";
import { requireOwner, rateLimit } from "@/lib/db";
import {
  connectExternal,
  disconnectExternal,
  externalStatus,
} from "@/lib/integrations/external";
import { sourceSetup } from "@/lib/integrations/external-providers";
export const maxDuration = 60;
export const GET = route(async (request) =>
  json({ connections: await externalStatus(await context(request)) }),
);
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  await rateLimit(ctx, "external-settings", 10);
  return json(
    await connectExternal(ctx, await jsonBody(request, sourceSetup)),
    201,
  );
});
export const DELETE = route(async (request) => {
  const ctx = await context(request, true);
  const { id } = await jsonBody(request, z.object({ id: z.string().uuid() }));
  await disconnectExternal(ctx, id);
  return json({ disconnected: true });
});
