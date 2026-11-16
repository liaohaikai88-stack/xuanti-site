import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canUseAi, planBadge } from "@/lib/membership";
import { betaContactHref, isBillingEnabled } from "@/lib/config";
import { listFavoriteTopics } from "@/lib/content";
import { listOrdersForUser } from "@/lib/billing";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { TopicCard } from "@/components/topic-card";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export const metadata: Metadata = { title: "我的", robots: { index: false, follow: false } };

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");
  const params = await searchParams;
  const db = getDb();
  const favorites = listFavoriteTopics(db, user.id);
  const billing = isBillingEnabled();
  const orders = billing ? listOrdersForUser(db, user.id) : [];
  return (
    <>
      <div className="section-head">
        <div>
          <h1>{user.username}{planBadge(user) ? <span className="vip-badge">{planBadge(user)}</span> : null}</h1>
          <p>{user.email}</p>
          <p className="fine">{planBadge(user) ? `${planBadge(user)} 到 ${user.planExpiresAt?.slice(0, 10)}` : "免费账号"}</p>
        </div>
      </div>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <div className="chips">
        {canUseAi(user) ? (
          <Link className="chip" href="/ai">
            问问 AI
          </Link>
        ) : (
          <Link className="chip" href={betaContactHref()}>
            申请内测
          </Link>
        )}
        {user.role === "admin" ? (
          <Link className="chip" href="/admin">
            进入后台
          </Link>
        ) : null}
        <form method="post" action="/api/auth/logout">
          <button className="chip" type="submit">
            退出登录
          </button>
        </form>
      </div>
      {billing ? (
        <section>
          <h2>订单</h2>
          {orders.length === 0 ? <p className="fine">还没有订单。</p> : null}
          {orders.map((order) => (
            <p key={order.id}>
              {order.orderNo} · {(order.amountFen / 100).toFixed(0)} 元 · {order.status === "paid" ? "已开通" : order.status === "pending" ? "待管理员开通" : "已取消"}
            </p>
          ))}
          <form method="post" action="/api/billing/orders">
            <button className="btn btn-primary btn-sm" type="submit">
              提交年度会员开通申请
            </button>
          </form>
        </section>
      ) : null}
      <section>
        <div className="section-head" id="fav">
          <h2>我的收藏</h2>
        </div>
        {favorites.length === 0 ? (
          <div className="empty-state">
            <h3>还没有收藏</h3>
            <p>在选题卡片上点收藏，方便拍摄时回看。</p>
            <Link className="btn btn-primary" href="/#today">
              去今日选题
            </Link>
          </div>
        ) : (
          <div className="masonry">
            {favorites.map((topic) => (
              <TopicCard key={topic.id} topic={topic} favorited />
            ))}
          </div>
        )}
      </section>
      <section className="panel" style={{ padding: 16, marginTop: 18 }}>
        <h2>注销账号</h2>
        <p className="fine">注销后账号会被匿名化，收藏会删除。此操作不可恢复。</p>
        <form className="form" method="post" action="/api/account/delete">
          <label>
            <span>输入密码确认</span>
            <input name="password" type="password" required />
          </label>
          <button className="btn btn-ghost" type="submit">
            注销账号
          </button>
        </form>
      </section>
    </>
  );
}
