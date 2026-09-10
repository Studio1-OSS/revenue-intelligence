import { Workspace } from "@/components/workspace";
import { pageData } from "@/lib/page-data";
import { AssistantPanel } from "@/components/assistant-panel";
export const dynamic = "force-dynamic";
export const metadata = { title: "Account overview" };
export default async function Page() {
  const props = await pageData();
  return (
    <Workspace view="dashboard" {...props}>
      <AssistantPanel
        demo={props.demo}
        connected={Boolean(props.data.key)}
        queries={props.data.savedQueries}
      />
    </Workspace>
  );
}
