import type { Metadata } from "next";
import { isBillingEnabled } from "@/lib/config";
import { listIndustries } from "@/lib/content";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { CopyStudio } from "@/components/copy-studio";

export const metadata: Metadata = {
  title: "文案工具",
  description: "输入产品，生成可拍摄的标题和提纲。",
};

export default async function CopyToolPage() {
  const user = await getCurrentUser();
  const industries = listIndustries(getDb());
  const billing = isBillingEnabled();
  return (
    <>
      <div className="section-head">
        <div>
          <h1>文案工具</h1>
          <p>填一个产品或招牌菜，得到标题和拍摄提纲。生成结果只供参考，不保证播放量。</p>
        </div>
      </div>
      <CopyStudio industries={industries} loggedIn={Boolean(user)} showCredits={billing && Boolean(user)} credits={user?.credits ?? 0} />
    </>
  );
}
