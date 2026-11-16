import Link from "next/link";
import { listIndustries, listTopics } from "@/lib/content";
import { getDb } from "@/lib/db";
import { todayShanghai } from "@/lib/dates";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function AdminTopicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const db = getDb();
  const topics = listTopics(db, { includeDrafts: true, limit: 80 });
  const industries = listIndustries(db);
  const today = todayShanghai();
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="create_topic" />
        <input type="hidden" name="return_to" value="/admin/topics" />
        <h2>新增选题</h2>
        <div className="grid-2">
          <label>
            <span className="field-label">行业</span>
            <select name="industry_id">
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">发布日期</span>
            <input name="publish_date" type="date" defaultValue={today} required />
          </label>
        </div>
        <label>
          <span className="field-label">选题标题</span>
          <input name="title" required maxLength={80} />
        </label>
        <label>
          <span className="field-label">开头钩子</span>
          <textarea name="hook" required maxLength={300} />
        </label>
        <div className="grid-2">
          <label>
            <span className="field-label">适合平台</span>
            <input name="platform" placeholder="抖音/小红书" required />
          </label>
          <label>
            <span className="field-label">内容形式</span>
            <input name="content_form" placeholder="口播、探店、图文" required />
          </label>
        </div>
        <label>
          <span className="field-label">拍摄备注</span>
          <textarea name="note" />
        </label>
        <div className="grid-2">
          <label>
            <span className="field-label">排序</span>
            <input name="sort_order" type="number" placeholder="留空则自动排到当天最后" />
          </label>
          <label>
            <span className="field-label">状态</span>
            <select name="status" defaultValue="published">
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </select>
          </label>
        </div>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" /> 标记为示例
        </label>
        <button className="btn btn-primary" type="submit">
          保存选题
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>选题</th>
              <th>行业</th>
              <th>形式</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>
                  {topic.publishDate}
                  <div className="fine">{topic.status === "draft" ? "草稿" : "已发布"}{topic.isSample ? " · 示例" : ""}</div>
                </td>
                <td>
                  <strong>{topic.title}</strong>
                  <div className="fine">{topic.hook}</div>
                </td>
                <td>{topic.industryName}</td>
                <td>
                  {topic.platform}
                  <div className="fine">{topic.contentForm}</div>
                </td>
                <td>
                  <Link href={`/admin/topics/${topic.id}`}>编辑</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
