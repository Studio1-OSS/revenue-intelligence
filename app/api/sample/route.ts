import { context, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/db";
import { ingest } from "@/lib/ingest";
import { sample } from "@/lib/sample-data";
export const POST = route(async (request) => {
  const ctx = await context(request, true);
  await rateLimit(ctx, "sample-import", 1, 3600);
  return json(
    await ingest(
      ctx,
      sample.evidence.map((e) => {
        const a = sample.accounts.find((a) => a.domain === e.domain)!;
        return {
          company: e.company,
          domain: e.domain,
          title: e.title,
          body: e.body,
          arr: a.arr,
          owner: a.owner,
          renewal: a.renewal,
        };
      }),
      "Sample evidence",
      "sample",
    ),
    201,
  );
});
