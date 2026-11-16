export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function aiSettings(env: NodeJS.ProcessEnv = process.env): AiSettings {
  return {
    apiKey: (env.AI_API_KEY || "").trim(),
    baseUrl: (env.AI_BASE_URL || "").trim().replace(/\/$/, ""),
    model: (env.AI_MODEL || "").trim(),
  };
}

export function aiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return aiSettings(env).apiKey.length > 0;
}

export function completionsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("即将上线");
  }
}

export class AiRequestError extends Error {}

type FetchLike = typeof fetch;

/**
 * OpenAI-compatible chat. The key stays on the server.
 * DeepSeek base is https://api.deepseek.com (no /v1).
 * DashScope, Moonshot and Zhipu include /v1 or /v4 in AI_BASE_URL.
 */
export async function completeChat(input: {
  messages: ChatMessage[];
  settings?: AiSettings;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<string> {
  const settings = input.settings ?? aiSettings();
  if (!settings.apiKey || !settings.baseUrl || !settings.model) throw new AiNotConfiguredError();
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(completionsUrl(settings.baseUrl), {
    method: "POST",
    signal: AbortSignal.timeout(input.timeoutMs ?? 20000),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.7,
      stream: false,
      messages: input.messages,
    }),
  });
  if (!response.ok) throw new AiRequestError(`模型接口返回 ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function streamChat(input: {
  messages: ChatMessage[];
  settings?: AiSettings;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  onDelta: (text: string) => void;
}): Promise<string> {
  const settings = input.settings ?? aiSettings();
  if (!settings.apiKey || !settings.baseUrl || !settings.model) throw new AiNotConfiguredError();
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(completionsUrl(settings.baseUrl), {
    method: "POST",
    signal: AbortSignal.timeout(input.timeoutMs ?? 40000),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.7,
      stream: true,
      messages: input.messages,
    }),
  });
  if (!response.ok || !response.body) throw new AiRequestError(`模型接口返回 ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (full.length < 8000) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = json.choices?.[0]?.delta?.content || "";
        if (!delta) continue;
        full += delta;
        input.onDelta(delta);
      } catch {
        /* ignore a partial SSE frame */
      }
    }
  }
  return full.trim();
}

export const COPYWRITER_RULES = `你是「今天拍啥」的文案助手，帮餐饮、美业、本地生活老板写能拍的口播、小红书笔记和标题。
遵守抖音和小红书的规则：不用极限词（最、第一、国家级、绝对、永久、根治），不承诺疗效、播放量或收入，不编造评价和优惠。
语气像店里的人在说话，句子短，细节具体。`;
