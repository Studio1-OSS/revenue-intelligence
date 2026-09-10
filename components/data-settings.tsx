"use client";
import { workspacePath } from "@/lib/workspace-path";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  FileText,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { api, errorMessage } from "./client-api";
import { processingMessage } from "@/lib/processing-result";
import { TallySettings } from "./tally-settings";
import { ExternalSettings } from "./external-settings";
export function DataSettings({
  demo,
  owner,
  data,
}: {
  demo: boolean;
  owner: boolean;
  data: Snapshot;
}) {
  const [mode, setMode] = useState("csv"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [selectedFile, setSelectedFile] = useState<File | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function run(task: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      setMessage(await task());
    } catch (error) {
      setMessage(errorMessage(error));
      setFailed(true);
    } finally {
      router.refresh();
      setBusy(false);
    }
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (mode === "csv") {
        if (!selectedFile) throw new Error("Choose a CSV file.");
        if (selectedFile.size > 2_000_000)
          throw new Error("Choose a CSV smaller than 2 MB.");
        const response = await fetch("/api/uploads", {
          method: "POST",
          headers: { "Content-Type": "text/csv" },
          body: selectedFile,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setSelectedFile(null);
        if (file.current) file.current.value = "";
        return `${result.documents} documents imported. Ready for AI processing.`;
      }
      const fields = new FormData(form.current!);
      const result = await api<{ documents: number }>(
        "/api/uploads",
        Object.fromEntries(fields.entries()),
      );
      form.current?.reset();
      return `${result.documents} document imported. Ready for AI processing.`;
    });
  }
  async function process() {
    await run(async () => {
      let processed = 0,
        failures = 0,
        remaining = 0;
      for (let batch = 0; batch < 10; batch++) {
        const result = await api<{
          processed: number;
          failed: number;
          remaining: number;
        }>("/api/process", { retry: batch === 0 });
        processed += result.processed;
        failures += result.failed;
        remaining = result.remaining;
        setMessage(`Processed ${processed} chunks. ${remaining} remaining…`);
        if (!remaining || result.failed) break;
      }
      return processingMessage(processed, failures, remaining);
    });
  }
  return (
    <>
      <div className="library-summary" aria-label="Evidence totals">
        <div>
          <span>Source documents</span>
          <strong>{data.evidence.length}</strong>
        </div>
        <div>
          <span>Ready to query</span>
          <strong>
            {data.evidence.filter((e) => e.status === "ready").length}
          </strong>
        </div>
        <div>
          <span>Chunks to process</span>
          <strong>{data.pending}</strong>
        </div>
      </div>
      <ExternalSettings demo={demo} owner={owner} />
      <TallySettings demo={demo} owner={owner} />
      <div className="import-layout">
        <section>
          <div className="section-heading">
            <h2>Add customer evidence</h2>
          </div>
          <div className="segmented">
            {["csv", "manual"].map((m) => (
              <button
                key={m}
                disabled={busy}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                {m === "csv" ? "CSV upload" : "Manual evidence"}
              </button>
            ))}
          </div>
          <form className="form-stack" ref={form} onSubmit={upload}>
            {mode === "csv" ? (
              <>
                <label className="drop-zone">
                  <span className="upload-symbol">
                    <Upload size={22} strokeWidth={1.5} />
                  </span>
                  <strong>
                    {selectedFile
                      ? selectedFile.name
                      : "Choose customer evidence"}
                  </strong>
                  <span>CSV · Up to 100 rows · 2 MB maximum</span>
                  <input
                    ref={file}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) =>
                      setSelectedFile(e.target.files?.[0] || null)
                    }
                    disabled={demo || busy}
                    aria-label="Choose CSV evidence file"
                  />
                </label>
                <a className="text-link" download href="/evidence-template.csv">
                  <Download size={15} />
                  Download CSV template
                </a>
              </>
            ) : (
              <>
                <div className="form-two">
                  <label>
                    Company
                    <input
                      name="company"
                      placeholder="Shopify"
                      required
                      maxLength={120}
                      disabled={demo || busy}
                    />
                  </label>
                  <label>
                    Company domain
                    <input
                      name="domain"
                      placeholder="shopify.com"
                      required
                      maxLength={253}
                      disabled={demo || busy}
                    />
                  </label>
                </div>
                <label>
                  Evidence title
                  <input
                    name="title"
                    placeholder="Renewal check-in"
                    required
                    maxLength={200}
                    disabled={demo || busy}
                  />
                </label>
                <label>
                  Customer evidence
                  <textarea
                    name="body"
                    placeholder="Meeting notes, customer email, or support conversation…"
                    rows={6}
                    minLength={20}
                    maxLength={20000}
                    required
                    disabled={demo || busy}
                  />
                </label>
                <div className="form-two">
                  <label>
                    Annual revenue (USD)
                    <input
                      type="number"
                      name="arr"
                      min={0}
                      max={1_000_000_000}
                      defaultValue={0}
                      disabled={demo || busy}
                    />
                  </label>
                  <label>
                    Renewal date
                    <input type="date" name="renewal" disabled={demo || busy} />
                  </label>
                </div>
                <label>
                  Account owner
                  <input name="owner" maxLength={120} disabled={demo || busy} />
                </label>
              </>
            )}
            <button
              className="button primary"
              disabled={demo || busy || (mode === "csv" && !selectedFile)}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Plus size={17} />
              )}
              Import evidence
            </button>
          </form>
        </section>
        <aside className="settings-aside">
          <span className={`badge ${data.pending ? "amber-badge" : "neutral"}`}>
            {data.pending ? "Processing needed" : "No pending work"}
          </span>
          <h3>Evidence processing</h3>
          <p>{data.pending} chunks waiting for processing or retry.</p>
          <p>
            Processing creates embeddings and detects account signals. Your
            Nebius account is charged for these AI requests.
          </p>
          {data.key ? (
            <button
              className="button primary"
              disabled={demo || busy || !data.pending}
              onClick={process}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Process evidence
            </button>
          ) : (
            <Link href={workspacePath(demo, "/settings/ai")} className="button">
              Connect your AI key
            </Link>
          )}
          <div className="aside-divider" />
          <h3>Start with sample evidence</h3>
          <p>
            Import synthetic scenarios using real company names. These are not
            actual customer conversations or commercial figures.
          </p>
          <button
            className="button"
            disabled={demo || busy}
            onClick={() =>
              run(async () => {
                await api("/api/sample");
                return "Sample evidence imported. Process it to detect signals.";
              })
            }
          >
            <Plus size={16} />
            Load sample evidence
          </button>
        </aside>
      </div>
      {message && (
        <p
          role="status"
          className={`form-message ${failed ? "error" : "success"}`}
        >
          {message}
        </p>
      )}
      {demo && (
        <p className="form-message">
          Sign in to import evidence into your own workspace.
        </p>
      )}
      <section>
        <div className="section-heading">
          <h2>
            Source documents{" "}
            <span className="count">{data.evidence.length}</span>
          </h2>
          <button
            className="icon-button"
            title="Refresh evidence"
            aria-label="Refresh evidence"
            onClick={() => router.refresh()}
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Account</th>
                <th>Source</th>
                <th>Status</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.evidence.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={workspacePath(demo, `/evidence/${e.id}`)}
                      className="evidence-count"
                    >
                      <FileText size={15} />
                      {e.title}
                    </Link>
                  </td>
                  <td>{e.company}</td>
                  <td>{e.source}</td>
                  <td>
                    <span
                      className={`badge ${e.status === "ready" ? "green" : e.status === "failed" ? "red" : "amber-badge"}`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td>{e.createdAt.slice(0, 10)}</td>
                  <td>
                    <button
                      disabled={demo || !owner || busy}
                      className="icon-button"
                      title="Delete document"
                      aria-label={`Delete ${e.title}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Delete this document, its embeddings, and detected signals?",
                          )
                        )
                          run(async () => {
                            await api("/api/uploads", { id: e.id }, "DELETE");
                            return "Document deleted.";
                          });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.evidence.length && (
            <p className="empty">No source documents yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
