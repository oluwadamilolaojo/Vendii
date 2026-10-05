import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-note">
      <div>
        <h1>That page doesn&apos;t exist</h1>
        <p>The link may be old, or the claim may belong to a different account.</p>
        <Link className="btn" href="/">Back to Vendii</Link>
      </div>
    </div>
  );
}
