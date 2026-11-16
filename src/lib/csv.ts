export type CsvTopicRow = {
  line: number;
  industry: string;
  title: string;
  hook: string;
  platform: string;
  contentForm: string;
  publishDate?: string;
  sortOrder?: number;
  subIndustry?: string;
  difficulty?: number;
  heatSource?: "节日" | "热点" | "常青";
};

export type CsvParseResult = {
  rows: CsvTopicRow[];
  errors: string[];
};

const HEADER_MAP: Record<string, keyof Omit<CsvTopicRow, "line">> = {
  行业: "industry",
  选题标题: "title",
  开头钩子: "hook",
  适合平台: "platform",
  内容形式: "contentForm",
  发布日期: "publishDate",
  排序: "sortOrder",
};

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function parseTopicCsv(text: string): CsvParseResult {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], errors: ["CSV 是空的"] };
  const header = table[0].map((cell) => cell.trim());
  const missing = ["行业", "选题标题", "开头钩子", "适合平台", "内容形式"].filter(
    (name) => !header.includes(name),
  );
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [`无法识别表头，请使用 UTF-8，并包含列：行业、选题标题、开头钩子、适合平台、内容形式。缺少：${missing.join("、")}`],
    };
  }

  const rows: CsvTopicRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const record: Record<string, string> = {};
    header.forEach((name, cellIndex) => {
      record[name] = (cells[cellIndex] ?? "").trim();
    });
    const industry = record["行业"] ?? "";
    const title = record["选题标题"] ?? "";
    const hook = record["开头钩子"] ?? "";
    const platform = record["适合平台"] ?? "";
    const contentForm = record["内容形式"] ?? "";
    if (!industry || !title || !hook || !platform || !contentForm) {
      errors.push(`第 ${line} 行缺少必填内容`);
      return;
    }
    if (title.length > 80 || hook.length > 300 || platform.length > 40 || contentForm.length > 40) {
      errors.push(`第 ${line} 行内容过长`);
      return;
    }
    const subIndustry = (record["细分行业"] || "").slice(0, 20);
    let difficulty: number | undefined;
    if (record["难度"]) {
      const parsed = Number(record["难度"]);
      if (![1, 2, 3].includes(parsed)) {
        errors.push(`第 ${line} 行难度需要是 1、2 或 3`);
        return;
      }
      difficulty = parsed;
    }
    const heatRaw = record["热度来源"] || "";
    const heatSource = heatRaw === "节日" || heatRaw === "热点" || heatRaw === "常青" ? heatRaw : undefined;
    if (heatRaw && !heatSource) {
      errors.push(`第 ${line} 行热度来源需要是节日、热点或常青`);
      return;
    }
    const publishDate = record["发布日期"] || undefined;
    if (publishDate && !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      errors.push(`第 ${line} 行发布日期格式应为 YYYY-MM-DD`);
      return;
    }
    let sortOrder: number | undefined;
    if (record["排序"]) {
      const parsed = Number(record["排序"]);
      if (!Number.isInteger(parsed)) {
        errors.push(`第 ${line} 行排序必须是整数`);
        return;
      }
      sortOrder = parsed;
    }
    rows.push({ line, industry, title, hook, platform, contentForm, publishDate, sortOrder, subIndustry, difficulty, heatSource });
  });
  return { rows, errors };
}

export const TOPIC_CSV_HEADERS = Object.keys(HEADER_MAP);
