import { createMembershipOrder } from "@/lib/billing";
import { isBillingEnabled } from "@/lib/config";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { assertSameOrigin, redirectTo } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  assertSameOrigin(req);
  if (!isBillingEnabled()) return NextResponse.json({ error: "billing_disabled" }, { status: 404 });
  await ensureBootstrapped();
  const user = await getCurrentUser();
  if (!user) return redirectTo(req, "/login?next=/pricing");
  try {
    createMembershipOrder(getDb(), user.id);
    return redirectTo(req, "/me?ok=订单已提交，等待管理员开通");
  } catch (error) {
    const message = error instanceof Error ? error.message : "下单失败";
    return redirectTo(req, `/pricing?error=${encodeURIComponent(message)}`);
  }
}
