import { Workspace } from "@/components/workspace";
import { MCPSettings } from "@/components/mcp-settings";
import { pageData } from "@/lib/page-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const props = await pageData();
  return (
    <Workspace view="mcp" {...props}>
      <MCPSettings
        endpoint={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp`}
        configured={Boolean(
          process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE,
        )}
      />
    </Workspace>
  );
}
