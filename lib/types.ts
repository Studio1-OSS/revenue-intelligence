export type Account = {
  id: string;
  domain: string;
  name: string;
  arr: number;
  owner: string;
  renewal: string;
  health: number;
  evidenceCount: number;
};
export type Signal = {
  id: string;
  companyId: string;
  company: string;
  domain: string;
  kind: "risk" | "expansion" | "competitor";
  title: string;
  detail: string;
  confidence: number;
  status: "open" | "resolved";
  quote: string;
  chunkId: string;
  createdAt: string;
};
export type Evidence = {
  id: string;
  title: string;
  body: string;
  domain: string;
  company: string;
  source: string;
  createdAt: string;
  status: string;
};
export type Competitor = {
  name: string;
  mentions: number;
  accounts: number;
  evidence: string;
};
export type SavedQuery = {
  id: string;
  title: string;
  query: string;
  shareToken: string | null;
};
export type Snapshot = {
  accounts: Account[];
  signals: Signal[];
  evidence: Evidence[];
  competitors: Competitor[];
  savedQueries: SavedQuery[];
  key: { hint: string; verifiedAt: string; model: string } | null;
  pending: number;
  usage: number;
};
export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: "owner" | "member";
  email: string;
  name: string;
  workspaceName: string;
};
export type SearchHit = {
  id: string;
  title: string;
  body: string;
  domain: string;
  score: number;
};
