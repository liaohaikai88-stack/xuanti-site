import { aiEnabled, streamChat, AiNotConfiguredError } from "@/lib/ai-client";
import {
  addMessage,
  assertCanSend,
  createConversation,
  getConversation,
  recentMessages,
  screenInput,
  screenOutput,
  topicContext,
} from "@/lib/ai-chat";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getTopic } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureBootstrapped();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "即将上线" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    conversationId?: number;
    topicId?: number;
    content?: string;
  };
  const content = (body.content || "").trim().slice(0, 2000);
  if (!content) return NextResponse.json({ error: "写点内容再发送" }, { status: 400 });
  try {
    screenInput(content);
    assertCanSend(getDb(), user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发送失败" }, { status: 400 });
  }

  const db = getDb();
  let conversationId = Number(body.conversationId || 0);
  const topic = body.topicId ? getTopic(db, Number(body.topicId)) : null;
  if (!conversationId || !getConversation(db, user.id, conversationId)) {
    conversationId = createConversation(db, user.id, content, topic?.id ?? null);
  }
  addMessage(db, conversationId, "user", content);
  const history = recentMessages(db, conversationId);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      try {
        let full = "";
        await streamChat({
          timeoutMs: 35000,
          messages: [{ role: "system", content: topicContext(topic) }, ...history],
          onDelta(delta) {
            full += delta;
            send({ delta });
          },
        });
        const safe = screenOutput(full);
        addMessage(db, conversationId, "assistant", safe || "我这边没有生成出内容，换个问法试试。");
        if (safe !== full) send({ replace: safe });
        send({ done: true, conversationId });
      } catch (error) {
        const message = error instanceof AiNotConfiguredError ? "即将上线" : error instanceof Error ? error.message : "生成失败";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
