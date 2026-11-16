import { listOrders } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const orders = listOrders(getDb());
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <p className="fine">人工开通：确认收款后点「开通」，账号会成为年度会员。微信支付和支付宝还没接。</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单</th>
              <th>用户</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4}>还没有订单。</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    {order.orderNo}
                    <div className="fine">{(order.amountFen / 100).toFixed(0)} 元 · {order.provider}</div>
                  </td>
                  <td>
                    {order.username}
                    <div className="fine">{order.email}</div>
                  </td>
                  <td>{order.status}</td>
                  <td>
                    {order.status === "pending" ? (
                      <form method="post" action="/api/admin/action">
                        <input type="hidden" name="action" value="activate_order" />
                        <input type="hidden" name="order_no" value={order.orderNo} />
                        <input type="hidden" name="return_to" value="/admin/orders" />
                        <button type="submit">标记已支付并开通</button>
                      </form>
                    ) : (
                      order.paidAt?.slice(0, 10)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
