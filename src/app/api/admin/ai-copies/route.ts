import { draftReferenceCopies } from "@/lib/ai-draft";
import { aiEnabled } from "@/lib/ai-client";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getTopic } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, formString, redirectTo, safePath } from "@/lib/http";

export async function POST(req: Request) {
  const form = await req.formData();
  const back = safePath(formString(form, "return_to"), "/admin/topics");
  try {
    assertSameOrigin(req);
    await ensureBootstrapped();
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "admin") return redirectTo(req, "/login?next=/admin");
    if (!aiEnabled()) return redirectTo(req, `${back}?error=${encodeURIComponent("即将上线")}`);
    const topic = getTopic(getDb(), Number(formString(form, "topic_id")));
    if (!topic) return redirectTo(req, `${back}?error=${encodeURIComponent("找不到选题")}`);
    const saved = await draftReferenceCopies(getDb(), topic);
    return redirectTo(req, `${back}?ok=${encodeURIComponent(`已生成 ${saved} 条草稿，请检查后再发布`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败";
    return redirectTo(req, `${back}?error=${encodeURIComponent(message)}`);
  }
}
