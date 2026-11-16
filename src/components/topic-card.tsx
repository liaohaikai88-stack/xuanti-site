import Link from "next/link";
import { platformClass, splitPlatforms } from "@/lib/platforms";
import { topicCopyText } from "@/lib/content";
import type { Topic } from "@/lib/types";
import { CopyButton } from "./copy-button";
import { FavoriteButton } from "./favorite-button";

export function TopicCard({ topic, favorited = false }: { topic: Topic; favorited?: boolean }) {
  const platforms = splitPlatforms(topic.platform);
  return (
    <article className="topic-card" style={{ ["--tone" as string]: topic.industryColor }} data-rhythm={topic.id % 3}>
      <div className="topic-card-top">
        <span className="ind-tag">{topic.industryName}</span>
        <span className="plats">
          {platforms.map((name) => (
            <span key={name} className={`plat plat-${platformClass(name)}`}>
              {name}
            </span>
          ))}
        </span>
      </div>
      {topic.isSample ? <span className="sample-badge">示例</span> : null}
      <h3>
        <Link href={`/topics/${topic.id}`}>{topic.title}</Link>
      </h3>
      <p className="hook">「{topic.hook}」</p>
      <div className="topic-card-foot">
        <span className="form-name">{topic.contentForm}</span>
        <div className="card-actions">
          <CopyButton text={topicCopyText(topic)} />
          <FavoriteButton topicId={topic.id} initial={favorited} />
        </div>
      </div>
    </article>
  );
}
