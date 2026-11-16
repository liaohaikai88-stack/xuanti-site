import Link from "next/link";
import { formatShanghaiClock, hotEnabled, ideaForTitle, isShopRelevantHot, isSolemnToday, listHotPitches, listHotRows, listManualIdeas, sourceName } from "@/lib/hot";
import { getDb } from "@/lib/db";
import { one } from "@/lib/query";

const ARROW = { up: "↑", down: "↓", same: "·", new: "新" };

export const metadata = { title: "实时热点", description: "抖音、微博、百度等公开热榜标题。只保留标题和来源，不转载正文。" };

export default async function HotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = one(params.source);
  const showAll = one(params.scope) === "all";
  const db = getDb();
  const loaded = hotEnabled() ? listHotRows(db, source || undefined) : { rows: [], updatedAt: null };
  const rows = showAll ? loaded.rows : loaded.rows.filter((row) => isShopRelevantHot(row.title));
  const updatedAt = loaded.updatedAt;
  const pitches = listHotPitches(db).slice(0, 8);
  const ideas = isSolemnToday(db) ? [] : listManualIdeas(db);
  return (
    <>
      <div className="section-head">
        <div>
          <h1>实时热点</h1>
          <p>默认只留餐饮、美业、本地生活，以及影视综艺这类生活话题。时政、灾害和案件不会出现。{updatedAt ? `更新于 ${formatShanghaiClock(updatedAt)}` : "还没有抓到热榜。"}</p>
        </div>
      </div>
      <div className="chips">
        <Link className={!showAll && !source ? "chip on" : "chip"} href="/hot">适合门店</Link>
        <Link className={showAll && !source ? "chip on" : "chip"} href="/hot?scope=all">全部热榜</Link>
        {["douyin", "weibo", "baidu", "toutiao", "bilibili"].map((id) => (
          <Link key={id} className={source === id ? "chip on" : "chip"} href={showAll ? `/hot?scope=all&source=${id}` : `/hot?source=${id}`}>{sourceName(id)}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>{hotEnabled() ? (showAll ? "热榜还在路上" : "今天没有适合门店的热榜") : "热点抓取未开启"}</h3>
          <p>{showAll ? "抓取失败时会保留上一份成功的快照。" : "全部热榜仍会去掉时政、灾害和案件。"}</p>
          {showAll ? null : <Link className="btn btn-ghost" href="/hot?scope=all">全部热榜</Link>}
        </div>
      ) : (
        <div className="hot-list">
          {rows.map((row) => (
            <article key={`${row.source}-${row.rank}-${row.title}`} className="hot-row">
              <b>{row.rank}</b>
              <div>
                <strong>{row.title}</strong>
                {ideaForTitle(ideas, row.title) ? <p>{ideaForTitle(ideas, row.title)}</p> : null}
                <div className="fine">
                  {sourceName(row.source)} · {row.heat || "热度未知"} · {ARROW[row.trend]}
                  {row.tags.map((tag) => <span key={tag} className="ind-tag" style={{ ["--tone" as string]: "#d6420c" }}>{tag}</span>)}
                </div>
              </div>
              {row.url ? <a href={row.url} target="_blank" rel="noreferrer">原榜</a> : null}
            </article>
          ))}
        </div>
      )}
      {ideas.length > 0 ? (
        <section>
          <h2>门店借势</h2>
          <p className="fine">管理员导入的原创借势句子，只保留热榜标题、数字和链接。</p>
          {ideas.map((item) => (
            <article key={item.id} className="copy-card">
              <div className="copy-style">{item.platform || "热点"} · {item.industry}</div>
              <h3>{item.title}</h3>
              <p>{item.idea}</p>
              <p className="fine">{item.heat || "热度未知"} · {item.fetchedAt.slice(0, 16).replace("T", " ")}</p>
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer">原链接</a> : null}
            </article>
          ))}
        </section>
      ) : null}
      {pitches.length > 0 ? (
        <section>
          <h2>热点选题</h2>
          <p className="fine">根据热榜标题生成的原创门店选题，不是新闻转载。</p>
          {pitches.map((pitch) => (
            <article key={String(pitch.id)} className="copy-card">
              <div className="copy-style">热点选题 · {String(pitch.industry)}</div>
              <h3>{String(pitch.title)}</h3>
              <p>{String(pitch.hook)}</p>
              <p className="fine">{String(pitch.platform)} · {String(pitch.angle)} · 来源标题：{String(pitch.hot_title)}</p>
              {pitch.source_url ? <a href={String(pitch.source_url)} target="_blank" rel="noreferrer">查看原热榜</a> : null}
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}
