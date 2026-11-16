import { canFavorite } from "@/lib/access";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { toggleFavorite } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, formString, redirectTo, safePath } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  assertSameOrigin(req);
  await ensureBootstrapped();
  const user = await getCurrentUser();
  const contentType = req.headers.get("content-type") || "";
  const wantsJson = contentType.includes("application/json") || (req.headers.get("accept") || "").includes("application/json");
  if (!user) {
    if (wantsJson) return NextResponse.json({ error: "请先登录" }, { status: 401 });
    return redirectTo(req, "/login?next=/topics");
  }
  if (!canFavorite(user)) {
    if (wantsJson) return NextResponse.json({ error: "当前账号还不能收藏" }, { status: 403 });
    return redirectTo(req, "/me?error=" + encodeURIComponent("当前账号还不能收藏"));
  }
  let topicId = 0;
  let returnTo = "/me";
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { topicId?: number };
    topicId = Number(body.topicId);
  } else {
    const form = await req.formData();
    topicId = Number(formString(form, "topic_id"));
    returnTo = safePath(formString(form, "return_to"), "/me");
  }
  if (!Number.isInteger(topicId) || topicId <= 0) {
    if (wantsJson) return NextResponse.json({ error: "选题不存在" }, { status: 400 });
    return redirectTo(req, `${returnTo}?error=${encodeURIComponent("选题不存在")}`);
  }
  try {
    const favorited = toggleFavorite(getDb(), user.id, topicId);
    if (wantsJson) return NextResponse.json({ favorited });
    return redirectTo(req, returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "收藏失败";
    if (wantsJson) return NextResponse.json({ error: message }, { status: 400 });
    return redirectTo(req, `${returnTo}?error=${encodeURIComponent(message)}`);
  }
}
