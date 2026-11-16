import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canSearch, hasFullAccess, splitPreview } from "@/lib/access";
import { favoriteIdSet, getIndustryBySlug, listIndustries, listTopicDates, listTopics } from "@/lib/content";
import { copyCounts } from "@/lib/copies";
import { copyUnlockFor } from "@/lib/membership";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { formatShortDate, isIsoDate, todayShanghai } from "@/lib/dates";
import { TopicCard } from "@/components/topic-card";
import { one } from "@/lib/query";

export const metadata: Metadata = { title: "选题库", description: "按行业浏览今天拍啥的抖音、小红书选题，含开头钩子和拍法。" };

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const industrySlug = one(params.industry);
  const query = one(params.q).trim();
  const date = one(params.date);
  const db = getDb();
  const user = await getCurrentUser();
  const full = hasFullAccess(user);
  const today = todayShanghai();
  const industries = listIndustries(db);
  const industry = industrySlug ? getIndustryBySlug(db, industrySlug) : null;

  if (query && !canSearch(user)) {
    redirect(`/login?next=${encodeURIComponent(`/topics?q=${query}`)}`);
  }
  if (date && date !== today && !full) {
    redirect(`/login?next=${encodeURIComponent(`/topics?date=${date}`)}`);
  }

  const selectedDate = full && isIsoDate(date) ? date : today;
  let topics = listTopics(db, {
    date: full && !query ? selectedDate : full ? undefined : today,
    industrySlug: industry?.slug,
    query: full ? query : undefined,
  });
  let lockedCount = 0;
  if (!full) {
    const preview = splitPreview(listTopics(db, { date: today }), null);
    lockedCount = preview.lockedCount;
    topics = industry ? preview.visible.filter((topic) => topic.industrySlug === industry.slug) : preview.visible;
  }
  const favorites = user && full ? favoriteIdSet(db, user.id) : new Set<number>();
  const unlock = copyUnlockFor(db, user);
  const counts = copyCounts(db, topics.map((topic) => topic.id));
  const dates = full ? listTopicDates(db) : [];

  return (
    <>
      <div className="section-head">
        <div>
          <h1>选题库</h1>
          <p>{full ? "可以搜索、按日期回看，也可以收藏。" : "未登录只展示今天可预览的选题。登录后可搜索和查看往日。"}</p>
        </div>
      </div>
      <div className="chips">
        <Link className={!industry ? "chip on" : "chip"} href={query ? `/topics?q=${encodeURIComponent(query)}` : "/topics"}>
          全部
        </Link>
        {industries.map((item) => (
          <Link key={item.id} className={industry?.id === item.id ? "chip on" : "chip"} href={`/topics?industry=${item.slug}`}>
            {item.name}
          </Link>
        ))}
      </div>
      {full ? (
        <form className="form" action="/topics" style={{ marginTop: 14 }}>
          {industry ? <input type="hidden" name="industry" value={industry.slug} /> : null}
          <label>
            <span className="field-label">搜索</span>
            <input name="q" defaultValue={query} placeholder="搜标题、钩子或拍法" />
          </label>
        </form>
      ) : (
        <p className="fine">
          想搜索或看往日选题？<Link href="/login?next=/topics">先登录</Link>
        </p>
      )}
      {dates.length > 0 ? (
        <div className="chips" style={{ marginTop: 12 }}>
          {dates.slice(0, 12).map((item) => (
            <Link key={item} className={item === selectedDate && !query ? "chip on" : "chip"} href={`/topics?date=${item}`}>
              {item === today ? "今天" : formatShortDate(item)}
            </Link>
          ))}
        </div>
      ) : null}
      {topics.length === 0 ? (
        <div className="empty-state">
          <h3>没有找到选题</h3>
          <p>换个行业，或者等编辑今天更新。</p>
        </div>
      ) : (
        <div className="masonry" style={{ marginTop: 16 }}>
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} favorited={favorites.has(topic.id)} locked={unlock >= 0 && (counts.get(topic.id) || 0) > unlock} />
          ))}
        </div>
      )}
      {lockedCount > 0 ? (
        <div className="unlock-banner">
          <h3>今天还有 {lockedCount} 条没展示</h3>
          <p>登录后可以看到全部日期、搜索和收藏。</p>
          <Link className="btn btn-primary" href="/register">
            免费注册
          </Link>
        </div>
      ) : null}
    </>
  );
}
