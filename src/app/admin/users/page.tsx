import { listUsers } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { resolvedQuotas } from "@/lib/membership";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const db = getDb();
  const users = listUsers(db);
  const free = resolvedQuotas(db, "free");
  const vip = resolvedQuotas(db, "vip");
  const shop = resolvedQuotas(db, "shop");
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <p className="fine">档位是免费、VIP、门店版，由管理员开通并填写到期日。留空则从今天起一年。AI 内测勾上后，这个账号才能用改写；开通 VIP 或门店版会自动勾上。收费开关仍单独控制旧的年度订单。</p>
      <form method="post" action="/api/admin/action" className="admin-form">
        <input type="hidden" name="action" value="update_quotas" />
        <input type="hidden" name="return_to" value="/admin/users" />
        <h2>各档额度</h2>
        <div className="grid-2">
          <label><span className="field-label">免费每天改写</span><input name="free_ai" type="number" defaultValue={free.aiDaily} /></label>
          <label><span className="field-label">免费可看条数</span><input name="free_copies" type="number" defaultValue={free.copyUnlock} /></label>
          <label><span className="field-label">免费违禁词次数</span><input name="free_forbidden" type="number" defaultValue={free.forbiddenDaily} /></label>
          <label><span className="field-label">VIP 每天改写</span><input name="vip_ai" type="number" defaultValue={vip.aiDaily} /></label>
          <label><span className="field-label">门店版每天改写</span><input name="shop_ai" type="number" defaultValue={shop.aiDaily} /></label>
        </div>
        <button type="submit">保存额度</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色 / 会员</th>
              <th>次数</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.username}</strong>
                  <div className="fine">{user.email}</div>
                  <div className="fine">{user.createdAt.slice(0, 10)}</div>
                </td>
                <td>
                  <form method="post" action="/api/admin/action">
                    <input type="hidden" name="action" value="update_user" />
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="return_to" value="/admin/users" />
                    <select name="role" defaultValue={user.role}>
                      <option value="user">用户</option>
                      <option value="admin">管理员</option>
                    </select>
                    <select name="tier" defaultValue={user.tier}>
                      <option value="free">免费档（收费开关用）</option>
                      <option value="annual">年度（从今天起一年）</option>
                    </select>
                    <select name="plan" defaultValue={user.planSlug}>
                      <option value="free">免费</option>
                      <option value="vip">VIP</option>
                      <option value="shop">门店版</option>
                    </select>
                    <input name="plan_expires" type="date" defaultValue={user.planExpiresAt ? user.planExpiresAt.slice(0, 10) : ""} />
                    <label className="checkline">
                      <input type="checkbox" name="ai_beta" value="yes" defaultChecked={user.aiBeta || user.planSlug !== "free"} /> AI 内测
                    </label>
                    <input name="credit_delta" type="number" placeholder="增减次数，可为负" />
                    <button type="submit">保存</button>
                  </form>
                </td>
                <td>{user.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
