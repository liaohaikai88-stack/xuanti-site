import Link from "next/link";
import { redirect } from "next/navigation";
import { aiEnabled } from "@/lib/ai-client";
import { canUseAi } from "@/lib/membership";
import { listConversations, listMessages, quotaFor, messagesUsedToday } from "@/lib/ai-chat";
import { getTopic } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { AiChat } from "@/components/ai-chat";
import { one } from "@/lib/query";

export const metadata = { title: "问问AI", robots: { index: false, follow: false } };

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!canUseAi(user)) redirect("/");
  const enabled = aiEnabled();
  const topicId = Number(one(params.topic) || 0);
  const conversationId = Number(one(params.c) || 0);
  const db = getDb();
  const topic = topicId ? getTopic(db, topicId) : null;
  const conversations = user ? listConversations(db, user.id) : [];
  const active = user && conversationId ? conversations.find((item) => item.id === conversationId) : undefined;
  const messages = active ? listMessages(db, active.id) : [];
  const quota = user ? quotaFor(db, user) : 0;
  const used = user ? messagesUsedToday(db, user.id) : 0;

  return (
    <>
      <div className="section-head">
        <div>
          <h1>问问 AI</h1>
          <p>把选题改成你家的口播或小红书笔记。不承诺播放量，也不写夸张词。</p>
        </div>
      </div>
      {!enabled ? <p className="alert">即将上线</p> : null}
      {enabled && !user ? (
        <div className="empty-state">
          <h3>登录后就能问</h3>
          <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(topic ? `/ai?topic=${topic.id}` : "/ai")}`}>
            登录
          </Link>
        </div>
      ) : null}
      {user ? (
        <div className="chat-layout">
          <aside className="chat-side">
            <Link className="chip" href={topic ? `/ai?topic=${topic.id}` : "/ai"}>
              新对话
            </Link>
            {conversations.map((item) => (
              <Link key={item.id} className={item.id === active?.id ? "chip on" : "chip"} href={`/ai?c=${item.id}`}>
                {item.title}
              </Link>
            ))}
          </aside>
          <AiChat
            enabled={enabled}
            conversationId={active?.id}
            topicId={topic?.id}
            initialMessages={messages}
            quotaLabel={!enabled ? "即将上线" : `今天还剩 ${Math.max(0, quota - used)} 次`}
          />
        </div>
      ) : null}
    </>
  );
}
