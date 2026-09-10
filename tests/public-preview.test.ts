import { expect, test } from "bun:test";
import { environmentProblems, publicPreviewOnly, serviceVariables } from "../lib/environment";

test("credential-free preview permits only absent service configuration", () => {
  expect(publicPreviewOnly({})).toBe(true);
  expect(publicPreviewOnly({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_URL: "https://example.com" })).toBe(true);
  for (const key of [...serviceVariables, "TURSO_AUTH_TOKEN", "AUTH0_AUDIENCE"].filter(key => key !== "NEXT_PUBLIC_APP_URL")) {
    expect(publicPreviewOnly({ [key]: "configured" })).toBe(false);
  }
});

test("preview does not bypass runtime service validation", () => {
  expect(environmentProblems({}).length).toBeGreaterThan(0);
  expect(environmentProblems({ AUTH0_DOMAIN: "example.auth0.com" }).length).toBeGreaterThan(0);
});
