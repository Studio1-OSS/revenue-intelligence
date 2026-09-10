"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, isChatModel } from "@/lib/ai/models";
import { api, errorMessage } from "./client-api";
export function AISettings({
  demo,
  owner,
  providerKey,
  usage,
}: {
  demo: boolean;
  owner: boolean;
  providerKey: Snapshot["key"];
  usage: number;
}) {
  const [key, setKey] = useState("");
  const [model, setModel] = useState<string>(
    providerKey && isChatModel(providerKey.model)
      ? providerKey.model
      : DEFAULT_CHAT_MODEL,
  );
  const needsVerification = !!providerKey && !isChatModel(providerKey.model);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      await api("/api/ai-key", { key, model });
      setKey("");
      setMessage("Your Nebius key is verified and connected.");
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !window.confirm(
        "Disconnect Nebius? New AI requests will stop until a key is added. Requests already running may finish.",
      )
    )
      return;
    setBusy(true);
    try {
      await api("/api/ai-key", undefined, "DELETE");
      setMessage("AI provider disconnected.");
      setSuccess(true);
      router.refresh();
    } catch (e) {
      setMessage(errorMessage(e));
      setSuccess(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="settings-primary">
        <div className="provider-heading">
          <span className="provider-mark">N</span>
          <div>
            <h2>Nebius Token Factory</h2>
            <p className="muted">Workspace AI provider</p>
          </div>
          <span className={`badge ${providerKey ? "green" : "neutral"}`}>
            {needsVerification
              ? "Verify model"
              : providerKey
                ? "Connected"
                : "Not connected"}
          </span>
        </div>
        {providerKey && (
          <div className="connected-strip">
            <CheckCircle2 size={18} />
            <span>
              Key ending in {providerKey.hint}
              <small>Verified {providerKey.verifiedAt.slice(0, 10)}</small>
            </span>
            <button
              title="Disconnect provider"
              aria-label="Disconnect provider"
              className="icon-button"
              disabled={busy || !owner}
              onClick={remove}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
        <form onSubmit={save} className="form-stack">
          {needsVerification && (
            <p className="form-message">
              Your previous model is no longer supported. Select and verify a
              Nemotron model to resume AI.
            </p>
          )}
          <label>
            Nebius API key
            <input
              type="password"
              autoComplete="new-password"
              name="nebius-key"
              placeholder={
                providerKey
                  ? "Leave blank to keep your saved key"
                  : "Paste your API key"
              }
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required={!providerKey}
              minLength={16}
              maxLength={4096}
              disabled={demo || !owner || busy}
            />
          </label>
          <label>
            Chat model
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              required
              disabled={!demo && (!owner || busy)}
            >
              {CHAT_MODELS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>
              {CHAT_MODELS.find((option) => option.id === model)?.region}
            </small>
          </label>
          <p className="muted">
            Verification makes a small embedding and chat request billed to your
            Nebius account. All future AI usage is billed directly by Nebius.
          </p>
          <button className="button primary" disabled={demo || !owner || busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <KeyRound size={17} />
            )}{" "}
            {busy
              ? "Verifying connection…"
              : providerKey
                ? "Verify and save"
                : "Verify and connect"}
          </button>
          {message && (
            <p
              role="status"
              className={`form-message ${success ? "success" : "error"}`}
            >
              {message}
            </p>
          )}
          {demo && (
            <p className="form-message">
              Sign in to connect your own workspace.
            </p>
          )}
          {!demo && !owner && (
            <p className="form-message">
              Only your workspace owner can change the AI provider.
            </p>
          )}
        </form>
      </section>
      <aside className="settings-aside">
        <ShieldCheck size={23} />
        <h3>Strict bring your own key</h3>
        <p>
          Chat, search embeddings, and signal detection use your workspace’s
          key. No shared AI account or fallback provider is used.
        </p>
        <h3>Search embeddings</h3>
        <p>
          Qwen3-Embedding-8B, 1,536 dimensions. Embeddings use the global Nebius
          endpoint, including when chat uses US Central.
        </p>
        <LockKeyhole size={22} />
        <h3>Private by default</h3>
        <p>
          Your key is encrypted on the server. Workspace members can use AI, but
          cannot read the stored key.
        </p>
        <div className="usage-total">
          <span>Recorded AI tokens</span>
          <strong>{usage.toLocaleString()}</strong>
          <small>
            All-time workspace usage. Check Nebius for billing and final
            charges.
          </small>
        </div>
        <a
          href="https://tokenfactory.nebius.com/"
          target="_blank"
          rel="noreferrer"
          className="text-link"
        >
          Open Nebius Token Factory
        </a>
      </aside>
    </div>
  );
}
