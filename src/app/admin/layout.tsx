import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/current-user";

const LINKS = [
  ["/admin", "概览"],
  ["/admin/topics", "选题"],
  ["/admin/topics/import", "导入选题"],
  ["/admin/calendar", "日历"],
  ["/admin/cases", "拆解"],
  ["/admin/industries", "行业"],
  ["/admin/users", "用户"],
  ["/admin/orders", "订单"],
  ["/admin/legal", "协议"],
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");
  return (
    <div className="admin-shell">
      <div className="section-head">
        <div>
          <h1>今天拍啥 · 后台</h1>
          <p>{user.username}</p>
        </div>
        <Link href="/">回前台</Link>
      </div>
      {isBillingEnabled() ? null : (
        <p className="admin-banner">收费功能已关闭（MEMBERSHIP_BILLING_ENABLED=false）。用户侧不展示价格和订单。登录用户即可看全部内容。下面的会员和订单只是内部预留。</p>
      )}
      <nav className="admin-nav">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
