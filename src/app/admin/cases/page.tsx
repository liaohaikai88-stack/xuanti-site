import Link from "next/link";
import { listCases, listIndustries } from "@/lib/content";
import { getDb } from "@/lib/db";
import { todayShanghai } from "@/lib/dates";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const db = getDb();
  const cases = listCases(db);
  const industries = listIndustries(db);
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="create_case" />
        <input type="hidden" name="return_to" value="/admin/cases" />
        <h2>新增拆解</h2>
        <label>
          <span className="field-label">标题</span>
          <input name="title" required />
        </label>
        <div className="grid-2">
          <label>
            <span className="field-label">平台</span>
            <input name="platform" required />
          </label>
          <label>
            <span className="field-label">行业</span>
            <select name="industry_id">
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
          <span className="field-label">免费导语</span>
          <textarea name="teaser" required />
        </label>
        <label>
          <span className="field-label">完整正文（Markdown）</span>
          <textarea name="body" required />
        </label>
        <label>
          <span className="field-label">发布日期</span>
          <input name="published_at" type="date" defaultValue={todayShanghai()} />
        </label>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" /> 示例
        </label>
        <button className="btn btn-primary" type="submit">
          保存拆解
        </button>
      </form>
      <ul>
        {cases.map((item) => (
          <li key={item.id}>
            <Link href={`/admin/cases/${item.id}`}>{item.title}</Link>
            {item.isSample ? " · 示例" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}
