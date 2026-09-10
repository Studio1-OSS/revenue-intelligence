import { describe, expect, test } from "bun:test";
import { environmentProblems, productionDeployment } from "../lib/environment";
import { isWorkspacePath, workspacePath } from "../lib/workspace-path";
import { checkDatabaseReadiness } from "../lib/readiness";
import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const env = {
  NEXT_PUBLIC_APP_URL: "https://revenue.example.com",
  AUTH0_DOMAIN: "tenant.us.auth0.com",
  AUTH0_CLIENT_ID: "test-id",
  AUTH0_CLIENT_SECRET: "test-secret",
  AUTH0_SECRET: "a1".repeat(32),
  KEY_ENCRYPTION_SECRET: "b2".repeat(32),
  CRON_SECRET: "c".repeat(40),
  TURSO_DATABASE_URL: "libsql://revenue.example.turso.io",
  TURSO_AUTH_TOKEN: "test-token",
};
describe("Production configuration", () => {
  test("accepts a hosted configuration without making MCP mandatory for login", () => {
    expect(environmentProblems(env)).toEqual([]);
  });
  test("rejects absent secrets, reused encryption keys, and local production storage", () => {
    expect(environmentProblems({})).toContain("Missing AUTH0_CLIENT_SECRET");
    expect(
      environmentProblems({ ...env, TURSO_DATABASE_URL: "file:local.db" }).join(
        " ",
      ),
    ).toContain("hosted Turso");
    expect(
      environmentProblems({
        ...env,
        KEY_ENCRYPTION_SECRET: env.AUTH0_SECRET,
      }).join(" "),
    ).toContain("must be different");
    expect(environmentProblems({ ...env, TURSO_AUTH_TOKEN: "" })).toContain(
      "Missing TURSO_AUTH_TOKEN",
    );
  });
  test("rejects unsafe origins and insecure database protocols", () => {
    for (const value of [
      "https://user:password@example.com",
      "https://example.com/path",
      "http://example.com",
      "https://localhost",
      "not a url",
    ])
      expect(
        environmentProblems({ ...env, NEXT_PUBLIC_APP_URL: value }).length,
      ).toBeGreaterThan(0);
    expect(
      environmentProblems({
        ...env,
        TURSO_DATABASE_URL: "http://database.example.com",
      }).length,
    ).toBeGreaterThan(0);
  });
  test("allows explicit local checks but recognizes production deployments", () => {
    expect(
      environmentProblems(
        {
          ...env,
          NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          TURSO_DATABASE_URL: "file:local.db",
          TURSO_AUTH_TOKEN: "",
        },
        false,
      ),
    ).toEqual([]);
    expect(
      productionDeployment({
        VERCEL_ENV: "production",
        APP_ENV: "development",
      }),
    ).toBe(true);
    expect(productionDeployment({ APP_ENV: "production" })).toBe(true);
    expect(productionDeployment({ VERCEL_ENV: "preview" })).toBe(false);
  });
});
describe("Demo separation", () => {
  test("maps only workspace links into the explicit demo", () => {
    expect(workspacePath(true, "/dashboard")).toBe("/demo");
    expect(workspacePath(true, "/accounts/acme.example")).toBe(
      "/demo/accounts/acme.example",
    );
    expect(workspacePath(true, "/settings/ai")).toBe("/demo/settings/ai");
    expect(workspacePath(false, "/dashboard")).toBe("/dashboard");
    expect(workspacePath(true, "/auth/login")).toBe("/auth/login");
    expect(workspacePath(true, "/api/uploads")).toBe("/api/uploads");
    expect(isWorkspacePath("/demo/accounts")).toBe(false);
    expect(isWorkspacePath("/accounts-fake")).toBe(false);
    expect(isWorkspacePath("/evidence/abc")).toBe(true);
  });
});
test("database readiness fails before migrations and validates a migrated libSQL database", async () => {
  const db = createClient({ url: "file::memory:" });
  try {
    await expect(checkDatabaseReadiness(db)).rejects.toThrow();
    for (const name of [
      "001_initial.sql",
      "002_health_triggers.sql",
      "003_qwen_embeddings.sql",
      "004_tally_integration.sql",
      "005_external_sources.sql",
    ])
      await db.executeMultiple(
        await readFile(
          new URL(`../db/migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    await db.execute("CREATE TABLE schema_migrations(name TEXT PRIMARY KEY)");
    await db.execute("INSERT INTO schema_migrations VALUES('001_initial.sql')");
    await expect(checkDatabaseReadiness(db)).rejects.toThrow(
      "MIGRATIONS_PENDING",
    );
    await db.execute(
      "INSERT INTO schema_migrations VALUES('002_health_triggers.sql')",
    );
    await expect(checkDatabaseReadiness(db)).rejects.toThrow(
      "MIGRATIONS_PENDING",
    );
    await db.execute(
      "INSERT INTO schema_migrations VALUES('003_qwen_embeddings.sql')",
    );
    await expect(checkDatabaseReadiness(db)).rejects.toThrow(
      "MIGRATIONS_PENDING",
    );
    await db.execute(
      "INSERT INTO schema_migrations VALUES('004_tally_integration.sql')",
    );
    await expect(checkDatabaseReadiness(db)).rejects.toThrow(
      "MIGRATIONS_PENDING",
    );
    await db.execute(
      "INSERT INTO schema_migrations VALUES('005_external_sources.sql')",
    );
    await checkDatabaseReadiness(db);
  } finally {
    db.close();
  }
});
