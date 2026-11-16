"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "今日选题", match: (path: string) => path === "/" },
  { href: "/topics", label: "选题库", match: (path: string) => path.startsWith("/topics") },
  { href: "/calendar", label: "热点日历", match: (path: string) => path.startsWith("/calendar") },
  { href: "/cases", label: "爆款拆解", match: (path: string) => path.startsWith("/cases"), cases: true },
  { href: "/tools/copy", label: "文案工具", match: (path: string) => path.startsWith("/tools") },
];

export function DesktopNav({ showCases = false }: { showCases?: boolean }) {
  const pathname = usePathname();
  const links = LINKS.filter((link) => showCases || !("cases" in link && link.cases));
  return (
    <nav className="desktop-nav" aria-label="主导航">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={link.match(pathname) ? "active" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

const TABS = [
  { href: "/", label: "今日", icon: "sun" },
  { href: "/topics", label: "选题", icon: "cards" },
  { href: "/calendar", label: "日历", icon: "cal" },
  { href: "/cases", label: "拆解", icon: "bolt", cases: true },
  { href: "/me", label: "我的", icon: "user" },
];

export function BottomNav({ showCases = false }: { showCases?: boolean }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => showCases || !("cases" in tab && tab.cases));
  return (
    <nav className={showCases ? "bottom-nav" : "bottom-nav bottom-nav-4"} aria-label="底部导航">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "active" : undefined}>
            <TabIcon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TabIcon({ name }: { name: string }) {
  if (name === "sun") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  if (name === "cards") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="12" height="14" rx="2" />
        <path d="M8 9h6M10 5v14M16 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9" />
      </svg>
    );
  }
  if (name === "cal") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    );
  }
  if (name === "bolt") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M13 3 6 13h6l-1 8 7-10h-6l1-8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" />
    </svg>
  );
}
