import Link from "next/link";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function ImportCopiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action" encType="multipart/form-data">
        <input type="hidden" name="action" value="import_copies" />
        <input type="hidden" name="return_to" value="/admin/topics/import-copies" />
        <h2>导入参考文案</h2>
        <p className="fine">
          用选题标题对应到已有选题。表头：选题标题、文案风格、文案正文、为什么这样写。可选：分镜、发布日期或日期。
          分镜一行一个镜头，例如「镜头1 0-3秒 | 拍后厨门 | 开门」。没有分镜时，前台不显示分镜页。
        </p>
        <input name="file" type="file" accept=".csv,text/csv" required />
        <button className="btn btn-primary" type="submit">导入</button>
      </form>
      <p><Link href="/admin/topics">返回选题</Link></p>
    </>
  );
}
