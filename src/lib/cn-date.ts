import { isIsoDate } from "./dates";

export type ParsedCnDate = {
  startDate: string | null;
  endDate: string | null;
  month: number | null;
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDate(value) ? value : null;
}

function monthEnd(year: number, month: number): string | null {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return iso(year, month, last);
}

/** Parse labels such as 12月7日, 12月1日起, 12月24日-25日. */
export function parseCnDateLabel(label: string, year: number): ParsedCnDate {
  const text = label.trim().replace(/\s+/g, "");
  const range = text.match(/^(\d{1,2})月(\d{1,2})日(?:起)?(?:-|~|至|到)(?:(\d{1,2})月)?(\d{1,2})日(起)?$/);
  if (range) {
    const month1 = Number(range[1]);
    const day1 = Number(range[2]);
    const month2 = range[3] ? Number(range[3]) : month1;
    const day2 = Number(range[4]);
    const year2 = month2 < month1 ? year + 1 : year;
    const startDate = iso(year, month1, day1);
    let endDate = iso(year2, month2, day2);
    if (range[5] && endDate) endDate = monthEnd(year2, month2);
    return { startDate, endDate, month: month1 };
  }
  const single = text.match(/^(\d{1,2})月(\d{1,2})日(起)?$/);
  if (single) {
    const month = Number(single[1]);
    const day = Number(single[2]);
    const startDate = iso(year, month, day);
    const endDate = single[3] ? monthEnd(year, month) : startDate;
    return { startDate, endDate, month };
  }
  return { startDate: null, endDate: null, month: null };
}

export function assignCalendarYears(labels: string[], baseYear: number): ParsedCnDate[] {
  let year = baseYear;
  let lastMonth: number | null = null;
  return labels.map((label) => {
    const monthMatch = label.match(/(\d{1,2})月/);
    const month = monthMatch ? Number(monthMatch[1]) : null;
    if (month != null && lastMonth != null && month < lastMonth) year += 1;
    const parsed = parseCnDateLabel(label, year);
    if (parsed.month != null) lastMonth = parsed.month;
    return parsed;
  });
}

/** December sheet: in January the December just passed belongs to last year. */
export function inferCalendarYear(todayIso: string): number {
  const [year, month] = todayIso.split("-").map(Number);
  if (month === 1) return year - 1;
  return year;
}
