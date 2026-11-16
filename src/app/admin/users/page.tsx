import { listUsers } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const users = listUsers(getDb());
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <p className="fine">收费关闭时，所有登录用户都已经能看全部内容。这里的会员状态先留着，打开开关后才会影响权限。</p>
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
                      <option value="free">免费</option>
                      <option value="annual">年度（从今天起一年）</option>
                    </select>
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
