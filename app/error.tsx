"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="setup-page">
      <h1>We couldn’t load this workspace.</h1>
      <p>
        Please retry. If this continues, ask your administrator to check the
        workspace connection.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <a className="button" href="/auth/logout">
        Sign out
      </a>
    </main>
  );
}
