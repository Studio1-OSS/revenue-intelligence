import { resolveWorkspace, database } from "../lib/db";
import { ingest } from "../lib/ingest";
import { sample } from "../lib/sample-data";
const sub = process.env.SEED_AUTH0_SUB;
if (!sub)
  throw new Error(
    "Set SEED_AUTH0_SUB to the Auth0 user who will own the sample workspace.",
  );
const ctx = await resolveWorkspace({ sub, name: "Sample" });
const existing = await database().execute({
  sql: "SELECT id FROM sources WHERE workspace_id=? AND kind='sample'",
  args: [ctx.workspaceId],
});
if (existing.rows.length) console.log("Sample evidence already present.");
else {
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
  );
  console.log("Sample evidence imported. Add your Nebius key to process it.");
}
database().close();
