"use client";
import { useState } from "react";
import { Check, Clock3, Copy, Link2, ShieldCheck } from "lucide-react";
export function MCPSettings({
  endpoint,
  configured,
  enabled = false,
}: {
  endpoint: string;
  configured: boolean;
  enabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const active = enabled && configured;
  return (
    <div className="settings-grid">
      <section>
        <div className="provider-heading">
          {active ? <Link2 size={26} /> : <Clock3 size={26} />}
          <div>
            <h2>MCP access</h2>
            <p className="muted">
              {active
                ? "MCP · Streamable HTTP"
                : "Coming soon · external agent access"}
            </p>
          </div>
          <span className={`badge ${active ? "green" : "amber-badge"}`}>
            {active ? "Available" : "Coming soon"}
          </span>
        </div>
        {!active && (
          <p className="form-message">
            MCP is intentionally inactive for this launch. The workspace app,
            integrations, BYOK AI, evidence processing, search, and cited
            answers are the active prototype surface.
          </p>
        )}
        <label className="endpoint-label">
          Server URL
          <div className="endpoint">
            <code>{endpoint}</code>
            <button
              className="icon-button"
              title="Copy MCP URL"
              aria-label="Copy MCP URL"
              disabled={!active}
              onClick={async () => {
                if (!active) return;
                try {
                  await navigator.clipboard.writeText(endpoint);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
          </div>
        </label>
        <h3 className="mcp-tools-heading">Available tools</h3>
        <dl className="tool-list">
          <dt>search_evidence</dt>
          <dd>
            Find relevant customer conversations. Uses your Nebius key for query
            embeddings.
          </dd>
          <dt>get_source</dt>
          <dd>Read the complete source behind a search result or signal.</dd>
          <dt>list_accounts</dt>
          <dd>Find accounts by company name or domain.</dd>
          <dt>account_overview</dt>
          <dd>
            Read account health, revenue, renewal dates, and open signals.
          </dd>
        </dl>
      </section>
      <aside className="settings-aside">
        <ShieldCheck size={24} />
        <h3>{active ? "Authorized workspace access" : "Developer preview"}</h3>
        <p>
          {active
            ? "Use an Auth0 user access token for this app with the read:insights scope. Your agent can access only workspaces you belong to."
            : "MCP will use Auth0 user access tokens and workspace-scoped permissions when enabled."}
        </p>
        <p>
          The connector uses bearer-token authentication. Your browser login
          cookie and Nebius key are not MCP access tokens.
        </p>
        {!active && (
          <p className="form-message">
            External MCP clients are disabled until the production Auth0 API
            audience, OAuth client, and client compatibility tests are complete.
          </p>
        )}
      </aside>
    </div>
  );
}
