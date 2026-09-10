import "server-only";
import { rows } from "./db";
export type SourceEvidence = {
  id: string;
  title: string;
  body: string;
  domain: string;
  company: string;
  source: string;
  createdAt: string;
  sourceUrl?: string | null;
};
export async function sourceEvidence(workspaceId: string, id: string) {
  const [source] = await rows<SourceEvidence>(
    `SELECT DISTINCT d.id,d.title,d.body,co.domain,co.name AS company,s.name AS source,d.created_at AS createdAt,r.source_url AS sourceUrl FROM documents d JOIN companies co ON co.id=d.company_id AND co.workspace_id=d.workspace_id JOIN sources s ON s.id=d.source_id AND s.workspace_id=d.workspace_id JOIN chunks c ON c.document_id=d.id AND c.workspace_id=d.workspace_id LEFT JOIN external_records r ON r.document_id=d.id AND r.workspace_id=d.workspace_id WHERE d.workspace_id=? AND (d.id=? OR c.id=?) LIMIT 1`,
    [workspaceId, id, id],
  );
  return source || null;
}
