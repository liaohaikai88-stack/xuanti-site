import { Flash } from "@/components/flash";
import { getDb } from "@/lib/db";
import { listForbiddenWords } from "@/lib/forbidden";
import { one } from "@/lib/query";

export default async function ForbiddenAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const words = listForbiddenWords(getDb());
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="add_forbidden" />
        <input type="hidden" name="return_to" value="/admin/forbidden" />
        <h2>添加词条</h2>
        <div className="grid-2">
          <label><span className="field-label">词</span><input name="phrase" required /></label>
          <label><span className="field-label">建议替换</span><input name="replacement" /></label>
          <label><span className="field-label">分类</span><input name="category" placeholder="绝对化 / 功效 / 导流" /></label>
        </div>
        <button type="submit">添加</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>词</th><th>替换</th><th>分类</th><th></th></tr></thead>
          <tbody>
            {words.map((word) => (
              <tr key={word.id}>
                <td>{word.phrase}</td>
                <td>{word.replacement}</td>
                <td>{word.category}</td>
                <td>
                  <form method="post" action="/api/admin/action">
                    <input type="hidden" name="action" value="disable_forbidden" />
                    <input type="hidden" name="id" value={word.id} />
                    <input type="hidden" name="return_to" value="/admin/forbidden" />
                    <button type="submit">停用</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
