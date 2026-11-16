import type { Metadata } from "next";
import Link from "next/link";
import { betaContactHref, isBillingEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";
import { canUseAi, planPrices } from "@/lib/membership";
import { messagesUsedToday, quotaFor } from "@/lib/ai-chat";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "会员", robots: { index: false, follow: false } };

const ROWS: Array<{ label: string; marks: [boolean, boolean, boolean] }> = [
  { label: "今天拍这条和每日选题", marks: [true, true, true] },
  { label: "每条选题的第一篇文案", marks: [true, true, true] },
  { label: "其余文案、分镜和拆解", marks: [false, true, true] },
  { label: "全部对标", marks: [false, true, true] },
  { label: "违禁词检测", marks: [true, true, true] },
  { label: "一家店铺档案", marks: [true, true, true] },
  { label: "多家店的档案", marks: [false, false, true] },
];

export default async function VipPage() {
  const user = await getCurrentUser();
  const billing = isBillingEnabled();
  const prices = billing ? planPrices() : null;
  const db = getDb();
  const left = user && canUseAi(user) ? Math.max(0, quotaFor(db, user) - messagesUsedToday(db, user.id)) : null;
  const headers = ["免费", "VIP", "门店版"] as const;
  return (
    <article className="shot-card">
      <p className="shot-kicker">会员</p>
      <h1>每天告诉你拍什么，并按你的店写好</h1>
      <p>不承诺播放量。文案要你自己看过再发。</p>
      {left != null ? <p className="fine">今天还剩 {left} 次</p> : null}
      <div className="compare-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th>能看什么</th>
              {headers.map((name) => (
                <th key={name}>
                  {name}
                  {prices && name === "VIP" ? <small>{prices.vip.month} 元/月</small> : null}
                  {prices && name === "门店版" ? <small>{prices.shop.month} 元/月</small> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                {row.marks.map((ok, index) => (
                  <td key={headers[index]}>
                    <span className={ok ? "mark yes" : "mark no"}>{ok ? "✓" : "✕"}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>常见问题</h2>
      <p><strong>额度以后怎么算？</strong> 免费档每天可用次数有限，次日 0 点恢复。</p>
      <p><strong>生成的内容能直接发吗？</strong> 不能直接当终稿。页面会标明「AI 生成，仅供参考」，发布前请你自己看一遍。</p>
      <p><strong>现在能付款吗？</strong> 收费还没开通。需要使用时联系我们，我们会帮你开通，并告诉你可用到哪一天。</p>
      <p id="contact" className="upgrade-note">看全部文案、分镜和拆解</p>
      <a className="btn btn-primary" href={betaContactHref()}>
        申请内测
      </a>
      <p className="fine">
        也可以在<Link href="/privacy">《隐私政策》</Link>里找到【联系邮箱】。
      </p>
    </article>
  );
}
