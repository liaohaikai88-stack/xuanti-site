import { listHotPitches } from "@/lib/hot";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function AdminHotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const pitches = listHotPitches(getDb(), true);
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="import_hot_json" />
        <input type="hidden" name="return_to" value="/admin/hot" />
        <h2>导入门店借势 JSON</h2>
        <p className="fine">数组字段：title、platform、rank、heat、url、fetched_at、industry、idea。heat 可以是 null。灾难和时政标题会被丢掉。</p>
        <textarea name="json" rows={6} required placeholder='[{"title":"冬日火锅","platform":"微博","rank":1,"heat":null,"url":"https://example.com","fetched_at":"2026-11-16T10:00:00.000Z","industry":"餐饮","idea":"拍一锅还在冒热气的开锅"}]' />
        <button type="submit">导入</button>
      </form>
      <h2>热点选题</h2>
      <p className="fine">这些是根据公开热榜标题生成的原创选题。可以隐藏，不会回到每日选题列表。</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>选题</th><th>来源标题</th><th></th></tr></thead>
          <tbody>
            {pitches.map((pitch) => (
              <tr key={String(pitch.id)}>
                <td>
                  <strong>{String(pitch.title)}</strong>
                  <div className="fine">{String(pitch.hook)}</div>
                </td>
                <td>{String(pitch.hot_title)}{Number(pitch.hidden) ? " · 已隐藏" : ""}</td>
                <td>
                  {Number(pitch.hidden) ? null : (
                    <form method="post" action="/api/admin/action">
                      <input type="hidden" name="action" value="hide_pitch" />
                      <input type="hidden" name="id" value={String(pitch.id)} />
                      <input type="hidden" name="return_to" value="/admin/hot" />
                      <button type="submit">隐藏</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
