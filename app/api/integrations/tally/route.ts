import { context, json, jsonBody, route } from "@/lib/http";
import { rateLimit, requireOwner } from "@/lib/db";
import {
  connectTally,
  disconnectTally,
  tallySetup,
  tallyStatus,
} from "@/lib/integrations/tally";

export const GET = route(async (request) =>
  json({ connection: await tallyStatus(await context(request)) }),
);
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  requireOwner(ctx);
  await rateLimit(ctx, "tally-settings", 10);
  return json(
    await connectTally(ctx, await jsonBody(request, tallySetup)),
    201,
  );
});
export const DELETE = route(async (request) => {
  await disconnectTally(await context(request, true));
  return json({ disconnected: true });
});
