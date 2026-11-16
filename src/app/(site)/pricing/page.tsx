import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { annualPriceYuan, isBillingEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = { title: "年度会员", robots: { index: false, follow: false } };

export default async function PricingPage() {
  if (!isBillingEnabled()) notFound();
  const user = await getCurrentUser();
  const price = annualPriceYuan();
  return (
    <article className="shot-card">
      <h1>年度会员</h1>
      <p className="shot-hook">{price} 元 / 年</p>
      <p>开通后可查看全部选题、历史、搜索、收藏和完整拆解。支付渠道尚未接入，提交后由管理员确认并开通。</p>
      {user ? (
        <form method="post" action="/api/billing/orders">
          <button className="btn btn-primary" type="submit">
            提交开通申请
          </button>
        </form>
      ) : (
        <a className="btn btn-primary" href="/login?next=/pricing">
          登录后申请
        </a>
      )}
    </article>
  );
}
