import { aiEnabled } from "@/lib/ai-client";
import { messagesUsedToday } from "@/lib/ai-chat";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getTopic } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, formString, redirectTo, HttpError } from "@/lib/http";
import { canUseAi } from "@/lib/membership";
import { rewriteForShop } from "@/lib/rewrite";
import { getShopProfile } from "@/lib/shop";

export async function POST(req: Request) {
  const form = await req.formData();
  const topicId = Number(formString(form, "topic_id"));
  const back = `/shop?topic=${topicId || ""}`;
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const user = await getCurrentUser();
    if (!user) return redirectTo(req, `/login?next=${encodeURIComponent(back)}`);
    if (!aiEnabled()) return redirectTo(req, `${back}&error=${encodeURIComponent("即将上线")}`);
    if (!canUseAi(user)) return redirectTo(req, `${back}&error=${encodeURIComponent("内测中，联系我们开通")}`);
    const db = getDb();
    const topic = getTopic(db, topicId);
    const shop = getShopProfile(db, user.id);
    if (!topic || !shop) throw new Error("先保存店铺档案，并从一个选题进来");
    await rewriteForShop(db, user, topic, shop, messagesUsedToday(db, user.id));
    return redirectTo(req, `${back}&ok=${encodeURIComponent("已生成，请自己看过再发")}`);
  } catch (error) {
    const message = error instanceof HttpError ? error.message : error instanceof Error ? error.message : "生成失败";
    return redirectTo(req, `${back}&error=${encodeURIComponent(message)}`);
  }
}
