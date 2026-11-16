import type { Metadata } from "next";
import Link from "next/link";
import { hasFullAccess, splitPreview } from "@/lib/access";
import { brand, casesEnabled } from "@/lib/config";
import { cautionVisibleOnHome, favoriteIdSet, getIndustryBySlug, listCases, listCautionEvents, listEvents, listIndustries, listTopics } from "@/lib/content";
import { copyCounts } from "@/lib/copies";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { formatShanghaiClock, ideaForTitle, isShopRelevantHot, isSolemnToday, listHotRows, listManualIdeas } from "@/lib/hot";
import { canUseAi } from "@/lib/membership";
import { addDays, formatShortDate, todayShanghai } from "@/lib/dates";
import { copyUnlockFor } from "@/lib/membership";
import { one } from "@/lib/query";
import { getShopProfile } from "@/lib/shop";
import { shootMinutesFor } from "@/lib/storyboard";
import { TopicCard } from "@/components/topic-card";
import type { Topic } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: `${brand.name} - 今天拍这条` },
  description: brand.description,
};

const PLATFORMS = ["抖音", "小红书", "视频号"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const industrySlug = one(params.industry);
  const platform = PLATFORMS.includes(one(params.platform)) ? one(params.platform) : "";
  const db = getDb();
  const user = await getCurrentUser();
  const today = todayShanghai();
  const industry = industrySlug ? getIndustryBySlug(db, industrySlug) : null;
  const filtered = listTopics(db, { date: today, industrySlug: industry?.slug, platform: platform || undefined });
  const { visible, lockedCount } = splitPreview(filtered, user);
  const profile = user ? getShopProfile(db, user.id) : null;
  const hero = pickHero(visible, profile, Boolean(industry || platform));
  const favorites = user && hasFullAccess(user) ? favoriteIdSet(db, user.id) : new Set<number>();
  const unlock = copyUnlockFor(db, user);
  const counts = copyCounts(db, visible.map((topic) => topic.id));
  const homeCautions = listCautionEvents(db).filter((event) => cautionVisibleOnHome(event, today));
  const showCases = casesEnabled();
  const cases = showCases ? listCases(db).slice(0, 3) : [];
  const industries = listIndustries(db);
  const hot = listHotRows(db);
  const ideas = isSolemnToday(db, today) ? [] : listManualIdeas(db);
  const hotRows = hot.rows.filter((row) => isShopRelevantHot(row.title)).slice(0, 5);
  const showAi = canUseAi(user);
  const hotUpdated = hot.updatedAt ? formatShanghaiClock(hot.updatedAt) : "";
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const events = listEvents(db);

  return (
    <>
      {homeCautions.map((event) => (
        <Link key={event.id} href="/calendar" className="caution-banner">
          <span className="caution-kicker">注意事项</span>
          <strong>
            {event.dateLabel} {event.title}
          </strong>
          <p>{event.caution}</p>
        </Link>
      ))}

      <section className="today-card">
        <p className="shot-kicker">今天拍这条{profile?.subIndustryName ? ` · ${profile.subIndustryName}` : ""}</p>
        {hero ? (
          <>
            <h1>{hero.title}</h1>
            <p className="shot-hook">「{hero.hook}」</p>
            <p>怎么拍：{hero.note || hero.contentForm}</p>
            <p className="fine">预计拍摄 {shootMinutesFor(hero.contentForm, hero.shootMinutes)} 分钟 · {hero.heatSource}</p>
            <div className="hero-actions">
              {showAi ? (
                <Link className="btn btn-primary" href={`/shop?topic=${hero.id}`}>
                  按我的店改写
                </Link>
              ) : null}
              <Link className={showAi ? "btn btn-ghost" : "btn btn-primary"} href={`/topics/${hero.id}`}>
                看完整选题
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1>今天的选题还在准备</h1>
            <p>换个行业或平台，或者先看热点日历。</p>
          </>
        )}
        <p className="fine">{hasFullAccess(user) ? "已登录，今日选题都在下面。" : "未登录先看今天的前几条。"}</p>
      </section>

      <div className="filter-chips">
        <Link className={!industry ? "chip on" : "chip"} href={chipHref("", platform)}>
          全部行业
        </Link>
        {industries.map((item) => (
          <Link key={item.id} className={industry?.id === item.id ? "chip on" : "chip"} href={chipHref(item.slug, platform)}>
            {item.name}
          </Link>
        ))}
        <Link className={!platform ? "chip on" : "chip"} href={chipHref(industry?.slug || "", "")}>
          全部平台
        </Link>
        {PLATFORMS.map((name) => (
          <Link key={name} className={platform === name ? "chip on" : "chip"} href={chipHref(industry?.slug || "", name)}>
            {name}
          </Link>
        ))}
      </div>

      <section>
        <div className="section-head">
          <div>
            <h2>实时热点</h2>
            <p>{hotUpdated ? `更新于 ${hotUpdated}` : "热榜抓取后会出现在这里。"}</p>
          </div>
          <Link href="/hot">看热榜</Link>
        </div>
        <div className="hot-strip">
          {hotRows.length === 0 ? <p className="fine">还没有热榜快照。</p> : null}
          {hotRows.map((row) => {
            const idea = ideaForTitle(ideas, row.title);
            return (
              <article key={`${row.source}-${row.title}`} className="hot-row">
                <b>{row.rank}</b>
                <div>
                  <strong>{row.title}{row.title.includes("示例") ? <span className="sample-badge">示例</span> : null}</strong>
                  <div className="fine">{row.heat || "热度未知"} · {row.tags.join(" ") || row.source}</div>
                  {idea ? <p className="fine">{idea}</p> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="today">
        <div className="section-head">
          <div>
            <h2>今日选题</h2>
            <p>
              {formatShortDate(today)} · 共 {filtered.length} 条
            </p>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <h3>这个筛选下今天没有选题</h3>
            <Link className="btn btn-primary" href="/">
              看全部
            </Link>
          </div>
        ) : (
          <div className="masonry">
            {visible.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                favorited={favorites.has(topic.id)}
                locked={unlock >= 0 && (counts.get(topic.id) || 0) > unlock}
              />
            ))}
          </div>
        )}
        {lockedCount > 0 ? (
          <div className="unlock-banner">
            <h3>还有 {lockedCount} 条今日选题</h3>
            <p>登录后查看其余选题，也可以收藏。</p>
            <Link className="btn btn-primary" href="/register">
              免费注册
            </Link>
          </div>
        ) : null}
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>接下来 7 天</h2>
            <p>节日只作提醒。严肃日子不拿来做营销选题。</p>
          </div>
          <Link href="/calendar">月历</Link>
        </div>
        <div className="week-strip">
          {week.map((day) => {
            const hit = events.find((event) => event.startDate && event.startDate <= day && (event.endDate || event.startDate) >= day);
            const solemn = hit ? cautionVisibleOnHome(hit, day) || hit.eventType === "solemn" : false;
            return (
              <Link key={day} href="/calendar" className={solemn ? "week-day solemn" : "week-day"}>
                <b>{day === today ? "今天" : day.slice(5)}</b>
                <span>{hit ? hit.title : "日常"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="favorite-entry">
        <h2>我的收藏</h2>
        <p>拍过的选题放在这里，下次接着用。</p>
        <Link className="btn btn-ghost" href={user ? "/me#fav" : "/login?next=/me"}>
          打开收藏
        </Link>
      </section>

      {showCases ? (
        <section>
          <div className="section-head">
            <h2>爆款拆解</h2>
            <Link href="/cases">全部拆解</Link>
          </div>
          <div className="case-list">
            {cases.map((item) => (
              <Link key={item.id} href={`/cases/${item.id}`} className="case-card">
                <h3>{item.title}</h3>
                <p className="muted">{item.teaser}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function chipHref(industry: string, platform: string): string {
  const params = new URLSearchParams();
  if (industry) params.set("industry", industry);
  if (platform) params.set("platform", platform);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function pickHero(topics: Topic[], profile: { subIndustryName: string; industryId: number | null } | null, filtered: boolean): Topic | undefined {
  if (!filtered && profile?.subIndustryName) {
    const named = topics.find((topic) => topic.subIndustry === profile.subIndustryName);
    if (named) return named;
    const sameIndustry = topics.find((topic) => topic.industryId === profile.industryId);
    if (sameIndustry) return sameIndustry;
  }
  return topics[0];
}
