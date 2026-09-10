import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth0 } from "./auth0";
import { resolveWorkspace, snapshot } from "./db";
export const pageData = cache(async () => {
  const client = auth0();
  if (!client) redirect("/setup");
  const session = await client.getSession();
  if (!session) redirect("/auth/login?returnTo=/dashboard");
  const ctx = await resolveWorkspace(session.user);
  return {
    data: await snapshot(ctx),
    demo: false,
    authConfigured: true,
    name: ctx.workspaceName,
    owner: ctx.role === "owner",
  };
});
