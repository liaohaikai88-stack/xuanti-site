import Link from "next/link";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#FF4F17" />
      <path d="M13.5 15.5h21l-2.8 5H16.3l-2.8-5z" fill="#FFE4D6" />
      <rect x="13" y="20.5" width="22" height="15" rx="4" fill="#fff" />
      <path d="M21 25.2v8l8-4-8-4z" fill="#FF4F17" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="今天拍啥，回到首页">
      <LogoMark />
      <span className="logo-word">
        <strong>今天拍啥</strong>
        {compact ? null : <small>每天都有得拍</small>}
      </span>
    </Link>
  );
}
