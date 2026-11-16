import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { usageCount } from "@/lib/forbidden";
import { visitorHash } from "@/lib/analytics";
import { headers } from "next/headers";
import { forbiddenQuotaFor, forbiddenUnlimited } from "@/lib/membership";
import { ForbiddenChecker } from "@/components/forbidden-checker";

export const metadata: Metadata = {
  title: "违禁词检测",
  description: "检查文案里的绝对化用语、功效承诺和导流词，并给出替换建议。",
};

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  const db = getDb();
  const quota = forbiddenQuotaFor(db, user);
  const headerList = await headers();
  const actor = user
    ? `user:${user.id}`
    : `anon:${visitorHash(headerList.get("x-forwarded-for") || "local", headerList.get("user-agent") || "")}`;
  const used = usageCount(db, actor, "forbidden");
  const label = forbiddenUnlimited(db, user) ? "会员不限次数" : `今天还剩 ${Math.max(0, quota - used)} 次`;
  return (
    <>
      <div className="section-head">
        <div>
          <h1>违禁词检测</h1>
          <p>对照一份用词清单，标出绝对化用语、功效承诺和导流词，并给出替换建议。这一页只检查，不帮你写新文案。</p>
        </div>
      </div>
      <ForbiddenChecker remainingLabel={label} />
    </>
  );
}
