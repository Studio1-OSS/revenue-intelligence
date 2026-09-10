import { database } from "@/lib/db";
import { environmentProblems, productionDeployment } from "@/lib/environment";
import { checkDatabaseReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
let cache: { ready: boolean; expires: number } | undefined;

export async function GET() {
  if (!cache || cache.expires < Date.now()) {
    let ready = false;
    if (
      !environmentProblems(
        process.env,
        productionDeployment() || process.env.NODE_ENV === "production",
      ).length
    ) {
      try {
        await checkDatabaseReadiness(database());
        ready = true;
      } catch {
        /* Only readiness, never connection details, is public. */
      }
    }
    cache = { ready, expires: Date.now() + 15_000 };
  }
  return Response.json(
    { status: cache.ready ? "ready" : "not_ready" },
    {
      status: cache.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
