import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export const metadata: Metadata = { title: "注册", robots: { index: false, follow: false } };

export default async function RegisterPage({
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
        <h1>注册今天拍啥</h1>
        <p className="muted">注册后即可查看全部选题。当前不收费。</p>
        <Flash error={one(params.error)} />
        <form className="form" method="post" action="/api/auth/register">
          <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />
          <label>
            <span>用户名</span>
            <input name="username" autoComplete="username" required minLength={2} maxLength={20} />
          </label>
          <label>
            <span>邮箱</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <label>
            <span>再输入一次密码</span>
            <input name="password_again" type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <label className="consent">
            <input type="checkbox" name="consent" value="yes" required />
            <span>
              我已阅读并同意
              <Link href="/terms" target="_blank">
                《用户协议》
              </Link>
              和
              <Link href="/privacy" target="_blank">
                《隐私政策》
              </Link>
            </span>
          </label>
          <button className="btn btn-primary" type="submit">
            注册并进入
          </button>
        </form>
        <p className="fine">
          已有账号？<Link href={`/login?next=${encodeURIComponent(next)}`}>去登录</Link>
        </p>
      </div>
    </div>
  );
}
