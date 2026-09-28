import { WorkspaceRouter } from "@/components/workspace-router";
import { pageData } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const props = await pageData();
  return <WorkspaceRouter {...props}>{children}</WorkspaceRouter>;
}
