import type { Metadata } from "next";
import Link from "next/link";
import { listEvents, listEventsForMonth, eventCoversDay, eventSpanDays } from "@/lib/content";
import { getDb } from "@/lib/db";
import { isMonthKey, monthGrid, shiftMonth, todayShanghai } from "@/lib/dates";
import { one } from "@/lib/query";
import type { CalendarEvent } from "@/lib/types";

export const metadata: Metadata = {
  title: "热点日历",
  description: "今天拍啥的节日、节气和平台节点，按餐饮、美业、本地生活给出选题方向。有内容红线会单独标出。",
};

const TYPE_LABEL = { holiday: "节日", solar_term: "节气", campaign: "节点", solemn: "须留意" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = todayShanghai();
  const requested = one(params.month);
  const month = isMonthKey(requested) ? requested : today.slice(0, 7);
  const db = getDb();
  const events = listEventsForMonth(db, month);
  const cautions = listEvents(db).filter((event) => event.caution.trim());
  const weeks = monthGrid(month);
  const longEvents = events.filter((event) => (eventSpanDays(event) ?? 1) > 5);

  return (
    <>
      <div className="section-head">
        <div>
          <h1>热点日历</h1>
          <p>节日、节气和平台节点。每条都写了提前准备，以及三个行业可以拍什么。</p>
        </div>
      </div>
      {cautions.length > 0 ? (
        <div className="caution-stack">
          {cautions.map((event) => (
            <article key={event.id} className="caution-banner">
              <span className="caution-kicker">注意事项</span>
              <strong>
                {event.dateLabel} {event.title}
              </strong>
              <p>{event.caution}</p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="calendar-toolbar">
        <Link className="btn btn-ghost btn-sm" href={`/calendar?month=${shiftMonth(month, -1)}`}>
          上个月
        </Link>
        <strong>
          {month.slice(0, 4)}年{Number(month.slice(5))}月
        </strong>
        <Link className="btn btn-ghost btn-sm" href={`/calendar?month=${shiftMonth(month, 1)}`}>
          下个月
        </Link>
      </div>
      {longEvents.length > 0 ? (
        <div className="chips" style={{ marginBottom: 10 }}>
          {longEvents.map((event) => (
            <span key={event.id} className="chip">
              {event.dateLabel} · {event.title}
            </span>
          ))}
        </div>
      ) : null}
      <div className="calendar-grid" aria-label="月历">
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
          <div key={label} className="dow">
            {label}
          </div>
        ))}
        {weeks.flat().map((day, index) => {
          if (!day) return <div key={`e-${index}`} className="day empty" />;
          const marks = events.filter((event) => eventCoversDay(event, day));
          const solemn = marks.some((event) => event.eventType === "solemn" || event.caution);
          return (
            <div key={day} className={`day${day === today ? " today" : ""}${marks.length ? " has" : ""}${solemn ? " solemn" : ""}`}>
              <div>{Number(day.slice(-2))}</div>
              {marks.map((event) => (
                <span key={event.id} className={`dot ${event.eventType}`} title={event.title} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="event-list" style={{ marginTop: 16 }}>
        {events.length === 0 ? (
          <div className="empty-state">
            <h3>这个月还没有节点</h3>
            <p>编辑会在后台继续补充。</p>
          </div>
        ) : (
          events.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>
    </>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const solemn = Boolean(event.caution);
  return (
    <article className={solemn ? "event-card solemn" : "event-card"}>
      <div className="event-type">
        {TYPE_LABEL[event.eventType]} · {event.dateLabel}
        {event.isSample ? " · 示例" : ""}
      </div>
      <h3>{event.title}</h3>
      {event.prepLabel ? <p className="prep">建议提前准备：{event.prepLabel}</p> : null}
      {event.caution ? (
        <div className="caution-banner" style={{ marginTop: 8 }}>
          <span className="caution-kicker">注意事项</span>
          <p>{event.caution}</p>
        </div>
      ) : null}
      {event.directions.length > 0 ? (
        <div className="directions">
          {event.directions.map((item) => (
            <div key={item.industryName} className="direction">
              <b>{item.industryName}选题方向</b>
              {item.direction}
            </div>
          ))}
        </div>
      ) : solemn ? (
        <p>当天不安排营销选题。</p>
      ) : null}
      {event.detail ? <p>{event.detail}</p> : null}
    </article>
  );
}
