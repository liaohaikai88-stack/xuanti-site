import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function casesDisabled(): boolean {
  const value = (process.env["CASES_ENABLED"] || "false").trim().toLowerCase();
  return !(value === "1" || value === "true" || value === "yes" || value === "on");
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (casesDisabled() && (path === "/cases" || path.startsWith("/cases/"))) {
    return new NextResponse("找不到页面\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers(request.headers);
  headers.set("x-pathname", path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
