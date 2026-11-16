import { notFound } from "next/navigation";
import { getCase, listIndustries } from "@/lib/content";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function EditCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const item = getCase(getDb(), Number(id));
  if (!item) notFound();
  const industries = listIndustries(getDb());
  return (
    <>
      <Flash error={one(query.error)} ok={one(query.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="update_case" />
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="return_to" value={`/admin/cases/${item.id}`} />
        <h2>编辑拆解</h2>
        <label>
          <span className="field-label">标题</span>
          <input name="title" defaultValue={item.title} required />
        </label>
        <div className="grid-2">
          <label>
            <span className="field-label">平台</span>
            <input name="platform" defaultValue={item.platform} required />
          </label>
          <label>
            <span className="field-label">行业</span>
            <select name="industry_id" defaultValue={item.industryId ?? ""}>
              <option value="">不限</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span className="field-label">导语</span>
          <textarea name="teaser" defaultValue={item.teaser} required />
        </label>
        <label>
          <span className="field-label">正文</span>
          <textarea name="body" defaultValue={item.body} required style={{ minHeight: 280 }} />
        </label>
        <label>
          <span className="field-label">发布日期</span>
          <input name="published_at" type="date" defaultValue={item.publishedAt.slice(0, 10)} />
        </label>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" defaultChecked={item.isSample} /> 示例
        </label>
        <button className="btn btn-primary" type="submit">
          保存
        </button>
      </form>
      <form method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="delete_case" />
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="return_to" value="/admin/cases" />
        <button className="btn btn-ghost" type="submit">
          删除
        </button>
      </form>
    </>
  );
}
