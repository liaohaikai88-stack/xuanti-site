import Link from "next/link";
import { platformClass, splitPlatforms } from "@/lib/platforms";
import { topicCopyText } from "@/lib/content";
import type { Topic } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { FavoriteButton } from "./favorite-button";

export function TopicCard({ topic, favorited = false, locked = false }: { topic: Topic; favorited?: boolean; locked?: boolean }) {
  const platforms = splitPlatforms(topic.platform);
  const stars = "★".repeat(topic.difficulty) + "☆".repeat(Math.max(0, 3 - topic.difficulty));
  return (
    <article className="topic-card" style={{ ["--tone" as string]: topic.industryColor }} data-rhythm={topic.id % 3}>
      <div className="topic-card-top">
        <span className="ind-tag">{topic.subIndustry || topic.industryName}</span>
        <span className="plats">
          {platforms.map((name) => (
            <span key={name} className={`plat plat-${platformClass(name)}`}>
              {name}
            </span>
          ))}
          {locked ? <span className="lock-dot" title="有更多参考文案">锁</span> : null}
        </span>
      </div>
      {topic.isSample ? <span className="sample-badge">示例</span> : null}
      <h3 className="title-clamp">
        <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
      </h3>
      <p className="hook hook-line">「{topic.hook}」</p>
      <div className="topic-card-foot">
        <span className="form-name">
          {topic.contentForm} · {stars} · {topic.heatSource}
        </span>
        <div className="card-actions">
          <CopyButton text={topicCopyText(topic)} />
          <FavoriteButton topicId={topic.id} initial={favorited} />
        </div>
      </div>
      {locked ? (
        <div className="vip-blur card-blur" aria-hidden="true">
          <span />
          <span />
        </div>
      ) : null}
    </article>
  );
}
