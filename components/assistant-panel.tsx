"use client";
import { workspacePath } from "@/lib/workspace-path";
import { useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bookmark,
  Check,
  KeyRound,
  LoaderCircle,
  MessageSquare,
  Search,
  Share2,
  Trash2,
  Unlink,
} from "lucide-react";
import type { SavedQuery, SearchHit } from "@/lib/types";
import { api, errorMessage } from "./client-api";
import {
  assistantReducer,
  initialAssistantState,
  type EvidenceAnswer,
} from "@/lib/assistant-state";
export function AssistantPanel({
  demo,
  connected,
  domain,
  queries,
}: {
  demo: boolean;
  connected: boolean;
  domain?: string;
  queries: SavedQuery[];
}) {
  const [query, setQuery] = useState(""),
    [mode, setMode] = useState("ask"),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState("");
  const [state, dispatch] = useReducer(assistantReducer, initialAssistantState);
  const { busy, error, answer, hits } = state;
  const [saving, setSaving] = useState(false);
  const requestActive = useRef(false);
  const setError = (message: string) => dispatch({ type: "notice", message });
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (demo || !connected || requestActive.current || saving) return;
    const submittedQuery = query.trim();
    if (submittedQuery.length < 2) return;
    requestActive.current = true;
    dispatch({ type: "start", mode });
    setSaved(false);
    try {
      if (mode === "ask")
        dispatch({
          type: "answer",
          query: submittedQuery,
          result: await api<EvidenceAnswer>("/api/chat", {
            query: submittedQuery,
            domain,
            threadId: state.threadId || undefined,
          }),
        });
      else
        dispatch({
          type: "search",
          query: submittedQuery,
          hits: (
            await api<{ results: SearchHit[] }>("/api/search", {
              query: submittedQuery,
              domain,
            })
          ).results,
        });
    } catch (e) {
      dispatch({ type: "error", message: errorMessage(e) });
    } finally {
      requestActive.current = false;
    }
  }
  async function save() {
    if (demo || busy || saving || !answer || !state.answeredQuery) return;
    setSaving(true);
    try {
      await api("/api/queries", {
        query: state.answeredQuery,
        title: state.answeredQuery.slice(0, 100),
      });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  async function share(q: SavedQuery) {
    try {
      let token = q.shareToken;
      if (!token) {
        if (
          !window.confirm(
            "Create a public link to this question? Anyone with the link can read the question text. Customer evidence and answers will remain private.",
          )
        )
          return;
        token = (
          await api<{ shareToken: string }>(
            "/api/queries",
            { id: q.id, shared: true },
            "PATCH",
          )
        ).shareToken;
      }
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${token}`,
      );
      setCopied(q.id);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="assistant-section">
      <div className="section-heading">
        <h2>Ask your evidence</h2>
        <div className="segmented compact">
          <button
            disabled={busy || saving}
            onClick={() => setMode("ask")}
            aria-pressed={mode === "ask"}
          >
            <MessageSquare size={14} />
            Ask
          </button>
          <button
            disabled={busy || saving}
            onClick={() => setMode("search")}
            aria-pressed={mode === "search"}
          >
            <Search size={14} />
            Search
          </button>
        </div>
      </div>
      {!connected && (
        <div className="key-notice">
          <KeyRound size={18} />
          <p>
            {demo
              ? "Sign in and connect your AI key to ask questions about your own evidence."
              : "Connect your Nebius key to ask questions and search evidence."}
          </p>
          <Link href={workspacePath(demo, "/settings/ai")}>AI settings</Link>
        </div>
      )}
      <form className="question-form" onSubmit={submit}>
        <input
          aria-label="Question about customer evidence"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            domain
              ? "What should we discuss at the next account review?"
              : "Which renewals need attention, and why?"
          }
          minLength={2}
          maxLength={2000}
          required
          disabled={demo || !connected || busy || saving}
        />
        <button
          className="button primary square"
          title={mode === "ask" ? "Ask question" : "Search evidence"}
          aria-label={mode === "ask" ? "Ask question" : "Search evidence"}
          disabled={demo || !connected || busy || saving}
        >
          {busy ? (
            <LoaderCircle size={19} className="spin" />
          ) : (
            <ArrowUp size={20} />
          )}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {mode === "ask" && answer && (
        <div className="answer">
          <h3>{state.answeredQuery}</h3>
          <p>{answer.answer}</p>
          <div className="citation-list">
            {answer.citations.map((c, i) => (
              <Link href={`/evidence/${c.id}`} key={`${c.id}-${i}`}>
                <span className="citation-number">{i + 1}</span>
                <span>
                  <strong>{c.title}</strong>
                  <small>{c.quote}</small>
                </span>
              </Link>
            ))}
          </div>
          <div className="answer-actions">
            <button
              className="button"
              onClick={save}
              disabled={saved || saving || busy}
            >
              {saved ? <Check size={15} /> : <Bookmark size={15} />}{" "}
              {saved
                ? "Question saved"
                : saving
                  ? "Saving..."
                  : "Save question"}
            </button>
            <button
              className="button"
              disabled={busy || saving}
              onClick={() => {
                dispatch({ type: "reset" });
                setQuery("");
                setSaved(false);
              }}
            >
              New conversation
            </button>
          </div>
        </div>
      )}
      {mode === "search" && (
        <div className="citation-list">
          {state.searchedQuery !== null && (
            <p role="status" className="muted">
              {hits.length
                ? `${hits.length} results for "${state.searchedQuery}"`
                : `No matching evidence for "${state.searchedQuery}".`}
            </p>
          )}
          {hits.map((hit) => (
            <Link href={`/evidence/${hit.id}`} key={hit.id}>
              <Search size={17} />
              <span>
                <strong>{hit.title}</strong>
                <small>{hit.body}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
      {queries.length > 0 && (
        <div className="saved-queries">
          <h3>Saved questions</h3>
          {queries.map((q) => (
            <div className="saved-query" key={q.id}>
              <button
                className="text-button"
                disabled={busy || saving}
                onClick={() => {
                  setQuery(q.query);
                  dispatch({ type: "reset" });
                  setMode("ask");
                  setSaved(false);
                }}
              >
                <Bookmark size={15} />
                {q.title}
              </button>
              <div>
                <button
                  className="icon-button"
                  title={copied === q.id ? "Link copied" : "Share question"}
                  aria-label={`Share ${q.title}`}
                  onClick={() => share(q)}
                >
                  {copied === q.id ? <Check size={16} /> : <Share2 size={16} />}
                </button>
                {q.shareToken && (
                  <button
                    className="icon-button"
                    title="Revoke public link"
                    aria-label="Revoke public link"
                    onClick={async () => {
                      try {
                        await api(
                          "/api/queries",
                          { id: q.id, shared: false },
                          "PATCH",
                        );
                        router.refresh();
                      } catch (e) {
                        setError(errorMessage(e));
                      }
                    }}
                  >
                    <Unlink size={16} />
                  </button>
                )}
                <button
                  className="icon-button"
                  title="Delete saved question"
                  aria-label={`Delete ${q.title}`}
                  onClick={async () => {
                    try {
                      await api("/api/queries", { id: q.id }, "DELETE");
                      router.refresh();
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
