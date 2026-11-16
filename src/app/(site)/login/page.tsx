import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export const metadata: Metadata = { title: "登录", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = one(params.next) || "/";
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo />
        <h1>登录今天拍啥</h1>
        <p className="muted">用邮箱或用户名。登录后可以看全部选题、搜索和收藏。</p>
        <Flash error={one(params.error)} />
        <form className="form" method="post" action="/api/auth/login">
          <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />
          <label>
            <span>邮箱或用户名</span>
            <input name="account" autoComplete="username" required />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn btn-primary" type="submit">
            登录
          </button>
        </form>
        <p className="fine">
          还没有账号？<Link href={`/register?next=${encodeURIComponent(next)}`}>免费注册</Link>
        </p>
        <p className="fine">手机号验证码登录即将开放。</p>
      </div>
    </div>
  );
}
