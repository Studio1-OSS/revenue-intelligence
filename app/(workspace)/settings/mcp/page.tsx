import { MCPSettings } from "@/components/mcp-settings";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <MCPSettings
      endpoint={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp`}
      configured={Boolean(
        process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE,
      )}
      enabled={process.env.MCP_FEATURE_ENABLED === "true"}
    />
  );
}
