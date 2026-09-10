import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
export default function Page() {
  return (
    <main className="setup-page">
      <Activity size={34} />
      <h1>Revenue-Intelligence</h1>
      <h2>This workspace is getting ready.</h2>
      <p>
        Your administrator needs to connect sign-in and storage before you can
        create an account. The sample workspace is available now.
      </p>
      <Link className="button primary" href="/demo">
        Explore sample workspace <ArrowRight size={16} />
      </Link>
    </main>
  );
}
