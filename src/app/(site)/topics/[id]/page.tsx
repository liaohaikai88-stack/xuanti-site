import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { canReadTopic, hasFullAccess, splitPreview } from "@/lib/access";
import { listBenchmarks, benchmarkAsOf } from "@/lib/benchmarks";
import { listTopicCopies, splitCopiesForViewer } from "@/lib/copies";
import { favoriteIdSet, getTopic, listTopics, topicCopyText } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import type { User } from "@/lib/types";
import { getDb } from "@/lib/db";
import { formatChineseDate, todayShanghai } from "@/lib/dates";
import { betaContactHref } from "@/lib/config";
import { canUseAi, copyUnlockFor } from "@/lib/membership";
import { platformClass, splitPlatforms } from "@/lib/platforms";
import { shootMinutesFor } from "@/lib/storyboard";
import { CopyButton } from "@/components/copy-button";
import { FavoriteButton } from "@/components/favorite-button";
import { TopicCard } from "@/components/topic-card";
import { TopicStudio } from "@/components/topic-studio";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const db = getDb();
  const topic = getTopic(db, Number(id));
  const user = await getCurrentUser();
  const today = todayShanghai();
  const todays = listTopics(db, { date: today });
  if (!topic || !canReadTopic(topic, todays, user, today)) {
    return { title: "登录后查看选题", robots: { index: false, follow: false } };
  }
  return {
    title: topic.title,
    description: topic.hook,
    openGraph: { title: topic.title, description: topic.hook },
  };
}

export default async function TopicDetailPage({ params }: Params) {
  const { id } = await params;
  const db = getDb();
  const topic = getTopic(db, Number(id));
  if (!topic) notFound();
  const user = await getCurrentUser();
  const today = todayShanghai();
  const todays = listTopics(db, { date: today });
  if (topic.status !== "published" && user?.role !== "admin") notFound();
  const allowed = canReadTopic(topic, todays, user, today) || user?.role === "admin";
  if (!allowed) {
    return (
      <div className="shot-card lock-panel">
        <div className="shot-kicker">今天拍啥</div>
        <h1>这条选题需要登录后查看</h1>
        <p className="muted">未登录只能看今天的前几条。登录后可以看全部选题和往日内容。</p>
        <Link className="btn btn-primary" href={`/login?next=/topics/${topic.id}`}>
          登录查看
        </Link>
      </div>
    );
  }
  const favorites = user && hasFullAccess(user) ? favoriteIdSet(db, user.id) : new Set<number>();
  const previewIds = new Set(splitPreview(todays, null).visible.map((item) => item.id));
  const related = listTopics(db, { industrySlug: topic.industrySlug })
    .filter((item) => item.id !== topic.id && (hasFullAccess(user) || previewIds.has(item.id)))
    .slice(0, 3);

  return (
    <>
      <article className="shot-card" style={{ borderTop: `6px solid ${topic.industryColor}` }}>
        <div className="shot-kicker">拍摄卡 · {formatChineseDate(topic.publishDate)}</div>
        <div className="meta-row">
          <span className="ind-tag" style={{ ["--tone" as string]: topic.industryColor }}>
            {topic.industryName}
          </span>
          {splitPlatforms(topic.platform).map((name) => (
            <span key={name} className={`plat plat-${platformClass(name)}`}>
              {name}
            </span>
          ))}
          {topic.isSample ? <span className="sample-badge">示例</span> : null}
          {topic.status === "draft" ? <span className="sample-badge">草稿</span> : null}
        </div>
        <h1>{topic.title}</h1>
        <p className="shot-hook">「{topic.hook}」</p>
        <div className="meta-row">
          <span>{topic.subIndustry || topic.industryName}</span>
          <span>{topic.contentForm}</span>
          <span>{"★".repeat(topic.difficulty)}{"☆".repeat(Math.max(0, 3 - topic.difficulty))}</span>
          <span>{topic.heatSource}</span>
          <span>预计 {shootMinutesFor(topic.contentForm, topic.shootMinutes)} 分钟</span>
        </div>
        {topic.note ? <div className="note-box">拍摄备注：{topic.note}</div> : null}
        <div className="card-actions" style={{ marginTop: 16 }}>
          <CopyButton text={topicCopyText(topic)} label="复制标题和钩子" />
          <FavoriteButton topicId={topic.id} initial={favorites.has(topic.id)} />
          {canUseAi(user) ? (
            <Link className="btn btn-ghost" href={`/ai?topic=${topic.id}`}>
              用这个选题帮我写
            </Link>
          ) : null}
        </div>
      </article>
      <CopySection topicId={topic.id} topicTitle={topic.title} viewer={user} />
      {related.length > 0 ? (
        <section>
          <div className="section-head">
            <h2>同行业还可以拍</h2>
          </div>
          <div className="masonry">
            {related.map((item) => (
              <TopicCard key={item.id} topic={item} favorited={favorites.has(item.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function CopySection({ topicId, topicTitle, viewer }: { topicId: number; topicTitle: string; viewer: User | null }) {
  const db = getDb();
  const unlock = copyUnlockFor(db, viewer);
  const copies = listTopicCopies(db, topicId);
  const copySplit = splitCopiesForViewer(copies, unlock);
  const boardSplit = splitCopiesForViewer(copies.filter((copy) => copy.storyboard.trim()), unlock);
  const whySplit = splitCopiesForViewer(copies.filter((copy) => copy.breakdown.length > 0), unlock);
  const benchSplit = splitCopiesForViewer(listBenchmarks(db, topicTitle), unlock);
  const count = (value: string | number | null) => (value == null || value === "" ? "—" : String(value));
  return (
    <TopicStudio
      topicId={topicId}
      copyText={copies[0] ? `${copies[0].styleLabel}\n${copies[0].body}` : ""}
      copies={copySplit.open.map((copy) => ({ key: String(copy.id), label: copy.styleLabel, body: copy.body }))}
      boards={boardSplit.open.map((copy) => ({ key: String(copy.id), label: copy.styleLabel, text: copy.storyboard }))}
      whys={whySplit.open.map((copy) => ({ key: String(copy.id), label: copy.styleLabel, sections: copy.breakdown }))}
      benches={benchSplit.open.map((item) => ({
        key: String(item.id),
        title: item.title,
        platform: item.platform,
        likes: count(item.likes),
        favorites: count(item.favorites),
        url: item.url,
        asOf: benchmarkAsOf(item.lookedUpAt),
      }))}
      lockedCopies={copySplit.locked.length}
      lockedBoards={boardSplit.locked.length}
      lockedWhys={whySplit.locked.length}
      lockedBenches={benchSplit.locked.length}
      showRewrite={canUseAi(viewer)}
      applyHref={betaContactHref()}
    />
  );
}
