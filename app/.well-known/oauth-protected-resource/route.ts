import { json } from "@/lib/http";
export async function GET() {
  if (!process.env.AUTH0_DOMAIN || !process.env.NEXT_PUBLIC_APP_URL)
    return json({ error: "MCP_NOT_CONFIGURED" }, 503);
  return json({
    resource: `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`,
    authorization_servers: [`https://${process.env.AUTH0_DOMAIN}/`],
    scopes_supported: ["read:insights"],
    bearer_methods_supported: ["header"],
    resource_name: "Revenue-Entelligence",
  });
}
