import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function BenchmarkImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action" encType="multipart/form-data">
        <input type="hidden" name="action" value="import_benchmarks" />
        <input type="hidden" name="return_to" value="/admin/benchmarks" />
        <h2>导入对标</h2>
        <p className="fine">列：选题标题、对标标题、平台、点赞、收藏、链接、查找时间。点赞和收藏可以空着。只保存标题、数字和链接，不保存正文。</p>
        <input name="file" type="file" accept=".csv,text/csv" required />
        <button className="btn btn-primary" type="submit">开始导入</button>
      </form>
    </>
  );
}
