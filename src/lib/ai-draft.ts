import type { DatabaseSync } from "node:sqlite";
import { completeChat, COPYWRITER_RULES } from "./ai-client";
import { createTopicCopy, parseWhy, type BreakdownSection } from "./copies";
import { findSensitive } from "./safety";

export async function draftReferenceCopies(
  db: DatabaseSync,
  topic: { id: number; title: string; hook: string; platform: string; contentForm: string; industryName: string },
): Promise<number> {
  const raw = await completeChat({
    timeoutMs: 40000,
    messages: [
      { role: "system", content: `${COPYWRITER_RULES}\n只返回 JSON，不要 Markdown。` },
      {
        role: "user",
        content: `为这个选题写 4 条参考文案，风格分别是口播脚本、小红书笔记、标题加开头、故事型。每条包含 styleLabel、body、breakdown（数组，每项 heading 和 text，heading 用：钩子、结构、情绪、行动号召、平台）。选题：${topic.title}。钩子：${topic.hook}。行业：${topic.industryName}。平台：${topic.platform}。拍法：${topic.contentForm}。JSON 形状：{"copies":[{"styleLabel":"","body":"","breakdown":[{"heading":"","text":""}]}]}`,
      },
    ],
  });
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回可用的文案");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    copies?: Array<{ styleLabel?: string; body?: string; breakdown?: BreakdownSection[] }>;
  };
  const copies = (parsed.copies || []).slice(0, 5).filter((item) => item.styleLabel && item.body);
  if (copies.length < 3) throw new Error("生成的文案不足 3 条");
  let saved = 0;
  for (const item of copies) {
    const body = String(item.body);
    if (findSensitive(body)) continue;
    const breakdown = Array.isArray(item.breakdown) && item.breakdown.length
      ? item.breakdown
          .map((section) => ({ heading: String(section.heading || "").trim(), text: String(section.text || "").trim() }))
          .filter((section) => section.heading && section.text && !findSensitive(section.text))
      : parseWhy("");
    createTopicCopy(db, {
      topicId: topic.id,
      styleLabel: String(item.styleLabel),
      body,
      breakdown: breakdown.length ? breakdown : [{ heading: "为什么这样写", text: "围绕选题的具体细节来写。" }],
      status: "draft",
    });
    saved += 1;
  }
  if (saved < 3) throw new Error("生成结果里可用的文案不足 3 条");
  return saved;
}
