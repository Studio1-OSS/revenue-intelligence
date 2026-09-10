"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { api, errorMessage } from "./client-api";

type Config =
  | {
      provider: "github";
      repository: string;
      company: string;
      domain: string;
      label: string;
    }
  | { provider: "airtable"; baseId: string; tableId: string };
type Connection = {
  id: string;
  config: Config;
  enabled: boolean;
  hasToken: boolean;
  hasMore: boolean;
  lastSyncedAt: string | null;
  documents: number;
};

export function ExternalSettings({
  demo,
  owner,
}: {
  demo: boolean;
  owner: boolean;
}) {
  const [provider, setProvider] = useState<"github" | "airtable">("github");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(!demo),
    [loaded, setLoaded] = useState(demo);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const endpoint = "/api/integrations/sources";
  useEffect(() => {
    if (demo) return;
    let active = true;
    api<{ connections: Connection[] }>(endpoint, undefined, "GET")
      .then((result) => {
        if (active) {
          setConnections(result.connections);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo]);
  async function reload() {
    const result = await api<{ connections: Connection[] }>(
      endpoint,
      undefined,
      "GET",
    );
    setConnections(result.connections);
    setLoaded(true);
  }
  async function run(task: () => Promise<void>) {
    if (demo || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!owner || !loaded) return;
    const values = Object.fromEntries(new FormData(form.current!).entries());
    const config =
      provider === "github"
        ? {
            provider,
            repository: values.repository,
            company: values.company,
            domain: values.domain,
            label: values.label,
          }
        : { provider, baseId: values.baseId, tableId: values.tableId };
    await run(async () => {
      try {
        const result = await api<{ connections: Connection[] }>(endpoint, {
          config,
          token: values.token,
        });
        setConnections(result.connections);
        form.current?.reset();
        setMessage(
          "Read access verified. Select Sync to import the first batch. No AI calls were made.",
        );
      } finally {
        const token = form.current?.elements.namedItem("token");
        if (token instanceof HTMLInputElement) token.value = "";
      }
    });
  }
  async function sync(connection: Connection) {
    if (!owner) return;
    await run(async () => {
      const result = await api<{
        imported: number;
        updated: number;
        unchanged: number;
        skipped: number;
        truncated: number;
        hasMore: boolean;
      }>(`${endpoint}/sync`, { id: connection.id });
      setMessage(
        `${result.imported} added, ${result.updated} updated, ${result.unchanged} unchanged. ${result.skipped} pull requests excluded. ${result.truncated} long records truncated. ${result.hasMore ? "More records are available: sync the next batch." : "Scan complete."} New or updated evidence needs AI processing.`,
      );
      await reload();
    });
  }
  async function disconnect(connection: Connection) {
    if (
      !owner ||
      !window.confirm(
        "Disconnect this source and remove its saved token? Imported evidence will remain.",
      )
    )
      return;
    await run(async () => {
      await api(endpoint, { id: connection.id }, "DELETE");
      await reload();
      setMessage("Source disconnected. Imported evidence is unchanged.");
    });
  }
  const disabled = demo || !owner || busy || loading || !loaded;
  return (
    <section
      className="external-integrations"
      aria-labelledby="external-heading"
    >
      <div className="section-heading">
        <h2 id="external-heading">Connected sources</h2>
        <button
          className="icon-button"
          title="Refresh connected sources"
          aria-label="Refresh connected sources"
          disabled={demo || busy || loading}
          onClick={() => run(reload)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="source-setup">
        <div className="source-description">
          <div className="segmented" aria-label="Source provider">
            <button
              type="button"
              aria-pressed={provider === "github"}
              disabled={busy}
              onClick={() => {
                setProvider("github");
                setError("");
              }}
            >
              GitHub Issues
            </button>
            <button
              type="button"
              aria-pressed={provider === "airtable"}
              disabled={busy}
              onClick={() => {
                setProvider("airtable");
                setError("");
              }}
            >
              Airtable
            </button>
          </div>
          <h3>
            {provider === "github"
              ? "Customer issues, in context."
              : "Your customer feedback table."}
          </h3>
          <p>
            {provider === "github"
              ? "Import issue titles, descriptions, and open/closed state. Public repositories do not need a token. Private access needs a fine-grained token with Issues: read permission for the selected repository."
              : "Import feedback from one Airtable table. Use a personal access token with data.records:read, restricted to that base."}
          </p>
          {provider === "github" ? (
            <p className="form-message">
              All imported issues will belong to the account you specify. Use a
              customer-specific repository or label; GitHub usernames do not
              identify customer companies. Comments and pull requests are
              excluded.
            </p>
          ) : (
            <dl className="tally-field-list">
              <div>
                <dt>Company</dt>
                <dd>Company name</dd>
              </div>
              <div>
                <dt>Company domain</dt>
                <dd>e.g. shopify.com</dd>
              </div>
              <div>
                <dt>Feedback</dt>
                <dd>Text, at least 20 characters</dd>
              </div>
              <div>
                <dt>Title</dt>
                <dd>Optional text</dd>
              </div>
            </dl>
          )}
          <p className="muted">
            Manual sync, 20 source records per batch. Tokens stay encrypted on
            the server. Importing does not call AI or write back to the source.
          </p>
          <a
            className="text-link"
            target="_blank"
            rel="noreferrer"
            href={
              provider === "github"
                ? "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
                : "https://support.airtable.com/docs/creating-personal-access-tokens"
            }
          >
            Read-only token setup <ExternalLink size={14} />
          </a>
        </div>
        <form
          key={provider}
          ref={form}
          className="form-stack source-connect-form"
          onSubmit={connect}
        >
          <span className="badge neutral">
            {demo
              ? "Available after sign-in"
              : loading
                ? "Loading connections"
                : "Read-only import"}
          </span>
          {provider === "github" ? (
            <>
              <label>
                Repository
                <input
                  name="repository"
                  placeholder="your-company/customer-feedback"
                  required
                  maxLength={140}
                  disabled={disabled}
                />
              </label>
              <div className="form-two">
                <label>
                  Customer company
                  <input
                    name="company"
                    required
                    maxLength={120}
                    placeholder="Customer company"
                    disabled={disabled}
                  />
                </label>
                <label>
                  Company domain
                  <input
                    name="domain"
                    required
                    maxLength={253}
                    placeholder="customer.com"
                    disabled={disabled}
                  />
                </label>
              </div>
              <label>
                Customer label (optional)
                <input
                  name="label"
                  maxLength={100}
                  placeholder="customer-acme"
                  disabled={disabled}
                />
              </label>
              <label className="source-consent">
                <input type="checkbox" required disabled={disabled} />
                These issues belong to this customer account.
              </label>
            </>
          ) : (
            <div className="form-two">
              <label>
                Base ID
                <input
                  name="baseId"
                  required
                  placeholder="app..."
                  maxLength={17}
                  disabled={disabled}
                />
              </label>
              <label>
                Table ID
                <input
                  name="tableId"
                  required
                  placeholder="tbl..."
                  maxLength={17}
                  disabled={disabled}
                />
              </label>
            </div>
          )}
          <label>
            {provider === "github"
              ? "Access token (optional for public repositories)"
              : "Personal access token"}
            <input
              name="token"
              type="password"
              autoComplete="off"
              required={provider === "airtable"}
              maxLength={1000}
              disabled={disabled}
            />
          </label>
          <button className="button primary" disabled={disabled}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Link2 size={16} />
            )}
            Verify connection
          </button>
          {!owner && !demo && (
            <p className="muted">
              Only the workspace owner can connect or sync sources.
            </p>
          )}
        </form>
      </div>
      {connections.length > 0 && (
        <div className="source-connections">
          {connections.map((connection) => (
            <article className="source-connection" key={connection.id}>
              <div>
                <h3>
                  {connection.config.provider === "github"
                    ? connection.config.repository
                    : `Airtable ${connection.config.tableId}`}
                </h3>
                <p>
                  {connection.config.provider === "github"
                    ? `${connection.config.company} (${connection.config.domain})${connection.config.label ? ` / label: ${connection.config.label}` : ""}`
                    : connection.config.baseId}
                </p>
                <p>
                  {connection.documents} documents ·{" "}
                  {connection.lastSyncedAt
                    ? `Last batch: ${new Date(connection.lastSyncedAt).toLocaleString()}`
                    : "Not synced yet"}
                </p>
              </div>
              <div className="source-actions">
                <span
                  className={`badge ${connection.enabled ? "green" : "neutral"}`}
                >
                  {connection.enabled
                    ? connection.hasMore
                      ? "More to sync"
                      : "Access verified"
                    : "Disconnected"}
                </span>
                <button
                  className="button"
                  disabled={!owner || busy || !connection.enabled}
                  onClick={() => sync(connection)}
                >
                  <RefreshCw size={15} />
                  {connection.hasMore ? "Sync next batch" : "Sync"}
                </button>
                <button
                  className="icon-button"
                  title="Disconnect source"
                  aria-label={`Disconnect ${connection.config.provider === "github" ? connection.config.repository : connection.config.tableId}`}
                  disabled={!owner || busy || !connection.enabled}
                  onClick={() => disconnect(connection)}
                >
                  <Unplug size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-message success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
