import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { AssistantPanel } from "@/components/assistant-panel";
import { AccountEditor } from "@/components/account-editor";
import { pageData } from "@/lib/page-data";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const props = await pageData();
  const account = props.data.accounts.find((a) => a.domain === domain);
  if (!account) notFound();
  return (
    <Workspace view="account" domain={domain} {...props}>
      <AccountEditor key={account.id} account={account} demo={props.demo} />
      <AssistantPanel
        key={account.id}
        demo={props.demo}
        connected={Boolean(props.data.key)}
        domain={domain}
        queries={props.data.savedQueries}
      />
    </Workspace>
  );
}
