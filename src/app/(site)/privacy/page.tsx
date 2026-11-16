import type { Metadata } from "next";
import { getLegal } from "@/lib/content";
import { getDb } from "@/lib/db";
import { MarkdownView } from "@/components/markdown-view";

export const metadata: Metadata = { title: "隐私政策", description: "今天拍啥隐私政策。" };

export default function PrivacyPage() {
  const doc = getLegal(getDb(), "privacy");
  return (
    <article className="shot-card legal-note">
      {doc ? <MarkdownView source={doc.content} /> : <p>隐私政策还没有发布。</p>}
    </article>
  );
}
