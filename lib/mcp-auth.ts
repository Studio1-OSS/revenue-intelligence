import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AppError } from "./errors";
import { resolveWorkspace } from "./db";
let remote: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function verifyBearer(
  token: string,
  domain: string,
  audience: string,
  key?: JWTVerifyGetKey | CryptoKey,
) {
  try {
    const { payload } = await jwtVerify(
      token,
      key ||
        (remote ??= createRemoteJWKSet(
          new URL(`https://${domain}/.well-known/jwks.json`),
        )),
      {
        issuer: `https://${domain}/`,
        audience,
        algorithms: ["RS256"],
        requiredClaims: ["sub", "exp", "iat"],
      },
    );
    if (!payload.sub || payload.sub.endsWith("@clients"))
      throw new Error("User token required");
    const scopes =
      typeof payload.scope === "string" ? payload.scope.split(" ") : [];
    if (!scopes.includes("read:insights"))
      throw new AppError(
        "INSUFFICIENT_SCOPE",
        "The read:insights scope is required.",
        403,
      );
    return { sub: payload.sub };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UNAUTHORIZED", "Invalid or expired access token.", 401);
  }
}
export async function mcpContext(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new AppError(
      "UNAUTHORIZED",
      "An Auth0 bearer token is required.",
      401,
    );
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_AUDIENCE)
    throw new AppError(
      "MCP_NOT_CONFIGURED",
      "MCP authentication is not configured.",
      503,
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.NEXT_PUBLIC_APP_URL!).origin)
    throw new AppError("INVALID_ORIGIN", "Request origin is not allowed.", 403);
  const user = await verifyBearer(
    authorization.slice(7),
    process.env.AUTH0_DOMAIN,
    process.env.AUTH0_AUDIENCE,
  );
  return resolveWorkspace(user, request.headers.get("x-workspace-id"));
}
