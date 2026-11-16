import { inferCalendarYear } from "@/lib/cn-date";
import { getEvent, listEvents, listIndustries } from "@/lib/content";
import { getDb } from "@/lib/db";
import { todayShanghai } from "@/lib/dates";
import { Flash } from "@/components/flash";
import { one } from "@/lib/query";
import type { CalendarEvent, Industry } from "@/lib/types";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const db = getDb();
  const events = listEvents(db);
  const industries = listIndustries(db);
  const editing = one(params.id) ? getEvent(db, Number(one(params.id))) : null;
  const year = inferCalendarYear(todayShanghai());
  return (
    <>
      <Flash error={one(params.error)} ok={one(params.ok)} />
      <EventForm event={editing} industries={industries} />
      <form className="admin-form" method="post" action="/api/admin/action" encType="multipart/form-data">
        <input type="hidden" name="action" value="import_calendar" />
        <input type="hidden" name="return_to" value="/admin/calendar" />
        <h2>导入日历 CSV</h2>
        <p className="fine">
          表头：日期、节点、建议提前准备、餐饮选题方向、美业选题方向、本地生活选题方向、注意事项。日期可以写「12月1日起」「12月24日-25日」。
          <a href="/api/admin/template?kind=calendar"> 下载十二月模板</a>
        </p>
        <label>
          <span className="field-label">CSV 文件</span>
          <input name="file" type="file" accept=".csv,text/csv" required />
        </label>
        <label>
          <span className="field-label">十二月所在年份</span>
          <input name="base_year" type="number" defaultValue={year} required />
        </label>
        <label className="checkline">
          <input type="checkbox" name="is_sample" value="yes" /> 标记为示例
        </label>
        <button className="btn btn-primary" type="submit">
          导入日历
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>节点</th>
              <th>注意事项</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  {event.dateLabel}
                  <div className="fine">{event.startDate}</div>
                </td>
                <td>
                  <strong>{event.title}</strong>
                  <div className="fine">{event.directions.map((item) => `${item.industryName}：${item.direction}`).join(" / ")}</div>
                </td>
                <td>{event.caution || "—"}</td>
                <td>
                  <a href={`/admin/calendar?id=${event.id}`}>编辑</a>
                  <form method="post" action="/api/admin/action">
                    <input type="hidden" name="action" value="delete_event" />
                    <input type="hidden" name="id" value={event.id} />
                    <input type="hidden" name="return_to" value="/admin/calendar" />
                    <button type="submit">删除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EventForm({ event, industries }: { event: CalendarEvent | null; industries: Industry[] }) {
  return (
    <form className="admin-form" method="post" action="/api/admin/action">
      <input type="hidden" name="action" value={event ? "update_event" : "create_event"} />
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <input type="hidden" name="return_to" value={event ? `/admin/calendar?id=${event.id}` : "/admin/calendar"} />
      <h2>{event ? "编辑节点" : "新增节点"}</h2>
      <div className="grid-2">
        <label>
          <span className="field-label">日期原文</span>
          <input name="date_label" defaultValue={event?.dateLabel} placeholder="12月13日" required />
        </label>
        <label>
          <span className="field-label">节点</span>
          <input name="title" defaultValue={event?.title} required />
        </label>
      </div>
      <div className="grid-2">
        <label>
          <span className="field-label">开始日期</span>
          <input name="start_date" type="date" defaultValue={event?.startDate ?? ""} />
        </label>
        <label>
          <span className="field-label">结束日期</span>
          <input name="end_date" type="date" defaultValue={event?.endDate ?? ""} />
        </label>
      </div>
      <label>
        <span className="field-label">建议提前准备</span>
        <input name="prep_label" defaultValue={event?.prepLabel} placeholder="12月8日" />
      </label>
      {industries.map((industry) => (
        <label key={industry.id}>
          <span className="field-label">{industry.name}选题方向</span>
          <input
            name={`direction_${industry.id}`}
            defaultValue={event?.directions.find((item) => item.industryName === industry.name)?.direction ?? ""}
          />
        </label>
      ))}
      <label>
        <span className="field-label">注意事项</span>
        <textarea name="caution" defaultValue={event?.caution} placeholder="当天不做营销和娱乐内容" />
      </label>
      <label>
        <span className="field-label">补充说明</span>
        <textarea name="detail" defaultValue={event?.detail} />
      </label>
      <div className="grid-2">
        <label>
          <span className="field-label">类型</span>
          <select name="event_type" defaultValue={event?.eventType ?? "campaign"}>
            <option value="campaign">节点</option>
            <option value="holiday">节日</option>
            <option value="solar_term">节气</option>
            <option value="solemn">须留意</option>
          </select>
        </label>
        <label>
          <span className="field-label">排序</span>
          <input name="sort_order" type="number" defaultValue={event?.sortOrder ?? 0} />
        </label>
      </div>
      <label className="checkline">
        <input type="checkbox" name="is_sample" value="yes" defaultChecked={event?.isSample} /> 示例
      </label>
      <button className="btn btn-primary" type="submit">
        保存节点
      </button>
    </form>
  );
}
