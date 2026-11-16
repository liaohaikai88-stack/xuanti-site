import { isBillingEnabled } from "@/lib/config";
import { stats } from "@/lib/content";
import { getDb } from "@/lib/db";

export default function AdminHome() {
  const data = stats(getDb());
  const cards = [
    ["用户", data.users],
    ["今日新注册", data.usersToday],
    ["已发布选题", data.topics],
    ["今日选题", data.topicsToday],
    ["日历节点", data.events],
    ["拆解", data.cases],
    ["收藏", data.favorites],
    ["待开通订单", data.pendingOrders],
  ];
  return (
    <>
      <div className="stats">
        {cards.map(([label, value]) => (
          <div className="stat" key={String(label)}>
            <b>{value}</b>
            {label}
          </div>
        ))}
      </div>
      <p className="fine">收费开关当前为 {isBillingEnabled() ? "开启" : "关闭"}。</p>
    </>
  );
}
