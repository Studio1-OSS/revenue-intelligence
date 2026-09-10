import { notFound } from "next/navigation";
import Link from "next/link";
import { rows } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared question",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) notFound();
  const [query] = await rows<{ title: string; query: string }>(
    "SELECT title,query FROM saved_queries WHERE share_token=?",
    [token],
  );
  if (!query) notFound();
  return (
    <main className="setup-page">
      <p className="eyebrow">REVENUE-INTELLIGENCE · SHARED QUESTION</p>
      <h1>{query.title}</h1>
      <blockquote>{query.query}</blockquote>
      <p>
        Only this question has been shared. Customer evidence and answers remain
        private.
      </p>
      <Link className="button primary" href="/">
        Open your workspace
      </Link>
    </main>
  );
}
