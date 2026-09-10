import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { isWorkspacePath } from "@/lib/workspace-path";
import { environmentProblems, productionDeployment } from "@/lib/environment";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const workspace = isWorkspacePath(path);
  const api = path.startsWith("/api/");
  if (
    productionDeployment() &&
    (workspace || api || path.startsWith("/auth/")) &&
    environmentProblems(process.env).length
  )
    return NextResponse.json(
      {
        error: "SERVICE_NOT_CONFIGURED",
        message: "The service is not ready. Please contact the operator.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  // This exact endpoint authenticates Tally's HMAC, not a browser session.
  if (
    /^\/api\/webhooks\/tally\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      path,
    )
  )
    return NextResponse.next();
  const client = auth0();
  if (!client) {
    if (
      api &&
      path !== "/api/health" &&
      path !== "/api/mcp" &&
      !path.startsWith("/api/cron/")
    )
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sign-in is not configured." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    if (workspace || path.startsWith("/auth/"))
      return NextResponse.redirect(new URL("/setup", request.url));
    return NextResponse.next();
  }
  const response = await client.middleware(request);
  if (
    workspace ||
    (api &&
      path !== "/api/mcp" &&
      path !== "/api/health" &&
      !path.startsWith("/api/cron/"))
  ) {
    if (!(await client.getSession(request))) {
      if (workspace) {
        const login = new URL("/auth/login", request.url);
        login.searchParams.set("returnTo", path + request.nextUrl.search);
        return NextResponse.redirect(login);
      }
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sign in to use your workspace." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
