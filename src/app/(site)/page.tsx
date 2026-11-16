import type { Metadata } from "next";
import Link from "next/link";
import { hasFullAccess, splitPreview } from "@/lib/access";
import { brand, casesEnabled } from "@/lib/config";
import { cautionVisibleOnHome, favoriteIdSet, listCases, listCautionEvents, listEvents, listIndustries, listTopics } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { formatShortDate, todayShanghai } from "@/lib/dates";
import { TopicCard } from "@/components/topic-card";

export async function generateMetadata(): Promise<Metadata> {
  const count = listTopics(getDb(), { date: todayShanghai() }).length;
  const title = `每天${count}条，${brand.heroAccent}的选题`;
  return { title: { absolute: `${brand.name} - ${title}` }, description: brand.description };
}

export default async function HomePage() {
  const db = getDb();
  const user = await getCurrentUser();
  const today = todayShanghai();
  const todays = listTopics(db, { date: today });
  const dailyCount = todays.length;
  const accessUser = user;
  const { visible, lockedCount } = splitPreview(todays, accessUser);
  const favorites = user && hasFullAccess(user) ? favoriteIdSet(db, user.id) : new Set<number>();
  const homeCautions = listCautionEvents(db).filter((event) => cautionVisibleOnHome(event, today));
  const cautionIds = new Set(homeCautions.map((event) => event.id));
  const upcoming = listEvents(db)
    .filter((event) => event.startDate && event.startDate >= today)
    .slice(0, 3);
  const showCases = casesEnabled();
  const cases = showCases ? listCases(db).slice(0, 3) : [];
  const industries = listIndustries(db);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">抖音 / 小红书都能用</span>
          <h1>
            每天{dailyCount}条，<span>{brand.heroAccent}</span>的选题
          </h1>
          <p className="sub">{brand.heroSubtitle}</p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#today">
              {brand.heroCta}
            </a>
            <Link className="btn btn-ghost" href="/calendar">
              先看热点日历
            </Link>
          </div>
          <p className="hero-note">
            {hasFullAccess(user) ? "你已登录，今日选题已全部开放。" : "未登录可先看今天的前几条。注册登录后可看全部、搜索和收藏。"}
          </p>
          <ul className="hero-points">
            <li>每天更新</li>
            <li>带开头钩子</li>
            <li>餐饮 · 美业 · 本地生活</li>
          </ul>
        </div>
        <div className="hero-deck" aria-hidden="true">
          {visible.slice(0, 3).map((topic) => (
            <div key={topic.id} className="deck-card" style={{ borderTop: `4px solid ${topic.industryColor}` }}>
              <span style={{ color: topic.industryColor }}>{topic.industryName}</span>
              <strong>{topic.title}</strong>
            </div>
          ))}
        </div>
      </section>

      {homeCautions.length > 0 ? (
        <div className="caution-stack">
          {homeCautions.map((event) => (
            <Link key={event.id} href="/calendar" className="caution-banner">
              <span className="caution-kicker">注意事项</span>
              <strong>
                {event.dateLabel} {event.title}
              </strong>
              <p>{event.caution}</p>
            </Link>
          ))}
        </div>
      ) : null}

      <section id="today">
        <div className="section-head">
          <div>
            <h2>今日选题</h2>
            <p>{formatShortDate(today)} · 共 {todays.length} 条</p>
          </div>
          <span className="pill">{hasFullAccess(user) ? "已全部解锁" : `未登录看前 ${visible.length} 条`}</span>
        </div>
        {visible.length === 0 ? (
          <div className="empty-state">
            <h3>今天的选题还在准备</h3>
            <p>先看看热点日历，或者去选题库翻翻。</p>
            <Link className="btn btn-primary" href="/calendar">
              打开热点日历
            </Link>
          </div>
        ) : (
          <div className="masonry">
            {visible.map((topic) => (
              <TopicCard key={topic.id} topic={topic} favorited={favorites.has(topic.id)} />
            ))}
          </div>
        )}
        {lockedCount > 0 ? (
          <div className="unlock-banner">
            <h3>还有 {lockedCount} 条今日选题</h3>
            <p>注册登录后可以查看全部、搜索和收藏。</p>
            <Link className="btn btn-primary" href="/register">
              免费注册
            </Link>
          </div>
        ) : null}
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>按行业找</h2>
            <p>先选你的店，再决定今天拍什么。</p>
          </div>
        </div>
        <div className="industry-row">
          {industries.map((industry) => (
            <Link key={industry.id} href={`/topics?industry=${industry.slug}`} className="industry-link" style={{ ["--tone" as string]: industry.color }}>
              <span>
                <strong>{industry.name}</strong>
                <small style={{ display: "block" }}>{industry.description}</small>
              </span>
              <span style={{ color: industry.color }}>去看</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <div>
            <h2>接下来能借势</h2>
            <p>节气、节日和平台节点，提前把片子排上。</p>
          </div>
          <Link href="/calendar">全部日历</Link>
        </div>
        <div className="event-list">
          {upcoming.map((event) => (
            <article key={event.id} className={cautionIds.has(event.id) ? "event-card solemn" : "event-card"}>
              <div className="event-type">{event.dateLabel}</div>
              <h3>{event.title}</h3>
              {cautionIds.has(event.id) ? (
                <p>{event.caution}</p>
              ) : (
                <p className="prep">{event.directions.map((item) => item.direction).slice(0, 2).join(" · ") || event.title}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      {showCases ? (
        <section>
          <div className="section-head">
            <div>
              <h2>爆款拆解</h2>
              <p>先看结构。标注示例的是演示文本。</p>
            </div>
            <Link href="/cases">全部拆解</Link>
          </div>
          <div className="case-list">
            {cases.map((item) => (
              <Link key={item.id} href={`/cases/${item.id}`} className="case-card">
                {item.isSample ? <span className="sample-badge">示例</span> : null}
                <h3>{item.title}</h3>
                <p className="muted">{item.teaser}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-head">
          <h2>今天就能开拍</h2>
        </div>
        <div className="steps">
          <div className="step">
            <b>01</b>
            <strong>选一条</strong>
            <p className="muted">从今天的卡片里挑一个你店里明天就能拍的。</p>
          </div>
          <div className="step">
            <b>02</b>
            <strong>按钩子开口</strong>
            <p className="muted">第一句用卡片上的开头，别先自我介绍。</p>
          </div>
          <div className="step">
            <b>03</b>
            <strong>发出去</strong>
            <p className="muted">抖音或小红书，按标注的拍法收一条就够。</p>
          </div>
        </div>
      </section>
    </>
  );
}
