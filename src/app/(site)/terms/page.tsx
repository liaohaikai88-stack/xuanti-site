import type { Metadata } from "next";
import { getLegal } from "@/lib/content";
import { getDb } from "@/lib/db";
import { MarkdownView } from "@/components/markdown-view";

export const metadata: Metadata = { title: "用户协议", description: "今天拍啥用户协议。" };

export default function TermsPage() {
  const doc = getLegal(getDb(), "terms");
  return (
    <article className="shot-card legal-note">
      {doc ? <MarkdownView source={doc.content} /> : <p>协议还没有发布。</p>}
    </article>
  );
}
