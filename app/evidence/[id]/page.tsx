import Link from "next/link";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { pageData } from "@/lib/page-data";
import { auth0 } from "@/lib/auth0";
import { resolveWorkspace } from "@/lib/db";
import { sourceEvidence } from "@/lib/evidence";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const props = await pageData();
  const session = await auth0()?.getSession();
  const source = session
    ? await sourceEvidence(
        (await resolveWorkspace(session.user)).workspaceId,
        id,
      )
    : props.data.evidence.find((e) => e.id === id);
  if (!source) notFound();
  return (
    <Workspace view="data" {...props}>
      <article className="source-document">
        <Link className="text-link" href={`/accounts/${source.domain}`}>
          {source.company}
        </Link>
        <h2>{source.title}</h2>
        <p className="muted">
          {source.source} · {source.createdAt.slice(0, 10)}
        </p>
        <div>{source.body}</div>
        {"sourceUrl" in source && typeof source.sourceUrl === "string" && (
          <a
            className="text-link"
            href={source.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open original source
          </a>
        )}
      </article>
    </Workspace>
  );
}
