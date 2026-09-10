import type { Snapshot } from "./types";

export const DEMO_DISCLAIMER =
  "Real company names; synthetic conversations, revenue, dates, and scores. These companies are not represented as customers or endorsers.";
export const SYNTHETIC_SOURCE_NOTICE =
  "SYNTHETIC DEMO: This is an invented scenario, not an actual company statement or customer relationship. All commercial figures and people are illustrative.";

const scenarios = [
  {
    id: "e1",
    companyId: "a1",
    company: "Shopify",
    domain: "shopify.com",
    kind: "risk" as const,
    title: "Security review needed before renewal",
    sourceTitle: "Security review planning",
    source: "Synthetic meeting notes",
    quote:
      "Our renewal approval is waiting on the security review. Can we schedule it this month?",
    detail:
      "In this synthetic scenario, a security review is the next renewal milestone. The demo account owner should coordinate a review date.",
    context:
      "The reviewer needs the updated security questionnaire and a walkthrough of access controls.",
    confidence: 93,
    createdAt: "2026-09-03",
  },
  {
    id: "e2",
    companyId: "a2",
    company: "Notion",
    domain: "notion.com",
    kind: "expansion" as const,
    title: "Regional pilot could add 25 seats",
    sourceTitle: "Regional rollout workshop",
    source: "Synthetic customer email",
    quote:
      "We would like to pilot this with our regional team. Please put together an option for 25 additional seats.",
    detail:
      "This invented rollout request suggests an expansion conversation. Confirm the pilot scope and proposed seat count.",
    context:
      "A six-week pilot would help us evaluate the workflow before a broader rollout.",
    confidence: 90,
    createdAt: "2026-09-04",
  },
  {
    id: "e3",
    companyId: "a3",
    company: "Canva",
    domain: "canva.com",
    kind: "competitor" as const,
    title: "Salesforce included in a sample comparison",
    sourceTitle: "Account-context evaluation",
    source: "Synthetic workshop notes",
    quote:
      "For this evaluation, we want to compare the account-context workflow with Salesforce before choosing an approach.",
    detail:
      "The synthetic evaluation includes Salesforce as an alternative. Prepare a comparison grounded in the example requirements.",
    context:
      "The comparison should focus on connecting source evidence with the account record.",
    confidence: 87,
    createdAt: "2026-09-02",
  },
  {
    id: "e4",
    companyId: "a6",
    company: "Zoom",
    domain: "zoom.com",
    kind: "risk" as const,
    title: "Training milestone precedes renewal review",
    sourceTitle: "Enablement milestone planning",
    source: "Synthetic meeting notes",
    quote:
      "We need to complete the administrator training before our renewal review can move forward.",
    detail:
      "In this invented scenario, an enablement milestone is still open. Agree on a training date and confirm completion before the review.",
    context:
      "Please share two possible training dates and the agenda for the administrator session.",
    confidence: 85,
    createdAt: "2026-09-01",
  },
];

export const sample: Snapshot = {
  accounts: [
    {
      id: "a1",
      name: "Shopify",
      domain: "shopify.com",
      arr: 240000,
      owner: "Demo owner A",
      renewal: "2026-11-20",
      health: 60,
      evidenceCount: 1,
    },
    {
      id: "a2",
      name: "Notion",
      domain: "notion.com",
      arr: 84000,
      owner: "Demo owner B",
      renewal: "2027-01-15",
      health: 80,
      evidenceCount: 1,
    },
    {
      id: "a3",
      name: "Canva",
      domain: "canva.com",
      arr: 156000,
      owner: "Demo owner A",
      renewal: "2026-12-09",
      health: 75,
      evidenceCount: 1,
    },
    {
      id: "a4",
      name: "Figma",
      domain: "figma.com",
      arr: 108000,
      owner: "Demo owner C",
      renewal: "2027-02-18",
      health: 75,
      evidenceCount: 0,
    },
    {
      id: "a5",
      name: "Atlassian",
      domain: "atlassian.com",
      arr: 192000,
      owner: "Demo owner B",
      renewal: "2027-03-12",
      health: 75,
      evidenceCount: 0,
    },
    {
      id: "a6",
      name: "Zoom",
      domain: "zoom.com",
      arr: 132000,
      owner: "Demo owner C",
      renewal: "2026-11-27",
      health: 60,
      evidenceCount: 1,
    },
  ],
  signals: scenarios.map((s, index) => ({
    id: `s${index + 1}`,
    companyId: s.companyId,
    company: s.company,
    domain: s.domain,
    kind: s.kind,
    title: s.title,
    detail: s.detail,
    confidence: s.confidence,
    status: "open",
    quote: s.quote,
    chunkId: s.id,
    createdAt: s.createdAt,
  })),
  evidence: scenarios.map((s) => ({
    id: s.id,
    title: `Synthetic demo: ${s.sourceTitle}`,
    body: `${SYNTHETIC_SOURCE_NOTICE}\n\n${s.quote} ${s.context}`,
    domain: s.domain,
    company: s.company,
    source: s.source,
    createdAt: s.createdAt,
    status: "ready",
  })),
  competitors: [
    {
      name: "Salesforce",
      mentions: 1,
      accounts: 1,
      evidence: scenarios[2].quote,
    },
  ],
  savedQueries: [],
  key: null,
  pending: 0,
  usage: 0,
};
