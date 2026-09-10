import { Workspace } from "@/components/workspace";
import { AISettings } from "@/components/ai-settings";
import { pageData } from "@/lib/page-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const props = await pageData();
  return (
    <Workspace view="ai" {...props}>
      <AISettings
        demo={props.demo}
        owner={props.owner}
        providerKey={props.data.key}
        usage={props.data.usage}
      />
    </Workspace>
  );
}
