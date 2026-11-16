export function splitPlatforms(raw: string): string[] {
  const parts = raw
    .split(/[/、，,|＋+]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [raw.trim()];
}

export function platformClass(name: string): string {
  if (name.includes("小红书")) return "xhs";
  if (name.includes("视频号")) return "wechat";
  if (name.includes("抖音")) return "douyin";
  return "other";
}
