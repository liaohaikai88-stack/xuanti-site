import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { aiEnabled } from "@/lib/ai-client";
import { subChoices } from "@/lib/catalog";
import { messagesUsedToday, quotaFor } from "@/lib/ai-chat";
import { getTopic } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { canUseAi } from "@/lib/membership";
import { AI_LABEL, latestRewrite } from "@/lib/rewrite";
import { getShopProfile } from "@/lib/shop";
import { MarkedText } from "@/components/marked-text";
import { StoryboardView } from "@/components/storyboard-view";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export const metadata: Metadata = { title: "我的店铺", robots: { index: false, follow: false } };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/shop");
  const params = await searchParams;
  const db = getDb();
  const shop = getShopProfile(db, user.id);
  const topicId = Number(one(params.topic) || 0);
  const topic = topicId ? getTopic(db, topicId) : null;
  const choices = subChoices();
  const selected = shop ? `${shop.industryName}/${shop.subIndustryName}` : "";
  const allowed = canUseAi(user);
  const enabled = aiEnabled();
  const quota = quotaFor(db, user);
  const used = messagesUsedToday(db, user.id);
  const left = Math.max(0, quota - used);
  const result = latestRewrite(db, user.id);

  return (
    <>
      <div className="section-head">
        <div>
          <h1>
            我的店铺
            {shop?.sample ? <span className="sample-badge">示例</span> : null}
            {shop?.shopName ? <span className="fine"> {shop.shopName}</span> : null}
          </h1>
          <p>{allowed ? "填一次，之后每条选题都能按这家店改写。" : "记下店名、招牌和客人。"}</p>
        </div>
      </div>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      {allowed ? <p className="fine">今天还剩 {left} 次</p> : null}
      <form className="form" method="post" action="/api/shop/profile">
        <label>
          <span>店名 {shop?.sample ? <span className="sample-badge">示例</span> : null}</span>
          <input name="shop_name" defaultValue={shop?.shopName || ""} required maxLength={40} />
        </label>
        <label>
          <span>细分行业</span>
          <select name="sub_industry" defaultValue={selected} required>
            <option value="">请选择</option>
            {choices.map((item) => (
              <option key={item.slug} value={`${item.industry}/${item.name}`}>
                {item.industry} / {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid-2">
          <label>
            <span>城市</span>
            <input name="city" defaultValue={shop?.city || ""} />
          </label>
          <label>
            <span>商圈</span>
            <input name="district" defaultValue={shop?.district || ""} />
          </label>
        </div>
        <label>
          <span>人均</span>
          <input name="avg_spend" defaultValue={shop?.avgSpend || ""} placeholder="例如 80 元" />
        </label>
        <label>
          <span>招牌 1</span>
          <input name="product_1" defaultValue={shop?.products[0] || ""} />
        </label>
        <label>
          <span>招牌 2</span>
          <input name="product_2" defaultValue={shop?.products[1] || ""} />
        </label>
        <label>
          <span>招牌 3</span>
          <input name="product_3" defaultValue={shop?.products[2] || ""} />
        </label>
        <label>
          <span>卖点</span>
          <textarea name="selling_points" defaultValue={shop?.sellingPoints || ""} />
        </label>
        <label>
          <span>想吸引的客人</span>
          <input name="audience" defaultValue={shop?.audience || ""} />
        </label>
        <label>
          <span>语气</span>
          <select name="tone" defaultValue={shop?.tone || "亲切"}>
            <option value="亲切">亲切</option>
            <option value="专业">专业</option>
            <option value="轻松">轻松</option>
          </select>
        </label>
        <label>
          <span>老板出镜</span>
          <select name="owner_on_camera" defaultValue={shop?.ownerOnCamera ? "yes" : "no"}>
            <option value="yes">出镜</option>
            <option value="no">不出镜</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          保存档案
        </button>
      </form>

      {allowed ? (
      <section>
        <h2>按我的店改写</h2>
        {topic ? <p>当前选题：{topic.title}</p> : <p className="fine">从选题页点「按我的店改写」会带到这里。</p>}
        {!enabled ? <p className="alert">即将上线</p> : null}
        {enabled && topic ? (
          <form method="post" action="/api/shop/rewrite">
            <input type="hidden" name="topic_id" value={topic.id} />
            <button className="btn btn-primary" type="submit">
              生成口播和小红书笔记
            </button>
          </form>
        ) : null}
        {result ? (
          <article className="copy-card">
            {shop?.sample ? <p><span className="sample-badge">示例</span> {shop.shopName}</p> : null}
            <p className="fine">{AI_LABEL}</p>
            <h3>口播</h3>
            <MarkedText text={result.script} hits={result.hits} />
            <h3>分镜</h3>
            <StoryboardView text={result.storyboard} />
            <h3>小红书笔记</h3>
            <MarkedText text={result.xhsTitle} hits={result.hits} />
            <MarkedText text={result.xhsBody} hits={result.hits} />
            <p className="fine">{result.xhsTags}</p>
            {result.hits.length > 0 ? (
              <ul>
                {result.hits.map((hit) => (
                  <li key={`${hit.index}-${hit.phrase}`}>
                    <mark className="bad-word">{hit.phrase}</mark>
                    {hit.replacement ? ` 可改成 ${hit.replacement}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ) : null}
      </section>
      ) : null}
    </>
  );
}
