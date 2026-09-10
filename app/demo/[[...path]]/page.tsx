import Link from "next/link";
import { notFound } from "next/navigation";
import { Workspace, type View } from "@/components/workspace";
import { AssistantPanel } from "@/components/assistant-panel";
import { AISettings } from "@/components/ai-settings";
import { DataSettings } from "@/components/data-settings";
import { MCPSettings } from "@/components/mcp-settings";
import { sample } from "@/lib/sample-data";
import { authConfigured } from "@/lib/auth0";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sample workspace",
  robots: { index: false, follow: false },
};

export default async function Demo({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const route = path.join("/");
  const views: Record<string, View> = {
    "": "dashboard",
    dashboard: "dashboard",
    accounts: "accounts",
    signals: "signals",
    competitors: "competitors",
    "settings/ai": "ai",
    "settings/data": "data",
    "settings/mcp": "mcp",
  };
  let view = views[route];
  let domain: string | undefined;
  let source: (typeof sample.evidence)[number] | undefined;
  if (path.length === 2 && path[0] === "accounts") {
    domain = path[1];
    if (!sample.accounts.some((a) => a.domain === domain)) notFound();
    view = "account";
  }
  if (path.length === 2 && path[0] === "evidence") {
    source = sample.evidence.find((e) => e.id === path[1]);
    if (!source) notFound();
    view = "data";
  }
  if (!view) notFound();
  return (
    <Workspace
      view={view}
      domain={domain}
      data={sample}
      demo
      authConfigured={authConfigured()}
    >
      {source ? (
        <article className="source-document">
          <Link className="text-link" href={`/demo/accounts/${source.domain}`}>
            {source.company}
          </Link>
          <h2>{source.title}</h2>
          <p className="muted">
            {source.source} · {source.createdAt}
          </p>
          <div>{source.body}</div>
        </article>
      ) : (
        <>
          {(view === "dashboard" || view === "account") && (
            <AssistantPanel
              key={domain || "dashboard"}
              demo
              connected={false}
              domain={domain}
              queries={[]}
            />
          )}
          {view === "ai" && (
            <AISettings demo owner={false} providerKey={null} usage={0} />
          )}
          {view === "data" && <DataSettings demo owner={false} data={sample} />}
          {view === "mcp" && (
            <MCPSettings
              endpoint={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp`}
              configured={false}
            />
          )}
        </>
      )}
    </Workspace>
  );
}
