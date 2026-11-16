import type { Metadata } from "next";
import type { ReactNode } from "react";
import { baiduTongjiSnippet } from "@/lib/analytics";
import { VisitBeacon } from "@/components/visit-beacon";
import { brand, canonicalUrl } from "@/lib/config";
import { ensureBootstrapped } from "@/lib/bootstrap";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(canonicalUrl()),
    title: {
      default: `${brand.name} - ${brand.heroTitle}`,
      template: `%s · ${brand.name}`,
    },
    description: brand.description,
    applicationName: brand.name,
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: brand.name,
      title: `${brand.name} - ${brand.heroTitle}`,
      description: brand.description,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureBootstrapped();
  const tongji = baiduTongjiSnippet();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: canonicalUrl(),
    description: brand.description,
    inLanguage: "zh-CN",
  };
  return (
    <html lang="zh-CN">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {tongji ? <script dangerouslySetInnerHTML={{ __html: tongji }} /> : null}
        <VisitBeacon />
        {children}
      </body>
    </html>
  );
}
