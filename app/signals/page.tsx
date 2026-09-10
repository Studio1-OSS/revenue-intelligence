import { Workspace } from "@/components/workspace";
import { pageData } from "@/lib/page-data";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Workspace view="signals" {...await pageData()} />;
}
