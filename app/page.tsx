import { Landing } from "@/components/landing";
import { authConfigured } from "@/lib/auth0";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Landing authConfigured={authConfigured()} />;
}
