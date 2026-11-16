import { todayShanghai } from "@/lib/dates";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function ImportTopicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action" encType="multipart/form-data">
        <input type="hidden" name="action" value="import_topics" />
        <input type="hidden" name="return_to" value="/admin/topics/import" />
        <h2>批量导入选题</h2>
        <p className="fine">
          CSV 请使用 UTF-8。表头：行业、选题标题、开头钩子、适合平台、内容形式。可选：发布日期、排序。
          <a href="/api/admin/template?kind=topics"> 下载当前种子作为模板</a>
        </p>
        <label>
          <span className="field-label">CSV 文件</span>
          <input name="file" type="file" accept=".csv,text/csv" required />
        </label>
        <label>
          <span className="field-label">没有「发布日期」列时，用这一天</span>
          <input name="publish_date" type="date" defaultValue={todayShanghai()} required />
        </label>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" /> 全部标记为示例
        </label>
        <button className="btn btn-primary" type="submit">
          开始导入
        </button>
      </form>
    </>
  );
}
