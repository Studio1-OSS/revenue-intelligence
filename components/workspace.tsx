"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "./dialog";
import { Brand } from "./brand";
import { api, errorMessage } from "./client-api";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Settings2,
  Cable,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Snapshot, Signal } from "@/lib/types";
import { workspacePath } from "@/lib/workspace-path";
import { DEMO_DISCLAIMER } from "@/lib/sample-data";
import { PortfolioHealth } from "./portfolio-health";
import { visibleAccounts } from "@/lib/account-view";

export type View =
  | "dashboard"
  | "accounts"
  | "account"
  | "signals"
  | "competitors"
  | "ai"
  | "data"
  | "mcp";
export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}
export function Workspace({
  view,
  data,
  demo,
  authConfigured,
  domain,
  name = "Sample workspace",
  children,
}: {
  view: View;
  data: Snapshot;
  demo: boolean;
  authConfigured: boolean;
  domain?: string;
  name?: string;
  children?: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [accountScope, setAccountScope] = useState("all");
  const [accountSort, setAccountSort] = useState("health");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState<Signal | null>(null);
  const [signalBusy, setSignalBusy] = useState(false);
  const [signalError, setSignalError] = useState("");
  const router = useRouter();
  const href = (path: string) => workspacePath(demo, path);
  const links = [
    {
      view: "dashboard",
      href: "/dashboard",
      label: "Overview",
      icon: LayoutDashboard,
    },
    { view: "accounts", href: "/accounts", label: "Accounts", icon: Building2 },
    { view: "signals", href: "/signals", label: "Signals", icon: Activity },
    {
      view: "competitors",
      href: "/competitors",
      label: "Competitors",
      icon: Radar,
    },
  ];
  const account = data.accounts.find((a) => a.domain === domain);
  const accounts = visibleAccounts(
    data.accounts,
    filter,
    accountScope,
    accountSort,
  );
  const openSignals = data.signals.filter((s) => s.status === "open");
  const signals = data.signals.filter(
    (s) =>
      (kind === "all" || s.kind === kind) && (!domain || s.domain === domain),
  );
  const total = data.accounts.reduce((n, a) => n + a.arr, 0);
  const risk = data.accounts
    .filter((a) => a.health <= 60)
    .reduce((n, a) => n + a.arr, 0);
  const titles: Record<View, string> = {
    dashboard: "Account overview",
    accounts: "Accounts",
    account: account?.name || "Account",
    signals: "Signal inbox",
    competitors: "Competitive landscape",
    ai: "AI provider",
    data: "Evidence library",
    mcp: "MCP access",
  };
  return (
    <div className="app-shell">
      <aside
        id="workspace-navigation"
        className={`sidebar ${navOpen ? "is-open" : ""}`}
      >
        <Link href="/" className="brand" aria-label="Revenue-Intelligence home">
          <Brand />
        </Link>
        <div className="workspace-name">
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span>
            {name}
            <small>{demo ? "Sample data" : "Your workspace"}</small>
          </span>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Workspace">
          {links.map((l) => (
            <Link
              key={l.view}
              className={
                view === l.view || (view === "account" && l.view === "accounts")
                  ? "active"
                  : ""
              }
              href={href(l.href)}
              aria-current={
                view === l.view || (view === "account" && l.view === "accounts")
                  ? "page"
                  : undefined
              }
              onClick={() => setNavOpen(false)}
            >
              <l.icon size={18} />
              {l.label}
              {l.view === "signals" && (
                <span className="nav-count">
                  {data.signals.filter((s) => s.status === "open").length}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <span className="nav-label settings-label">MANAGE</span>
        <nav aria-label="Workspace settings" onClick={() => setNavOpen(false)}>
          <Link
            href={href("/settings/data")}
            className={view === "data" ? "active" : ""}
          >
            <Database size={18} />
            Evidence library
          </Link>
          <Link
            href={href("/settings/ai")}
            className={view === "ai" ? "active" : ""}
          >
            <KeyRound size={18} />
            Nebius AI key{!data.key && <span className="status-dot amber" />}
          </Link>
          <Link
            href={href("/settings/mcp")}
            className={view === "mcp" ? "active" : ""}
          >
            <Cable size={18} />
            MCP access
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span>Your data. Your AI key.</span>
          </div>
          <a
            className="profile"
            href={
              demo
                ? authConfigured
                  ? "/auth/login?returnTo=/dashboard"
                  : "/setup"
                : "/settings/ai"
            }
          >
            <span className="avatar">{demo ? "S" : name[0]}</span>
            <span>
              {demo ? "Sample workspace" : name}
              <small>
                {demo ? "Sign in to start your workspace" : "AI settings"}
              </small>
            </span>
            {demo ? <LogIn size={17} /> : <Settings2 size={17} />}
          </a>
          {!demo && (
            <a className="profile-signout" href="/auth/logout">
              <LogOut size={15} /> Sign out
            </a>
          )}
        </div>
      </aside>
      {navOpen && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            aria-controls="workspace-navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            Workspace <ChevronRight size={14} />
            <span>{titles[view]}</span>
          </div>
          <div className="topbar-actions">
            <span className={`badge ${data.key ? "green" : "neutral"}`}>
              <span className="status-dot" />
              {data.key ? "AI connected" : "AI not connected"}
            </span>
            <Link
              href={href("/settings/ai")}
              className="icon-button"
              aria-label="AI settings"
              title="AI settings"
            >
              <Settings2 size={19} />
            </Link>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="status-dot amber" /> Read-only demo{" "}
                <span className="banner-detail">
                  Synthetic account scenarios.
                </span>
              </span>
              <a
                href={
                  authConfigured
                    ? "/auth/login?screen_hint=signup&returnTo=/dashboard"
                    : "/setup"
                }
              >
                Create your workspace <ArrowRight size={15} />
              </a>
            </div>
          )}
          {demo && <p className="demo-disclaimer">{DEMO_DISCLAIMER}</p>}
          <div className="page-heading">
            <div>
              <h1>{titles[view]}</h1>
              <p className="muted">
                {view === "dashboard"
                  ? "The accounts and conversations that need your attention."
                  : view === "accounts"
                    ? `${data.accounts.length} accounts in your workspace`
                    : view === "signals"
                      ? "Revenue changes, grounded in customer evidence."
                      : view === "competitors"
                        ? "Alternatives appearing in your customer conversations."
                        : view === "account"
                          ? account?.domain
                          : view === "ai"
                            ? "Connect your Nebius Token Factory account."
                            : view === "mcp"
                              ? "Secure access for your AI tools and assistants."
                              : "Customer conversations, notes, and source documents."}
              </p>
            </div>
            {!["ai", "data", "mcp"].includes(view) && (
              <Link className="button primary" href={href("/settings/data")}>
                <Plus size={17} />
                Add evidence
              </Link>
            )}
          </div>
          {view === "dashboard" && (
            <>
              <div className="metric-grid">
                <Metric
                  label="Tracked revenue"
                  value={money(total)}
                  note={`${data.accounts.length} active accounts`}
                />
                <Metric
                  label="Revenue at risk"
                  value={money(risk)}
                  note={`${data.accounts.filter((a) => a.health <= 60).length} accounts need attention`}
                  tone="red"
                />
                <Metric
                  label="Expansion signals"
                  value={String(
                    data.signals.filter(
                      (s) => s.kind === "expansion" && s.status === "open",
                    ).length,
                  )}
                  note="New opportunities to follow up"
                  tone="green"
                />
                <Metric
                  label="Evidence coverage"
                  value={`${data.accounts.length ? Math.round((data.accounts.filter((a) => a.evidenceCount > 0).length / data.accounts.length) * 100) : 0}%`}
                  note={`${data.evidence.length} recent source documents`}
                />
              </div>
              <div className="dashboard-grid">
                <section>
                  <div className="section-heading">
                    <h2>
                      Priority signals{" "}
                      <span className="count">
                        {data.signals.filter((s) => s.status === "open").length}
                      </span>
                    </h2>
                    <Link href={href("/signals")}>
                      View all <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div className="signal-list">
                    {openSignals.slice(0, 3).map((s) => (
                      <SignalRow
                        key={s.id}
                        signal={s}
                        onClick={() => setSelected(s)}
                      />
                    ))}
                    {!openSignals.length && (
                      <Empty
                        text={
                          data.signals.length
                            ? "All signals reviewed. No open items."
                            : "No signals yet. Add and process customer evidence to begin."
                        }
                      />
                    )}
                  </div>
                </section>
                <PortfolioHealth accounts={data.accounts} demo={demo} />
              </div>
            </>
          )}
          {(view === "dashboard" || view === "accounts") && (
            <section className="account-section">
              <div className="section-heading">
                <h2>
                  {view === "dashboard" ? "Account watchlist" : "All accounts"}
                </h2>
                <Link href={href("/settings/data")} className="text-link">
                  {data.evidence.length} source documents{" "}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="account-toolbar">
                <div
                  className="segmented compact"
                  aria-label="Account health filter"
                >
                  {[
                    { id: "all", label: "All accounts" },
                    { id: "attention", label: "Needs attention" },
                    { id: "healthy", label: "Healthy" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      aria-pressed={accountScope === item.id}
                      onClick={() => setAccountScope(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="account-toolbar-actions">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Search accounts"
                      aria-label="Search accounts"
                    />
                  </label>
                  <select
                    aria-label="Sort accounts"
                    value={accountSort}
                    onChange={(e) => setAccountSort(e.target.value)}
                  >
                    <option value="health">Health: lowest first</option>
                    <option value="revenue">Revenue: highest first</option>
                    <option value="renewal">Renewal: soonest first</option>
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Annual revenue</th>
                      <th>Health</th>
                      <th>Renewal</th>
                      <th>Owner</th>
                      <th>Evidence</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <Link
                            className="account-cell"
                            href={href(`/accounts/${a.domain}`)}
                          >
                            <span
                              className={`company-mark color-${a.name.length % 4}`}
                            >
                              {a.name[0]}
                            </span>
                            <span>
                              <strong>{a.name}</strong>
                              <small>{a.domain}</small>
                            </span>
                          </Link>
                        </td>
                        <td className="tabular">{money(a.arr)}</td>
                        <td>
                          <div className="account-health-cell">
                            <span
                              className={`badge ${a.health <= 60 ? "red" : a.health < 75 ? "amber-badge" : "green"}`}
                            >
                              <span className="status-dot" />
                              {a.health}{" "}
                              {a.health <= 60
                                ? "At risk"
                                : a.health < 75
                                  ? "Watch"
                                  : "Healthy"}
                            </span>
                            <span
                              className="account-health-track"
                              aria-hidden="true"
                            >
                              <i
                                style={{ width: `${a.health}%` }}
                                className={
                                  a.health <= 60
                                    ? "risk-bar"
                                    : a.health < 75
                                      ? "watch-bar"
                                      : "healthy-bar"
                                }
                              />
                            </span>
                          </div>
                        </td>
                        <td>{a.renewal || "Not set"}</td>
                        <td>
                          <span className="owner-cell">
                            {a.owner && (
                              <span className="owner-avatar" aria-hidden="true">
                                {a.owner
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                            )}
                            {a.owner || "Unassigned"}
                          </span>
                        </td>
                        <td>
                          <span className="evidence-count">
                            <FileText size={14} />
                            {a.evidenceCount}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="icon-button"
                            href={href(`/accounts/${a.domain}`)}
                            aria-label={`Open ${a.name}`}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!accounts.length && (
                  <Empty
                    text={
                      data.accounts.length
                        ? "No accounts match these filters."
                        : "No accounts yet. Add customer evidence to begin."
                    }
                  />
                )}
              </div>
            </section>
          )}
          {view === "signals" && (
            <>
              <div className="segmented" aria-label="Filter signals">
                {["all", "risk", "expansion", "competitor"].map((k) => (
                  <button
                    key={k}
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                  >
                    {k === "all" ? "All signals" : k}
                  </button>
                ))}
              </div>
              <div className="signal-list">
                {signals.map((s) => (
                  <SignalRow
                    key={s.id}
                    signal={s}
                    onClick={() => setSelected(s)}
                  />
                ))}
                {!signals.length && <Empty text="No signals in this view." />}
              </div>
            </>
          )}
          {view === "account" && account && (
            <>
              <div className="metric-grid">
                <Metric
                  label="Annual revenue"
                  value={money(account.arr)}
                  note="Current contract"
                />
                <Metric
                  label="Account health"
                  value={String(account.health)}
                  note="Based on detected signals"
                />
                <Metric
                  label="Renewal"
                  value={account.renewal || "Not set"}
                  note={account.owner || "No owner assigned"}
                />
                <Metric
                  label="Evidence"
                  value={String(account.evidenceCount)}
                  note="Source documents"
                />
              </div>
              <section>
                <div className="section-heading">
                  <h2>Account signals</h2>
                </div>
                <div className="signal-list">
                  {signals.map((s) => (
                    <SignalRow
                      key={s.id}
                      signal={s}
                      onClick={() => setSelected(s)}
                    />
                  ))}
                </div>
                {!signals.length && (
                  <Empty text="No signals detected for this account yet." />
                )}
              </section>
              <section>
                <div className="section-heading">
                  <h2>Customer evidence</h2>
                </div>
                {data.evidence
                  .filter((e) => e.domain === domain)
                  .map((e) => (
                    <article className="evidence-row" id={e.id} key={e.id}>
                      <FileText size={19} />
                      <div>
                        <h3>
                          <Link href={href(`/evidence/${e.id}`)}>
                            {e.title} <ArrowUpRight size={14} />
                          </Link>
                        </h3>
                        <p>{e.body}</p>
                        <small>
                          {e.source} · {e.createdAt.slice(0, 10)}
                        </small>
                      </div>
                    </article>
                  ))}
                {!data.evidence.some((e) => e.domain === domain) && (
                  <Empty text="No customer evidence has been added to this account." />
                )}
              </section>
            </>
          )}
          {view === "competitors" && (
            <div className="competitor-grid">
              {data.competitors.map((c) => (
                <article className="competitor" key={c.name}>
                  <Radar size={24} />
                  <h2>{c.name}</h2>
                  <p className="muted">
                    {c.mentions} mentions across {c.accounts} accounts
                  </p>
                  <blockquote>{c.evidence}</blockquote>
                  <Link href={href("/signals")}>
                    Review signals <ArrowRight size={15} />
                  </Link>
                </article>
              ))}
              {!data.competitors.length && (
                <Empty text="Competitor mentions will appear when detected in your evidence." />
              )}
            </div>
          )}
          {children}
          <footer>
            <span>Revenue-Intelligence</span>
            <span>
              <ShieldCheck size={14} />
              Workspace-isolated data
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <Dialog
          label="Signal details"
          onClose={() => {
            setSelected(null);
            setSignalError("");
          }}
        >
          <section
            className="detail-panel"
            aria-labelledby="signal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close"
              aria-label="Close signal"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <span
              className={`badge ${selected.kind === "risk" ? "red" : selected.kind === "expansion" ? "green" : "amber-badge"}`}
            >
              {selected.kind}
            </span>
            <h2 id="signal-title">{selected.title}</h2>
            <Link href={href(`/accounts/${selected.domain}`)}>
              {selected.company}
              <ArrowUpRight size={15} />
            </Link>
            <p>{selected.detail}</p>
            <h3>Supporting evidence</h3>
            <blockquote>{selected.quote}</blockquote>
            <p className="muted">
              {selected.confidence}% model confidence · {selected.status}
            </p>
            <Link
              className="button"
              href={href(`/evidence/${selected.chunkId}`)}
            >
              Open source evidence <ArrowRight size={16} />
            </Link>
            <div className="answer-actions">
              <button
                className="button"
                disabled={demo || signalBusy}
                onClick={async () => {
                  setSignalBusy(true);
                  setSignalError("");
                  try {
                    const status =
                      selected.status === "open" ? "resolved" : "open";
                    await api(
                      "/api/signals",
                      { id: selected.id, status },
                      "PATCH",
                    );
                    setSelected({ ...selected, status });
                    router.refresh();
                  } catch (error) {
                    setSignalError(errorMessage(error));
                  } finally {
                    setSignalBusy(false);
                  }
                }}
              >
                <CheckCircle2 size={16} />
                {selected.status === "open" ? "Mark resolved" : "Reopen signal"}
              </button>
            </div>
            {demo && (
              <p className="muted">
                This demo is read-only. Sign in to review signals in your own
                workspace.
              </p>
            )}
            {signalError && (
              <p role="alert" className="form-message error">
                {signalError}
              </p>
            )}
          </section>
        </Dialog>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  tone = "",
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <div>{label}</div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function SignalRow({
  signal: s,
  onClick,
}: {
  signal: Signal;
  onClick: () => void;
}) {
  return (
    <button className="signal-row" onClick={onClick}>
      <span
        className={`company-mark color-${s.company.length % 4}`}
        aria-hidden="true"
      >
        {s.company[0]}
      </span>
      <span className="signal-content">
        <span className="signal-meta">
          <strong>{s.company}</strong>
          <span className={`kind ${s.kind}`}>{s.kind}</span>
          {s.status === "resolved" && <span>Resolved</span>}
        </span>
        <span className="signal-title">{s.title}</span>
        <span className="signal-quote">&ldquo;{s.quote}&rdquo;</span>
        <span className="signal-foot">
          <span className="status-dot" /> Quote verified <span>·</span>
          {s.confidence}% model confidence
        </span>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <FileText size={25} />
      <p>{text}</p>
    </div>
  );
}
