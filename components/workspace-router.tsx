"use client";

import { usePathname } from "next/navigation";
import { Workspace, type View } from "./workspace";
import type { Snapshot } from "@/lib/types";

function workspaceView(pathname: string): { view: View; domain?: string } {
  const path = pathname.replace(/\/$/, "") || "/dashboard";
  const account = path.match(/^\/accounts\/([^/]+)$/);
  if (account) {
    return { view: "account", domain: decodeURIComponent(account[1]) };
  }
  if (path === "/accounts") return { view: "accounts" };
  if (path === "/signals") return { view: "signals" };
  if (path === "/competitors") return { view: "competitors" };
  if (path === "/settings/ai") return { view: "ai" };
  if (path === "/settings/data" || path.startsWith("/evidence/")) {
    return { view: "data" };
  }
  if (path === "/settings/mcp") return { view: "mcp" };
  return { view: "dashboard" };
}

export function WorkspaceRouter({
  data,
  demo,
  authConfigured,
  name,
  children,
}: {
  data: Snapshot;
  demo: boolean;
  authConfigured: boolean;
  name?: string;
  children: React.ReactNode;
}) {
  const { view, domain } = workspaceView(usePathname());
  return (
    <Workspace
      view={view}
      data={data}
      demo={demo}
      authConfigured={authConfigured}
      name={name}
      domain={domain}
    >
      {children}
    </Workspace>
  );
}
