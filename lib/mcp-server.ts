import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { database, rateLimit, rows } from "./db";
import { searchEvidence } from "./ai/chat";
import { AppError } from "./errors";
import type { WorkspaceContext } from "./types";
import { sourceEvidence } from "./evidence";
export function createMcpServer(ctx: WorkspaceContext) {
  const server = new McpServer({
    name: "Revenue-Intelligence",
    version: "0.1.0",
  });
  async function audit(name: string, operation: () => Promise<unknown>) {
    const id = randomUUID();
    await database().execute({
      sql: "INSERT INTO tool_calls(id,workspace_id,user_id,name,status,created_at) VALUES(?,?,?,?,'started',?)",
      args: [id, ctx.workspaceId, ctx.userId, name, new Date().toISOString()],
    });
    try {
      const result = await operation();
      await database().execute({
        sql: "UPDATE tool_calls SET status='success' WHERE id=? AND workspace_id=?",
        args: [id, ctx.workspaceId],
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (error) {
      await database().execute({
        sql: "UPDATE tool_calls SET status='failed' WHERE id=? AND workspace_id=?",
        args: [id, ctx.workspaceId],
      });
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: error instanceof AppError ? error.code : "INTERNAL_ERROR",
              message:
                error instanceof AppError
                  ? error.message
                  : "Tool request failed.",
            }),
          },
        ],
      };
    }
  }
  server.registerTool(
    "search_evidence",
    {
      title: "Search customer evidence",
      description:
        "Search evidence in the authenticated user's workspace. Requires a workspace Nebius key; query embedding is billed by Nebius.",
      inputSchema: {
        query: z.string().min(2).max(2000),
        domain: z.string().max(253).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, domain }) =>
      audit("search_evidence", async () => {
        await rateLimit(ctx, "search");
        return searchEvidence(ctx, query, domain);
      }),
  );
  server.registerTool(
    "account_overview",
    {
      title: "Read account overview",
      description:
        "Read accounts and open signals from the authenticated workspace. No AI call.",
      inputSchema: { domain: z.string().max(253) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ domain }) =>
      audit("account_overview", async () => ({
        accounts: await rows(
          "SELECT name,domain,arr,health,owner,renewal FROM companies WHERE workspace_id=? AND domain=?",
          [ctx.workspaceId, domain],
        ),
        signals: await rows(
          "SELECT s.title,s.kind,s.quote,s.confidence FROM signals s JOIN companies c ON c.id=s.company_id AND c.workspace_id=s.workspace_id WHERE s.workspace_id=? AND c.domain=? AND s.status='open'",
          [ctx.workspaceId, domain],
        ),
      })),
  );
  server.registerTool(
    "get_source",
    {
      title: "Read source evidence",
      description:
        "Read the full document for a source document or chunk ID. Only the authenticated workspace is accessible.",
      inputSchema: { id: z.string().min(1).max(100) },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ id }) =>
      audit("get_source", async () => {
        const source = await sourceEvidence(ctx.workspaceId, id);
        if (!source) throw new AppError("NOT_FOUND", "Source not found.", 404);
        return source;
      }),
  );
  server.registerTool(
    "list_accounts",
    {
      title: "Find accounts",
      description:
        "Discover accounts by name or domain in the authenticated workspace.",
      inputSchema: { query: z.string().max(120).default("") },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ query }) =>
      audit("list_accounts", () =>
        rows(
          "SELECT name,domain,arr,health FROM companies WHERE workspace_id=? AND (name LIKE ? OR domain LIKE ?) ORDER BY name LIMIT 50",
          [ctx.workspaceId, `%${query}%`, `%${query}%`],
        ),
      ),
  );
  return server;
}
