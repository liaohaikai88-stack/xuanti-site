import { parseCsv } from "./csv";
import type { EventType } from "./types";

export type CalendarCsvRow = {
  line: number;
  dateLabel: string;
  title: string;
  prepLabel: string;
  caution: string;
  directions: Array<{ industryName: string; direction: string }>;
};

const PLACEHOLDERS = new Set(["", "—", "–", "-", "－", "无", "暂无"]);

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDERS.has(value.trim());
}

export function inferEventType(title: string, caution: string): EventType {
  if (caution.includes("不做营销") || /公祭|哀悼|默哀/.test(title)) return "solemn";
  if (/节气|大雪|小雪|冬至|立冬|小寒|大寒|立春|雨水|惊蛰|春分|清明|谷雨|立夏|小满|芒种|夏至|小暑|大暑|立秋|处暑|白露|秋分|寒露|霜降/.test(title)) {
    return "solar_term";
  }
  if (/圣诞|元旦|跨年|春节|国庆|中秋|端午|元宵|除夕|平安夜/.test(title)) return "holiday";
  return "campaign";
}

export function parseCalendarCsv(text: string): { rows: CalendarCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["CSV 是空的"] };
  const header = table[0].map((cell) => cell.trim());
  for (const name of ["日期", "节点"]) {
    if (!header.includes(name)) {
      return { rows: [], errors: [`无法识别表头，请使用 UTF-8，并包含列：日期、节点。缺少：${name}`] };
    }
  }
  const directionColumns = header
    .map((name, index) => ({ name, index }))
    .filter((column) => column.name.endsWith("选题方向"))
    .map((column) => ({ index: column.index, industryName: column.name.replace(/选题方向$/, "") }));

  const rows: CalendarCsvRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const record = new Map<string, string>();
    header.forEach((name, cellIndex) => record.set(name, (cells[cellIndex] ?? "").trim()));
    const dateLabel = record.get("日期") ?? "";
    const title = record.get("节点") ?? "";
    if (!dateLabel || !title) {
      errors.push(`第 ${line} 行缺少日期或节点`);
      return;
    }
    const directions = directionColumns
      .map((column) => ({
        industryName: column.industryName,
        direction: (cells[column.index] ?? "").trim(),
      }))
      .filter((item) => item.industryName && !isPlaceholder(item.direction));
    const prepRaw = record.get("建议提前准备") ?? "";
    const cautionRaw = record.get("注意事项") ?? "";
    rows.push({
      line,
      dateLabel,
      title,
      prepLabel: isPlaceholder(prepRaw) ? "" : prepRaw,
      caution: isPlaceholder(cautionRaw) ? "" : cautionRaw,
      directions,
    });
  });
  return { rows, errors };
}
