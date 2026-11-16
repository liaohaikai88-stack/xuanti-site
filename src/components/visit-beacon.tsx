"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    const body = JSON.stringify({ path: pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/collect", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/collect", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  }, [pathname]);
  return null;
}
