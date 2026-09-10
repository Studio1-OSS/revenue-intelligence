import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { environmentProblems } from "../lib/environment";
import { checkDatabaseReadiness, requiredMigrations } from "../lib/readiness";

const problems = environmentProblems(
  process.env,
  !process.argv.includes("--local"),
);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
let failed = false;
const issuer = `https://${process.env.AUTH0_DOMAIN}/`;
try {
  const response = await fetch(`${issuer}.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error();
  const discovery = await response.json();
  if (
    discovery.issuer !== issuer ||
    !discovery.authorization_endpoint ||
    !discovery.token_endpoint ||
    !discovery.jwks_uri
  )
    throw new Error();
  console.log(
    "PASS Auth0 tenant discovery. Client credentials and callbacks still require interactive login.",
  );
} catch {
  failed = true;
  console.error(
    "FAIL Auth0 discovery. Check the tenant hostname and network connection.",
  );
}
const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const timeout = setTimeout(() => {
  console.error("FAIL Turso check timed out.");
  process.exit(1);
}, 20_000);
try {
  await checkDatabaseReadiness(db);
  const result = await db.execute(
    "SELECT name,checksum FROM schema_migrations",
  );
  for (const name of requiredMigrations) {
    const sql = await readFile(
      new URL(`../db/migrations/${name}`, import.meta.url),
      "utf8",
    );
    if (
      result.rows.find((row) => row.name === name)?.checksum !==
      createHash("sha256").update(sql).digest("hex")
    )
      throw new Error();
  }
  console.log(
    "PASS Turso connection, migration checksums, schema, FTS, and native vectors.",
  );
} catch {
  failed = true;
  console.error(
    "FAIL Turso readiness. Check the database URL/token and run db:migrate. No private database values printed.",
  );
} finally {
  clearTimeout(timeout);
  db.close();
}
console.log(
  "Nebius: verify a workspace key in /settings/ai after Auth0 login. This command never makes billable AI requests.",
);
process.exitCode = failed ? 1 : 0;
