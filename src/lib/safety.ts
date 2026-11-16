const PHRASES = [
  "最佳",
  "最好",
  "最高级",
  "最低价",
  "全网第一",
  "行业第一",
  "全国第一",
  "第一名",
  "国家级",
  "世界级",
  "绝对有效",
  "永久有效",
  "根治",
  "特效",
  "万能",
  "包治",
  "无副作用",
  "100%有效",
  "百分百有效",
  "史上最",
];

export function findSensitive(text: string): string | null {
  const source = text.replace(/\s+/g, "");
  for (const phrase of PHRASES) {
    if (source.includes(phrase.replace(/\s+/g, ""))) return phrase;
  }
  return null;
}

export const SAFE_REPLY = "这条内容里有不适合发布的说法，已拦住。换个具体、不夸张的问法再试。";
