import { listIndustries } from "@/lib/content";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function IndustriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const industries = listIndustries(getDb());
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="create_industry" />
        <input type="hidden" name="return_to" value="/admin/industries" />
        <h2>新增行业</h2>
        <div className="grid-2">
          <label>
            <span className="field-label">名称</span>
            <input name="name" required />
          </label>
          <label>
            <span className="field-label">别名</span>
            <input name="slug" placeholder="可留空，自动生成" />
          </label>
        </div>
        <div className="grid-2">
          <label>
            <span className="field-label">颜色</span>
            <input name="color" type="color" defaultValue="#FF4F17" />
          </label>
          <label>
            <span className="field-label">排序</span>
            <input name="sort_order" type="number" defaultValue={industries.length + 1} />
          </label>
        </div>
        <label>
          <span className="field-label">说明</span>
          <input name="description" />
        </label>
        <button className="btn btn-primary" type="submit">
          添加
        </button>
      </form>
      {industries.map((industry) => (
        <form key={industry.id} className="admin-form" method="post" action="/api/admin/action">
          <input type="hidden" name="action" value="update_industry" />
          <input type="hidden" name="id" value={industry.id} />
          <input type="hidden" name="return_to" value="/admin/industries" />
          <div className="grid-2">
            <input name="name" defaultValue={industry.name} required />
            <input name="slug" defaultValue={industry.slug} required />
          </div>
          <div className="grid-2">
            <input name="color" type="color" defaultValue={industry.color} />
            <input name="sort_order" type="number" defaultValue={industry.sortOrder} />
          </div>
          <input name="description" defaultValue={industry.description} />
          <button className="btn btn-primary btn-sm" type="submit">
            保存 {industry.name}
          </button>
        </form>
      ))}
    </>
  );
}
