import { listDailyStats } from "@/lib/analytics";
import { isBillingEnabled } from "@/lib/config";
import { stats } from "@/lib/content";
import { getDb } from "@/lib/db";
import { formatShortDate } from "@/lib/dates";
import type { DayStat } from "@/lib/analytics";

export default function AdminHome() {
  const db = getDb();
  const data = stats(db);
  const series = listDailyStats(db, 30);
  const today = series[series.length - 1];
  const cards = [
    ["用户", data.users],
    ["今日新注册", today?.newRegistrations ?? data.usersToday],
    ["今日浏览", today?.pageViews ?? 0],
    ["今日独立访客", today?.uniqueVisitors ?? 0],
    ["今日登录活跃", today?.activeUsers ?? 0],
    ["今日回访", today?.returningUsers ?? 0],
    ["已发布选题", data.topics],
    ["今日选题", data.topicsToday],
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
      <p className="fine">收费开关当前为 {isBillingEnabled() ? "开启" : "关闭"}。访问统计存在本机数据库，不保存原始 IP。</p>
      <section className="chart-card">
        <h2>近 30 天</h2>
        <p className="legend">
          <span><i style={{ background: "#d6420c" }} />浏览量</span>
          <span><i style={{ background: "#12a37a" }} />独立访客</span>
        </p>
        <TrendChart rows={series} />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>浏览量</th>
                <th>独立访客</th>
                <th>新注册</th>
                <th>登录活跃</th>
                <th>回访</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((row) => (
                <tr key={row.day}>
                  <td>{formatShortDate(row.day)}</td>
                  <td>{row.pageViews}</td>
                  <td>{row.uniqueVisitors}</td>
                  <td>{row.newRegistrations}</td>
                  <td>{row.activeUsers}</td>
                  <td>{row.returningUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">独立访客是当天不同的 IP+浏览器哈希。回访是这些哈希里，更早日期已经出现过的人数。哈希保留 90 天。</p>
      </section>
    </>
  );
}

function TrendChart({ rows }: { rows: DayStat[] }) {
  const width = 720;
  const height = 160;
  const max = Math.max(1, ...rows.map((row) => Math.max(row.pageViews, row.uniqueVisitors)));
  const slot = width / rows.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近30天浏览量和独立访客">
      {rows.map((row, index) => {
        const viewsHeight = (row.pageViews / max) * (height - 8);
        const uniqueHeight = (row.uniqueVisitors / max) * (height - 8);
        const x = index * slot;
        return (
          <g key={row.day}>
            <rect x={x + 1} y={height - viewsHeight} width={Math.max(slot - 3, 1)} height={viewsHeight} fill="#d6420c" rx="1" />
            <rect x={x + slot * 0.35} y={height - uniqueHeight} width={Math.max(slot * 0.4, 1)} height={uniqueHeight} fill="#12a37a" rx="1" />
          </g>
        );
      })}
    </svg>
  );
}
