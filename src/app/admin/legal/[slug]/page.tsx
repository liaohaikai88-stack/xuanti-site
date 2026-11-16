import { notFound } from "next/navigation";
import { getLegal } from "@/lib/content";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function EditLegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (slug !== "terms" && slug !== "privacy") notFound();
  const doc = getLegal(getDb(), slug);
  if (!doc) notFound();
  const query = await searchParams;
  return (
    <>
      <Flash error={one(query.error)} ok={one(query.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="save_legal" />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="return_to" value={`/admin/legal/${slug}`} />
        <h2>编辑{doc.title}</h2>
        <p className="fine">方括号内容（【运营方名称】【联系邮箱】【日期】【服务器所在地，如：中国香港】）上线前请替换。网站名称已经写成「今天拍啥」。保存后用户立刻能看到。</p>
        <label>
          <span className="field-label">标题</span>
          <input name="title" defaultValue={doc.title} required />
        </label>
        <label>
          <span className="field-label">正文</span>
          <textarea name="content" defaultValue={doc.content} style={{ minHeight: 420 }} required />
        </label>
        <button className="btn btn-primary" type="submit">
          保存
        </button>
      </form>
    </>
  );
}
