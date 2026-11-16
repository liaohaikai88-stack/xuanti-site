import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/me", "/login", "/register"] },
    sitemap: `${canonicalUrl()}/sitemap.xml`,
  };
}
