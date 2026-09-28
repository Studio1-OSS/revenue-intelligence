import { DataSettings } from "@/components/data-settings";
import { pageData } from "@/lib/page-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const props = await pageData();
  return (
    <DataSettings demo={props.demo} owner={props.owner} data={props.data} />
  );
}
