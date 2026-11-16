import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { casesEnabled } from "@/lib/config";
import { listCases } from "@/lib/content";
import { getDb } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  if (!casesEnabled()) return { title: "找不到页面", robots: { index: false, follow: false } };
  return { title: "爆款拆解", description: "今天拍啥的短视频结构拆解。未登录可以看导语，登录后看完整拆解。" };
}

export default function CasesPage() {
  if (!casesEnabled()) notFound();
  const cases = listCases(getDb());
  return (
    <>
      <div className="section-head">
        <div>
          <h1>爆款拆解</h1>
          <p>看一条片子为什么能留住人。带「示例」的是演示，不是真实数据报告。</p>
        </div>
      </div>
      {cases.length === 0 ? (
        <div className="empty-state">
          <h3>拆解还在写</h3>
          <p>先去今天的选题里挑一条拍。</p>
        </div>
      ) : (
        <div className="case-list">
          {cases.map((item) => (
            <Link key={item.id} href={`/cases/${item.id}`} className="case-card">
              {item.isSample ? <span className="sample-badge">示例</span> : null}
              <div className="fine">{item.platform}</div>
              <h3>{item.title}</h3>
              <p className="muted">{item.teaser}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
