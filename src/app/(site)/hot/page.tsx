import Link from "next/link";
import { formatShanghaiClock, hotEnabled, ideaForTitle, isSolemnToday, listHotPitches, listHotRows, listManualIdeas, sourceName } from "@/lib/hot";
import { getDb } from "@/lib/db";
import { one } from "@/lib/query";

const ARROW = { up: "↑", down: "↓", same: "·", new: "新" };

export const metadata = { title: "实时热点", description: "抖音、微博、百度等公开热榜标题。只保留标题和来源，不转载正文。" };

export default async function HotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const source = one((await searchParams).source);
  const db = getDb();
  const { rows, updatedAt } = hotEnabled() ? listHotRows(db, source || undefined) : { rows: [], updatedAt: null };
  const pitches = listHotPitches(db).slice(0, 8);
  const ideas = isSolemnToday(db) ? [] : listManualIdeas(db);
  return (
    <>
      <div className="section-head">
        <div>
          <h1>实时热点</h1>
          <p>只使用公开热榜的标题做选题参考，不转载第三方正文。{updatedAt ? `更新于 ${formatShanghaiClock(updatedAt)}` : "还没有抓到热榜。"}</p>
        </div>
      </div>
      <div className="chips">
        <Link className={!source ? "chip on" : "chip"} href="/hot">全部</Link>
        {["douyin", "weibo", "baidu", "toutiao", "bilibili"].map((id) => (
          <Link key={id} className={source === id ? "chip on" : "chip"} href={`/hot?source=${id}`}>{sourceName(id)}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="empty-state"><h3>{hotEnabled() ? "热榜还在路上" : "热点抓取未开启"}</h3><p>抓取失败时会保留上一份成功的快照。</p></div>
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
