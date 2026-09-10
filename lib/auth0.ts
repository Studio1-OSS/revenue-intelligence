import "server-only";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
export function authConfigured() {
  return [
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ].every((k) => Boolean(process.env[k]));
}
let instance: Auth0Client | undefined;
export function auth0() {
  if (!authConfigured()) return null;
  instance ??= new Auth0Client({
    appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
    signInReturnToPath: "/dashboard",
    enableAccessTokenEndpoint: false,
    authorizationParameters: {
      scope: "openid profile email",
    },
  });
  return instance;
}
