import type { Metadata } from "next";
import Link from "next/link";
import { messagesUsedToday, quotaFor } from "@/lib/ai-chat";
import { isBillingEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { canUseAi, planPrices, resolvedQuotas } from "@/lib/membership";

export const metadata: Metadata = { title: "会员", robots: { index: false, follow: false } };

export default async function VipPage() {
  const user = await getCurrentUser();
  const db = getDb();
  const free = resolvedQuotas(db, "free");
  const vip = resolvedQuotas(db, "vip");
  const shop = resolvedQuotas(db, "shop");
  const billing = isBillingEnabled();
  const prices = billing ? planPrices() : null;
  const left = user && canUseAi(user) ? Math.max(0, quotaFor(db, user) - messagesUsedToday(db, user.id)) : null;
  const email = (process.env.CONTACT_EMAIL || "").trim();
  const rows = [
    ["每日选题和今天拍这条", "全部", "全部", "全部"],
    ["参考文案、分镜、拆解、对标", free.copyUnlock < 0 ? "全部" : `每条前 ${free.copyUnlock} 项`, "全部", "全部"],
    ["按我的店改写", `每天 ${free.aiDaily} 次`, `每天 ${vip.aiDaily} 次`, `每天 ${shop.aiDaily} 次`],
    ["违禁词检测", "未登录每天 5 次，登录后更多", "不限", "不限"],
    ["店铺档案", "1 家", "1 家", "为多店预留"],
  ];
  return (
    <article className="shot-card">
      <p className="shot-kicker">会员</p>
      <h1>每天告诉你拍什么，并按你的店写好</h1>
      <p>不承诺播放量。文案要你自己看过再发。</p>
      {user ? <p className="fine">{left == null ? "内测中，联系开通" : `今天还剩 ${left} 次`}</p> : <p className="fine">登录后可以看到今天还剩几次。</p>}
      <div className="plan-grid">
        {["免费", "VIP", "门店版"].map((name, index) => (
          <section key={name} className={name === "VIP" ? "plan-col featured" : "plan-col"}>
            <h2>{name}</h2>
            {prices && name === "VIP" ? <p className="fine">{prices.vip.month} 元 / 月 · {prices.vip.year} 元 / 年</p> : null}
            {prices && name === "门店版" ? <p className="fine">{prices.shop.month} 元 / 月 · {prices.shop.year} 元 / 年</p> : null}
            <ul>
              {rows.map((row) => (
                <li key={row[0]}>
                  <span>{row[0]}</span>
                  <b>{row[index + 1]}</b>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <h2>常见问题</h2>
      <p><strong>额度怎么算？</strong> 按上海时间的自然日计算，用完后第二天恢复。</p>
      <p><strong>生成的内容能直接发吗？</strong> 不能直接当终稿。页面会标明「AI 生成，仅供参考」，发布前请你自己看一遍。</p>
      <p><strong>现在能付款吗？</strong> 收费还没开通。需要使用时联系我们，由管理员开通并设置到期日。</p>
      <p className="upgrade-note">内测中，联系开通</p>
      {email ? (
        <a className="btn btn-primary" href={`mailto:${email}`}>
          发邮件
        </a>
      ) : (
        <p className="fine">
          联系方式见<Link href="/privacy">《隐私政策》</Link>里的【联系邮箱】。
        </p>
      )}
    </article>
  );
}
