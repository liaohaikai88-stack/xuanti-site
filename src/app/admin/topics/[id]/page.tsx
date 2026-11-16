import { notFound } from "next/navigation";
import { aiEnabled } from "@/lib/ai-client";
import { formatWhy, listTopicCopies } from "@/lib/copies";
import { getTopic, listIndustries } from "@/lib/content";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function EditTopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const topic = getTopic(getDb(), Number(id));
  if (!topic) notFound();
  const industries = listIndustries(getDb());
  return (
    <>
      <Flash error={one(query.error)} ok={one(query.ok)} />
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="update_topic" />
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="return_to" value={`/admin/topics/${topic.id}`} />
        <h2>编辑选题</h2>
        <label>
          <span className="field-label">行业</span>
          <select name="industry_id" defaultValue={topic.industryId}>
            {industries.map((industry) => (
              <option key={industry.id} value={industry.id}>
                {industry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">标题</span>
          <input name="title" defaultValue={topic.title} required />
        </label>
        <label>
          <span className="field-label">开头钩子</span>
          <textarea name="hook" defaultValue={topic.hook} required />
        </label>
        <div className="grid-2">
          <label>
            <span className="field-label">平台</span>
            <input name="platform" defaultValue={topic.platform} required />
          </label>
          <label>
            <span className="field-label">内容形式</span>
            <input name="content_form" defaultValue={topic.contentForm} required />
          </label>
        </div>
        <div className="grid-2">
          <label>
            <span className="field-label">发布日期</span>
            <input name="publish_date" type="date" defaultValue={topic.publishDate} required />
          </label>
          <label>
            <span className="field-label">排序</span>
            <input name="sort_order" type="number" defaultValue={topic.sortOrder} />
          </label>
        </div>
        <label>
          <span className="field-label">备注</span>
          <textarea name="note" defaultValue={topic.note} />
        </label>
        <label>
          <span className="field-label">状态</span>
          <select name="status" defaultValue={topic.status}>
            <option value="published">发布</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" defaultChecked={topic.isSample} /> 示例
        </label>
        <button className="btn btn-primary" type="submit">
          保存
        </button>
      </form>
      <CopyAdmin topicId={topic.id} />
      <form method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="delete_topic" />
        <input type="hidden" name="id" value={topic.id} />
        <input type="hidden" name="return_to" value="/admin/topics" />
        <button className="btn btn-ghost" type="submit">
          删除这条选题
        </button>
      </form>
    </>
  );
}

function CopyAdmin({ topicId }: { topicId: number }) {
  const copies = listTopicCopies(getDb(), topicId, true);
  const ai = aiEnabled();
  return (
    <section>
      <h2>参考文案</h2>
      <form method="post" action="/api/admin/ai-copies">
        <input type="hidden" name="topic_id" value={topicId} />
        <input type="hidden" name="return_to" value={`/admin/topics/${topicId}`} />
        <button className="btn btn-ghost" type="submit" disabled={!ai}>
          {ai ? "用AI生成参考文案" : "即将上线"}
        </button>
      </form>
      <form className="admin-form" method="post" action="/api/admin/action">
        <input type="hidden" name="action" value="create_copy" />
        <input type="hidden" name="topic_id" value={topicId} />
        <input type="hidden" name="return_to" value={`/admin/topics/${topicId}`} />
        <h3>手写一条</h3>
        <input name="style_label" placeholder="文案风格，如口播脚本" required />
        <textarea name="body" placeholder="文案正文" required />
        <textarea name="storyboard" placeholder={"分镜，可留空。一行一个镜头：\n镜头1 0-3秒 | 拍什么 | 说什么"} />
        <textarea name="why" placeholder={"为什么这样写，一行一节：\n钩子：...\n结构：..."} />
        <select name="status" defaultValue="published">
          <option value="published">发布</option>
          <option value="draft">草稿</option>
        </select>
        <button className="btn btn-primary" type="submit">保存文案</button>
      </form>
      {copies.map((copy) => (
        <form key={copy.id} className="admin-form" method="post" action="/api/admin/action">
          <input type="hidden" name="action" value="update_copy" />
          <input type="hidden" name="id" value={copy.id} />
          <input type="hidden" name="return_to" value={`/admin/topics/${topicId}`} />
          <input name="style_label" defaultValue={copy.styleLabel} required />
          <textarea name="body" defaultValue={copy.body} required />
          <textarea name="storyboard" defaultValue={copy.storyboard} placeholder="分镜" />
          <textarea name="why" defaultValue={formatWhy(copy.breakdown)} />
          <div className="grid-2">
            <input name="sort_order" type="number" defaultValue={copy.sortOrder} />
            <select name="status" defaultValue={copy.status}>
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">更新</button>
        </form>
      ))}
    </section>
  );
}
