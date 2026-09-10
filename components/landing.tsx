"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  AudioLines,
  Check,
  ChevronDown,
  FileText,
  KeyRound,
  Link2,
  Menu,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { sample, DEMO_DISCLAIMER } from "@/lib/sample-data";
import { Brand } from "./brand";

export function Landing({ authConfigured }: { authConfigured: boolean }) {
  const [selected, setSelected] = useState(0);
  const [menu, setMenu] = useState(false);
  const signal = sample.signals[selected];
  const source = sample.evidence.find((item) => item.id === signal.chunkId)!;
  const login = authConfigured ? "/auth/login?returnTo=/dashboard" : "/setup";
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" aria-label="Revenue-Intelligence home">
          <Brand />
        </Link>
        <nav className={menu ? "open" : ""} aria-label="Main navigation">
          <a href="#evidence" onClick={() => setMenu(false)}>
            Product
          </a>
          <a href="#workflow" onClick={() => setMenu(false)}>
            Workflow
          </a>
          <a href="#control" onClick={() => setMenu(false)}>
            BYOK
          </a>
          <Link href="/demo/settings/mcp">
            MCP <ArrowUpRight size={12} />
          </Link>
        </nav>
        <div className="landing-nav-actions">
          <a className="landing-login" href={login}>
            Sign in <ArrowUpRight size={15} />
          </a>
          <button
            className="icon-button landing-menu"
            aria-label={menu ? "Close menu" : "Open menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <main className="landing-main">
        <section className="landing-hero">
          <Image
            className="masthead-art"
            src="/brand-masthead.png"
            fill
            priority
            sizes="100vw"
            alt=""
          />
          <div className="hero-copy">
            <p className="landing-eyebrow">
              <AudioLines size={16} /> CUSTOMER SIGNALS. COMMERCIAL CONTEXT.
            </p>
            <h1>
              <span>Revenue-</span>
              <span>
                Intelligence<span className="brand-period">.</span>
              </span>
            </h1>
            <p className="hero-message">
              Know what your customers are telling you.
              <br /> Before your revenue does.
            </p>
            <div className="hero-actions">
              <a href={login} className="button primary">
                Start your workspace <ArrowRight size={18} />
              </a>
              <Link href="/demo" className="demo-link">
                Explore the demo <ArrowUpRight size={18} />
              </Link>
            </div>
            <p className="hero-footnote">
              <KeyRound size={13} /> Your Nebius key. Your AI spend. Your
              customer evidence.
            </p>
          </div>
          <div className="hero-index" aria-hidden="true">
            <span>RE / 01</span>
            <span>
              LESS GUESSWORK.
              <br />
              MORE CONTEXT.
            </span>
          </div>
        </section>
        <section className="product-band" id="evidence">
          <div className="product-heading">
            <div>
              <p className="landing-eyebrow">
                <span className="section-index">01</span> THE SIGNAL, NOT THE
                NOISE
              </p>
              <h2>
                There is a reason
                <br />
                behind every number.
              </h2>
            </div>
            <p>
              Spot renewal risk, expansion intent, and competitive pressure in
              customer conversations. Then go straight to the words behind the
              finding.
            </p>
          </div>
          <p className="demo-disclaimer">{DEMO_DISCLAIMER}</p>
          <div className="evidence-preview">
            <div className="preview-bar">
              <span>
                <AudioLines size={18} />
                <strong>Signal inbox</strong>
                <span className="count">3</span>
              </span>
              <span className="sample-label">SYNTHETIC DEMO DATA</span>
            </div>
            <div className="evidence-preview-grid">
              <div
                className="preview-signals"
                role="group"
                aria-label="Sample customer signals"
              >
                {sample.signals.slice(0, 3).map((s, index) => (
                  <button
                    key={s.id}
                    aria-pressed={selected === index}
                    onClick={() => setSelected(index)}
                  >
                    <span className={`preview-signal-icon ${s.kind}`}>
                      {s.kind === "risk" ? (
                        <ArrowDownRight size={21} />
                      ) : s.kind === "expansion" ? (
                        <ArrowUpRight size={21} />
                      ) : (
                        <Search size={21} />
                      )}
                    </span>
                    <span>
                      <span className="preview-signal-meta">
                        <strong>{s.company}</strong>
                        <span className={`kind ${s.kind}`}>{s.kind}</span>
                      </span>
                      <span className="preview-signal-title">{s.title}</span>
                      <small>{s.confidence}% confidence</small>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
              <article className="preview-source" aria-live="polite">
                <div className="source-overline">
                  <FileText size={15} />
                  <span>{source.source}</span>
                  <span>{source.createdAt}</span>
                </div>
                <h3>{source.title}</h3>
                <blockquote>&ldquo;{signal.quote}&rdquo;</blockquote>
                <div className="source-verification">
                  <Check size={14} /> Quote matched to source
                </div>
                <Link
                  href={`/demo/evidence/${source.id}`}
                  className="source-link"
                >
                  Read the full evidence <ArrowUpRight size={17} />
                </Link>
              </article>
            </div>
          </div>
          <div className="product-bottom">
            <span>Account context. Source-backed answers. One place.</span>
            <Link href="/demo">
              Open the full workspace <ArrowRight size={17} />
            </Link>
          </div>
        </section>
        <section className="workflow-band" id="workflow">
          <div className="band-heading">
            <p className="landing-eyebrow">
              <span className="section-index">02</span> FROM CONVERSATION TO
              CONTEXT
            </p>
            <h2>
              Bring the evidence.
              <br />
              Find your next move.
            </h2>
          </div>
          <div className="workflow-steps">
            {[
              {
                n: "01",
                icon: Upload,
                title: "Collect the conversation",
                body: "Connect GitHub Issues, Airtable, or Tally. Bring customer feedback into one account history.",
              },
              {
                n: "02",
                icon: AudioLines,
                title: "Read the account signals",
                body: "Use your Nebius key to surface risk, expansion opportunities, and competitor mentions.",
              },
              {
                n: "03",
                icon: Link2,
                title: "Follow the evidence",
                body: "Inspect the original quote, ask a cited follow-up, and decide what happens next.",
              },
            ].map((step) => (
              <article key={step.n}>
                <div className="step-top">
                  <step.icon size={25} />
                  <span>{step.n}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="control-band" id="control">
          <div className="control-copy">
            <p className="landing-eyebrow">
              <span className="section-index">03</span> OWN THE CONNECTION
            </p>
            <h2>
              Your intelligence.
              <br />
              On your terms.
            </h2>
            <p>
              Your customer evidence stays in your workspace. AI runs through
              your own Nebius Token Factory account. No shared provider key. No
              mystery AI bill.
            </p>
            <a href={login} className="button primary">
              Connect your workspace <ArrowRight size={17} />
            </a>
          </div>
          <ul>
            <li>
              <KeyRound size={23} />
              <span>
                <strong>Bring your own AI key</strong>
                <small>
                  Encrypted at rest and never returned to the browser. Nebius
                  bills your AI usage directly.
                </small>
              </span>
              <span className="control-number">01</span>
            </li>
            <li>
              <ShieldCheck size={23} />
              <span>
                <strong>A separate workspace</strong>
                <small>
                  Auth0 sign-in and workspace-scoped access keep your customer
                  records private.
                </small>
              </span>
              <span className="control-number">02</span>
            </li>
            <li>
              <Link2 size={23} />
              <span>
                <strong>Context for your agents</strong>
                <small>
                  Search evidence and retrieve account context through
                  authenticated MCP.
                </small>
                <Link href="/demo/settings/mcp">
                  Explore MCP access <ArrowUpRight size={14} />
                </Link>
              </span>
              <span className="control-number">03</span>
            </li>
          </ul>
        </section>
        <section className="faq-band">
          <div>
            <p className="landing-eyebrow">THE PRACTICAL DETAILS</p>
            <h2>Good questions.</h2>
            <p>Know what you are working with.</p>
          </div>
          <div>
            {[
              {
                q: "What can I import?",
                a: "Connect GitHub Issues or an Airtable feedback table, receive Tally form responses, upload CSV files, or add notes manually. GitHub and Airtable imports run when you sync; Tally receives new responses through a signed webhook. Process imported evidence using your workspace's Nebius key.",
              },
              {
                q: "Can I explore without an AI key?",
                a: "Yes. The read-only sample workspace needs no account or key. To process your own evidence, search semantically, or ask questions, sign in and connect a Nebius Token Factory key.",
              },
              {
                q: "Can I trust every signal?",
                a: "Signals and health scores are estimates, not guarantees. Quotes are checked against your evidence. Review the original source before making a decision.",
              },
              {
                q: "What does a shared link reveal?",
                a: "Only the question text you explicitly share. Answers, customer records, and source documents remain private. You can revoke the link.",
              },
            ].map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-close">
          <div>
            <p className="landing-eyebrow">START WITH ONE CONVERSATION</p>
            <h2>
              Your next insight
              <br />
              is already in the evidence.
            </h2>
          </div>
          <Link href="/demo" className="button primary">
            Take a closer look <ArrowUpRight size={20} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/">
          <Brand />
        </Link>
        <span>Customer evidence. Revenue decisions.</span>
        <a href="#evidence">
          Back to the product <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
