import { visitorHash } from "@/lib/analytics";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { bumpUsage, findForbiddenHits, listForbiddenWords, usageCount } from "@/lib/forbidden";
import { clientIp } from "@/lib/http";
import { forbiddenQuotaFor, forbiddenUnlimited } from "@/lib/membership";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  await ensureBootstrapped();
  const user = await getCurrentUser();
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "先贴一段文案" }, { status: 400 });
  const db = getDb();
  const quota = forbiddenQuotaFor(db, user);
  const actor = user ? `user:${user.id}` : `anon:${visitorHash(clientIp(req), req.headers.get("user-agent") || "")}`;
  const used = usageCount(db, actor, "forbidden");
  if (used >= quota) {
    return NextResponse.json({ error: "今天的检测次数用完了，明天再来。" }, { status: 429 });
  }
  bumpUsage(db, actor, "forbidden");
  const hits = findForbiddenHits(text, listForbiddenWords(db));
  const left = Math.max(0, quota - used - 1);
  const remaining = forbiddenUnlimited(db, user)
    ? hits.length
      ? "不限次数。命中的词已标出。"
      : "不限次数。未发现词库里的说法。"
    : hits.length
      ? `今天还剩 ${left} 次`
      : `未发现词库里的说法。今天还剩 ${left} 次`;
  return NextResponse.json({ hits, remaining });
}
