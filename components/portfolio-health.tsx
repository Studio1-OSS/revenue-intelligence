import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Account } from "@/lib/types";
import { workspacePath } from "@/lib/workspace-path";

export function PortfolioHealth({
  accounts,
  demo,
}: {
  accounts: Account[];
  demo: boolean;
}) {
  const groups = [
    {
      label: "Healthy",
      tone: "healthy",
      accounts: accounts.filter((a) => a.health >= 75),
    },
    {
      label: "Watch",
      tone: "watch",
      accounts: accounts.filter((a) => a.health > 60 && a.health < 75),
    },
    {
      label: "At risk",
      tone: "risk",
      accounts: accounts.filter((a) => a.health <= 60),
    },
  ];
  const average = accounts.length
    ? Math.round(
        accounts.reduce((sum, a) => sum + a.health, 0) / accounts.length,
      )
    : null;
  return (
    <section className="coverage">
      <div className="section-heading">
        <h2>Portfolio health</h2>
        <span className="muted">{accounts.length} accounts</span>
      </div>
      <div className="portfolio-score">
        <strong>{average ?? "--"}</strong>
        <span>
          out of 100<small>Average account score</small>
        </span>
      </div>
      <div
        className="portfolio-distribution"
        role="img"
        aria-label={groups
          .map((g) => `${g.accounts.length} ${g.label.toLowerCase()} accounts`)
          .join(", ")}
      >
        {groups
          .filter((g) => g.accounts.length)
          .map((g) => (
            <span
              key={g.tone}
              className={`${g.tone}-bar`}
              style={{ flex: g.accounts.length }}
            />
          ))}
      </div>
      <div className="portfolio-breakdown">
        {groups.map((g) => (
          <div key={g.tone}>
            <span>
              <i className={`${g.tone}-bar`} />
              {g.label}
            </span>
            <strong>{g.accounts.length}</strong>
            <small>
              {accounts.length
                ? Math.round((g.accounts.length / accounts.length) * 100)
                : 0}
              %
            </small>
          </div>
        ))}
      </div>
      <p className="portfolio-caption">
        Scores reflect detected signals, not a forecast.
      </p>
      <Link className="portfolio-link" href={workspacePath(demo, "/accounts")}>
        Review accounts <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
