type Environment = Record<string, string | undefined>;
export const serviceVariables = [
  "NEXT_PUBLIC_APP_URL",
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "TURSO_DATABASE_URL",
  "KEY_ENCRYPTION_SECRET",
  "CRON_SECRET",
] as const;

export function productionDeployment(env: Environment = process.env) {
  return env.VERCEL_ENV === "production" || env.APP_ENV === "production";
}

export function environmentProblems(env: Environment, production = true) {
  const problems: string[] = [];
  for (const key of serviceVariables)
    if (!env[key]?.trim()) problems.push(`Missing ${key}`);
  for (const key of ["AUTH0_SECRET", "KEY_ENCRYPTION_SECRET"])
    if (env[key] && !/^[0-9a-f]{64}$/i.test(env[key]!))
      problems.push(`${key} must be 64 hexadecimal characters`);
  if (env.AUTH0_SECRET && env.AUTH0_SECRET === env.KEY_ENCRYPTION_SECRET)
    problems.push("AUTH0_SECRET and KEY_ENCRYPTION_SECRET must be different");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 32)
    problems.push("CRON_SECRET must have at least 32 characters");
  if (
    env.AUTH0_DOMAIN &&
    !/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(env.AUTH0_DOMAIN)
  )
    problems.push(
      "AUTH0_DOMAIN must be a tenant hostname without a scheme or path",
    );
  if (env.NEXT_PUBLIC_APP_URL) {
    try {
      const url = new URL(env.NEXT_PUBLIC_APP_URL);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        problems.push(
          "NEXT_PUBLIC_APP_URL must be an origin without credentials, path, query, or fragment",
        );
      if (
        production &&
        (url.protocol !== "https:" ||
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
        problems.push(
          "Production NEXT_PUBLIC_APP_URL must be a public HTTPS origin",
        );
    } catch {
      problems.push("NEXT_PUBLIC_APP_URL must be a valid origin");
    }
  }
  if (env.TURSO_DATABASE_URL) {
    if (env.TURSO_DATABASE_URL.startsWith("file:")) {
      if (production)
        problems.push(
          "Production requires hosted Turso storage, not a local file",
        );
    } else {
      try {
        const url = new URL(env.TURSO_DATABASE_URL);
        if (
          !["libsql:", "https:"].includes(url.protocol) ||
          !url.hostname ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          problems.push("TURSO_DATABASE_URL must be a secure libSQL URL");
      } catch {
        problems.push("TURSO_DATABASE_URL must be a valid URL");
      }
      if (!env.TURSO_AUTH_TOKEN?.trim())
        problems.push("Missing TURSO_AUTH_TOKEN");
    }
  }
  return problems;
}
