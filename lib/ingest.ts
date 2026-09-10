import "server-only";
import Papa from "papaparse";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database, stableId } from "./db";
import { AppError } from "./errors";
import type { WorkspaceContext } from "./types";

export const documentInput = z.object({
  company: z.string().trim().min(1).max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
      "Enter a company domain without https://",
    ),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(20000),
  arr: z.coerce.number().int().min(0).max(1_000_000_000).default(0),
  owner: z.string().trim().max(120).default(""),
  renewal: z
    .string()
    .regex(/^$|^\d{4}-\d{2}-\d{2}$/)
    .default(""),
});
export type DocumentInput = z.infer<typeof documentInput>;
export function parseCSV(text: string): DocumentInput[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  if (parsed.errors.length)
    throw new AppError(
      "INVALID_CSV",
      "CSV could not be read. Check the header and quoted fields.",
    );
  if (!parsed.data.length || parsed.data.length > 100)
    throw new AppError(
      "INVALID_CSV",
      "Import between 1 and 100 rows at a time.",
    );
  return parsed.data.map((row, index) => {
    const result = documentInput.safeParse(row);
    if (!result.success)
      throw new AppError(
        "INVALID_CSV",
        `Row ${index + 2}: ${result.error.issues[0].path.join(".")} ${result.error.issues[0].message}`,
      );
    return result.data;
  });
}
export function chunkText(text: string, max = 2000, overlap = 200) {
  if (max <= overlap || overlap < 0)
    throw new Error("Invalid chunk dimensions");
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length;) {
    let end = Math.min(start + max, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start + max / 2) end = boundary;
    }
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = end - overlap;
  }
  return chunks;
}
export async function ingest(
  ctx: WorkspaceContext,
  inputs: DocumentInput[],
  sourceName: string,
  kind: "csv" | "manual" | "sample",
  db = database(),
  receipt?: {
    connectionId: string;
    formId: string;
    submissionId: string;
    eventId: string;
    ciphertext: string;
  },
) {
  const validated = z.array(documentInput).min(1).max(100).parse(inputs);
  const prepared = validated.map((input) => ({
    input,
    chunks: chunkText(input.body),
  }));
  if (prepared.reduce((n, p) => n + p.chunks.length, 0) > 250)
    throw new AppError(
      "TOO_LARGE",
      "Import a smaller batch (maximum 250 chunks).",
      413,
    );
  const tx = await db.transaction("write");
  const source = randomUUID();
  const now = new Date().toISOString();
  try {
    // Receipt and evidence commit together, so retries cannot duplicate an import.
    if (receipt) {
      const active = await tx.execute({
        sql: "SELECT id FROM tally_connections WHERE id=? AND workspace_id=? AND form_id=? AND enabled=1 AND secret_ciphertext=?",
        args: [
          receipt.connectionId,
          ctx.workspaceId,
          receipt.formId,
          receipt.ciphertext,
        ],
      });
      if (!active.rows.length)
        throw new AppError(
          "CONNECTION_CHANGED",
          "The connection was disabled or changed. Check its settings.",
          409,
        );
      const inserted = await tx.execute({
        sql: "INSERT INTO tally_receipts(workspace_id,connection_id,form_id,submission_id,event_id,received_at) VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id,form_id,submission_id) DO NOTHING",
        args: [
          ctx.workspaceId,
          receipt.connectionId,
          receipt.formId,
          receipt.submissionId,
          receipt.eventId,
          now,
        ],
      });
      if (!inserted.rowsAffected) {
        await tx.commit();
        return { documents: 0, chunks: 0, duplicate: true };
      }
    }
    const count = await tx.execute({
      sql: "SELECT COUNT(*) AS n FROM documents WHERE workspace_id=?",
      args: [ctx.workspaceId],
    });
    if (Number(count.rows[0].n) + validated.length > 500)
      throw new AppError(
        "WORKSPACE_LIMIT",
        "This workspace has reached the 500-document limit. Remove older evidence before importing.",
        409,
      );
    await tx.execute({
      sql: "INSERT INTO sources(id,workspace_id,name,kind,created_at) VALUES(?,?,?,?,?)",
      args: [source, ctx.workspaceId, sourceName.slice(0, 120), kind, now],
    });
    for (const { input, chunks } of prepared) {
      const company = stableId("co", `${ctx.workspaceId}:${input.domain}`);
      const document = randomUUID();
      await tx.execute({
        sql: "INSERT INTO companies(id,workspace_id,domain,name,arr,owner,renewal) VALUES(?,?,?,?,?,?,?) ON CONFLICT(workspace_id,domain) DO NOTHING",
        args: [
          company,
          ctx.workspaceId,
          input.domain,
          input.company,
          input.arr,
          input.owner,
          input.renewal,
        ],
      });
      await tx.execute({
        sql: "INSERT INTO documents(id,workspace_id,company_id,source_id,title,body,created_at) VALUES(?,?,?,?,?,?,?)",
        args: [
          document,
          ctx.workspaceId,
          company,
          source,
          input.title,
          input.body,
          now,
        ],
      });
      for (const [ordinal, body] of chunks.entries())
        await tx.execute({
          sql: "INSERT INTO chunks(id,workspace_id,document_id,ordinal,body) VALUES(?,?,?,?,?)",
          args: [randomUUID(), ctx.workspaceId, document, ordinal, body],
        });
    }
    if (receipt)
      await tx.execute({
        sql: "UPDATE tally_connections SET last_received_at=?,imported_count=imported_count+? WHERE id=? AND workspace_id=?",
        args: [now, validated.length, receipt.connectionId, ctx.workspaceId],
      });
    await tx.commit();
    return {
      documents: validated.length,
      chunks: prepared.reduce((n, p) => n + p.chunks.length, 0),
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
