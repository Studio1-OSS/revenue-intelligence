import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { mcpContext } from "@/lib/mcp-auth";
import { createMcpServer } from "@/lib/mcp-server";
import { failure, readBody } from "@/lib/http";
import { rateLimit } from "@/lib/db";
import { AppError } from "@/lib/errors";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const ctx = await mcpContext(request);
    await rateLimit(ctx, "mcp", 30);
    let body: unknown;
    try {
      body = JSON.parse(await readBody(request, 16_000));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("INVALID_JSON", "Invalid JSON-RPC request.");
    }
    const server = createMcpServer(ctx);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, {
        parsedBody: body,
      });
      const content = await response.text();
      return new Response(content || null, {
        status: response.status,
        headers: response.headers,
      });
    } finally {
      await server.close();
    }
  } catch (error) {
    const response = failure(error);
    if (error instanceof AppError && error.status === 401)
      response.headers.set(
        "WWW-Authenticate",
        `Bearer resource_metadata="${process.env.NEXT_PUBLIC_APP_URL || ""}/.well-known/oauth-protected-resource", scope="read:insights"`,
      );
    return response;
  }
}
export async function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
