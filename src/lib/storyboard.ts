export type ShotRow = {
  no: string;
  visual: string;
  speech: string;
  duration: string;
  method: string;
};

const TIME = /\d+\s*[-~到至]\s*\d+\s*秒|\d+\s*秒/;

/** Parse lines like `镜头1 0-3秒 | 拍什么 | 说什么 | 拍法`. Unparsed lines stay plain text. */
export function parseStoryboard(text: string): { rows: ShotRow[]; plain: string } {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ShotRow[] = [];
  const plain: string[] = [];
  for (const line of lines) {
    const parts = line.split(/\||｜/).map((part) => part.trim());
    const row = parts.length >= 2 ? toRow(parts) : null;
    if (row) rows.push(row);
    else plain.push(line);
  }
  return { rows, plain: plain.join("\n") };
}

function toRow(parts: string[]): ShotRow | null {
  const head = parts[0];
  const headed = head.match(/^(镜头\s*\d+|镜\s*\d+|\d+)\s*(.*)$/);
  if (headed && (headed[2] || parts.length >= 3)) {
    const duration = headed[2].trim();
    return {
      no: headed[1].replace(/\s+/g, ""),
      duration,
      visual: parts[1] || "",
      speech: parts[2] || "",
      method: parts[3] || "",
    };
  }
  if (parts.length >= 4 && TIME.test(parts[1])) {
    return { no: head, duration: parts[1], visual: parts[2] || "", speech: parts[3] || "", method: parts[4] || "" };
  }
  if (parts.length >= 5) {
    return { no: head, visual: parts[1] || "", speech: parts[2] || "", duration: parts[3] || "", method: parts[4] || "" };
  }
  return null;
}

export function shootMinutesFor(contentForm: string, stored: number | null): number {
  if (stored && stored > 0) return stored;
  if (contentForm.includes("图文")) return 20;
  if (contentForm.includes("口播")) return 15;
  if (contentForm.includes("探店")) return 40;
  return 25;
}
