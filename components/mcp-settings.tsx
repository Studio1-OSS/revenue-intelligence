"use client";
import { useState } from "react";
import { Check, Copy, Link2, ShieldCheck } from "lucide-react";
export function MCPSettings({
  endpoint,
  configured,
}: {
  endpoint: string;
  configured: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="settings-grid">
      <section>
        <div className="provider-heading">
          <Link2 size={26} />
          <div>
            <h2>Connect your agent</h2>
            <p className="muted">MCP · Streamable HTTP</p>
          </div>
          <span className={`badge ${configured ? "green" : "amber-badge"}`}>
            {configured ? "Configured" : "Setup required"}
          </span>
        </div>
        <label className="endpoint-label">
          Server URL
          <div className="endpoint">
            <code>{endpoint}</code>
            <button
              className="icon-button"
              title="Copy MCP URL"
              aria-label="Copy MCP URL"
              onClick={async () => {
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
        <h3>Authorized workspace access</h3>
        <p>
          Use an Auth0 user access token for this app with the read:insights
          scope. Your agent can access only workspaces you belong to.
        </p>
        <p>
          The connector uses bearer-token authentication. Your browser login
          cookie and Nebius key are not MCP access tokens.
        </p>
        {!configured && (
          <p className="form-message">
            Your administrator needs to configure the Auth0 API audience and
            OAuth client before external agents can connect.
          </p>
        )}
      </aside>
    </div>
  );
}
