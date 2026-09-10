import Link from "next/link";
export default function NotFound() {
  return (
    <main className="setup-page">
      <h1>That page isn’t available.</h1>
      <p>The account or query may have been removed.</p>
      <Link className="button" href="/">
        Back to overview
      </Link>
    </main>
  );
}
