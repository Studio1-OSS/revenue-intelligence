"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { api, errorMessage } from "./client-api";

type Connection = {
  id: string;
  formId: string;
  enabled: boolean;
  endpoint: string;
  lastReceivedAt: string | null;
  importedCount: number;
};

export function TallySettings({
  demo,
  owner,
}: {
  demo: boolean;
  owner: boolean;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [formId, setFormId] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [loaded, setLoaded] = useState(demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (demo) return;
    let active = true;
    api<{ connection: Connection | null }>(
      "/api/integrations/tally",
      undefined,
      "GET",
    )
      .then((result) => {
        if (active) {
          setConnection(result.connection);
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

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ connection: Connection | null }>(
        "/api/integrations/tally",
        undefined,
        "GET",
      );
      setConnection(result.connection);
      setLoaded(true);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (demo || !owner || busy || !loaded) return;
    setBusy(true);
    setError("");
    setNotice("");
    setSigningSecret("");
    try {
      const result = await api<{
        connection: Connection;
        signingSecret: string;
      }>("/api/integrations/tally", { formId });
      setConnection(result.connection);
      setSigningSecret(result.signingSecret);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (
      demo ||
      !owner ||
      busy ||
      !window.confirm(
        "Stop receiving Tally submissions? Imported evidence is kept. Reconnecting creates a new signing secret.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/integrations/tally", undefined, "DELETE");
      setConnection((value) => (value ? { ...value, enabled: false } : null));
      setSigningSecret("");
      setNotice("Disconnected. Previously imported evidence is unchanged.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
      setError("");
    } catch {
      setError("Clipboard access is unavailable. Select the field to copy it.");
    }
  }
  const enabled = Boolean(connection?.enabled);
  const local =
    connection && new URL(connection.endpoint).protocol !== "https:";
  return (
    <section className="tally-integration" aria-labelledby="tally-heading">
      <div className="tally-intro">
        <div className="tally-wordmark">
          Tally<span className="badge neutral">Feedback forms</span>
        </div>
        <h2 id="tally-heading">Hear from your customers.</h2>
        <p>Form responses become account evidence. No CRM required.</p>
        <dl className="tally-field-list">
          <div>
            <dt>Company</dt>
            <dd>Short answer</dd>
          </div>
          <div>
            <dt>Company domain</dt>
            <dd>Short answer, e.g. shopify.com</dd>
          </div>
          <div>
            <dt>Feedback</dt>
            <dd>Long answer, 20-20,000 characters</dd>
          </div>
        </dl>
        <p className="muted">
          Required field labels must match the names above. Optional: Title.
          Other fields and attachments are not imported.
        </p>
        <a
          href="https://tally.so/help/webhooks"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          Tally webhook setup <ExternalLink size={14} />
        </a>
      </div>
      <div className="tally-controls">
        <div className="section-heading">
          <span
            className={`badge ${enabled && connection?.lastReceivedAt ? "green" : "neutral"}`}
          >
            {demo
              ? "Available after sign-in"
              : loading
                ? "Loading connection"
                : enabled
                  ? connection?.lastReceivedAt
                    ? "Receiving submissions"
                    : "Awaiting first submission"
                  : "Not connected"}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Refresh Tally connection"
            title="Refresh Tally connection"
            onClick={refresh}
            disabled={demo || busy || loading}
          >
            <RefreshCw size={16} className={busy ? "spin" : ""} />
          </button>
        </div>
        {!enabled ? (
          <form className="form-stack" onSubmit={connect}>
            <label>
              Tally form ID
              <input
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="VwbNEw"
                required
                minLength={3}
                maxLength={100}
                pattern="[a-zA-Z0-9_\-]{3,100}"
                disabled={demo || !owner || busy || !loaded}
              />
            </label>
            <p className="muted">
              The final part of your published form link: tally.so/r/
              <strong>VwbNEw</strong>
            </p>
            <button
              className="button primary"
              disabled={demo || !owner || busy || !loaded}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Link2 size={16} />
              )}
              Set up connection
            </button>
          </form>
        ) : (
          <div className="form-stack">
            <label>
              Webhook endpoint
              <div className="tally-copy-field">
                <input readOnly value={connection!.endpoint} />
                <button
                  type="button"
                  className="icon-button"
                  title="Copy webhook endpoint"
                  aria-label="Copy webhook endpoint"
                  onClick={() => copy(connection!.endpoint, "Endpoint")}
                >
                  <Copy size={16} />
                </button>
              </div>
            </label>
            {local && (
              <p className="form-message">
                Local setup only. Tally needs a public HTTPS endpoint. Deploy
                the app before adding this URL to Tally.
              </p>
            )}
            {signingSecret ? (
              <>
                <label>
                  Signing secret
                  <div className="tally-copy-field">
                    <input
                      type="password"
                      readOnly
                      value={signingSecret}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      title="Copy Tally signing secret"
                      aria-label="Copy Tally signing secret"
                      onClick={() => copy(signingSecret, "Signing secret")}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </label>
                <p className="muted">
                  Shown once. Add this secret and endpoint in Tally under
                  Integrations &gt; Webhooks. Both are required.
                </p>
              </>
            ) : (
              owner && (
                <p className="muted">
                  Signing secret is stored encrypted. To replace a lost secret,
                  disconnect and reconnect this form.
                </p>
              )
            )}
            <div className="tally-delivery">
              <span>
                Form <strong>{connection!.formId}</strong>
              </span>
              <span>
                <strong>{connection!.importedCount}</strong> imported overall
              </span>
              <span>
                Last received:{" "}
                {connection!.lastReceivedAt
                  ? new Date(connection!.lastReceivedAt).toLocaleString()
                  : "None yet"}
              </span>
            </div>
            <button
              className="button"
              type="button"
              onClick={disconnect}
              disabled={!owner || busy}
            >
              <Unplug size={16} />
              Disconnect
            </button>
          </div>
        )}
        {!demo && !owner && (
          <p className="muted">
            Only the workspace owner can configure this connection.
          </p>
        )}
        <p className="muted">
          New responses are queued as evidence. AI processing uses your
          workspace&apos;s Nebius key.
        </p>
        {error && (
          <p role="alert" className="form-message error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="form-message success">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
