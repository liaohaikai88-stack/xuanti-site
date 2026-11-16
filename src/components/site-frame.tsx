import Link from "next/link";
import { isBillingEnabled, siteDomain } from "@/lib/config";
import type { User } from "@/lib/types";
import { Logo } from "./logo";
import { BottomNav, DesktopNav } from "./nav";

export function Header({ user }: { user: User | null }) {
  return (
    <header className="topbar">
      <Logo />
      <DesktopNav />
      <div className="top-actions">
        {isBillingEnabled() ? (
          <Link href="/pricing" className="nav-extra">
            升级
          </Link>
        ) : null}
        {user?.role === "admin" ? <Link href="/admin">后台</Link> : null}
        {user ? (
          <Link href="/me" className="user-chip">
            {user.username}
          </Link>
        ) : (
          <>
            <Link href="/login" className="btn btn-ghost btn-sm">
              登录
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              注册
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <strong>今天拍啥</strong>
      <div>给餐饮、美业、本地生活老板的每日拍摄选题。</div>
      <div className="footer-links">
        <Link href="/terms">用户协议</Link>
        <Link href="/privacy">隐私政策</Link>
        <Link href="/calendar">热点日历</Link>
      </div>
      <div>域名 {siteDomain()} · 带「示例」的拆解和部分选题是演示内容。</div>
    </footer>
  );
}

export function BottomNavSlot() {
  return <BottomNav />;
}
