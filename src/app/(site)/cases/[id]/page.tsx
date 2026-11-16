import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasFullAccess } from "@/lib/access";
import { getCase } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { MarkdownView } from "@/components/markdown-view";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const item = getCase(getDb(), Number(id));
  if (!item) return { title: "拆解" };
  return { title: item.title, description: item.teaser };
}

export default async function CasePage({ params }: Params) {
  const { id } = await params;
  const item = getCase(getDb(), Number(id));
  if (!item) notFound();
  const user = await getCurrentUser();
  const full = hasFullAccess(user);
  return (
    <article className="shot-card">
      {item.isSample ? <span className="sample-badge">示例</span> : null}
      <div className="shot-kicker">
        {item.platform}
        {item.industryName ? ` · ${item.industryName}` : ""}
      </div>
      <h1>{item.title}</h1>
      <p className="shot-hook">{item.teaser}</p>
      {full ? (
        <MarkdownView source={item.body} />
      ) : (
        <div className="lock-panel">
          <h2>登录后看完整拆解</h2>
          <p className="muted">上面这段是免费导语。完整的结构和拍法在登录后展开。</p>
          <Link className="btn btn-primary" href={`/login?next=/cases/${item.id}`}>
            登录查看
          </Link>
        </div>
      )}
    </article>
  );
}
