import Link from "next/link";
import { getLegal } from "@/lib/content";
import { getDb } from "@/lib/db";

export default function LegalIndexPage() {
  const db = getDb();
  const docs = [getLegal(db, "terms"), getLegal(db, "privacy")].filter((doc) => doc != null);
  return (
    <ul>
      {docs.map((doc) => (
        <li key={doc.slug}>
          <Link href={`/admin/legal/${doc.slug}`}>{doc.title}</Link>
          <span className="fine"> · {doc.updatedAt.slice(0, 10)}</span>
        </li>
      ))}
    </ul>
  );
}
