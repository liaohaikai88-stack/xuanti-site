export type CopyInput = {
  product: string;
  industry?: string;
  platform?: string;
  note?: string;
};

export type CopyOutlineSection = { heading: string; text: string };

export type CopyResult = {
  source: "llm" | "template";
  notice: string | null;
  titles: string[];
  outline: CopyOutlineSection[];
};

export function templateCopy(input: CopyInput): CopyResult {
  const name = input.product.trim();
  const industry = input.industry?.trim() || "门店";
  const platform = input.platform?.trim() || "抖音";
  const extra = input.note?.trim();
  const extraLine = extra ? `补充要求：${extra}。` : "";
  return {
    source: "template",
    notice: "当前没有配置大模型，这是根据产品名整理的本地提纲。配置 LLM_API_KEY 后会改为智能生成。",
    titles: [
      `来${name}别再点错了，本地人都这么选`,
      `${name}到底值不值？我把真实过程拍给你`,
      `第一次来${name}，照着这条拍就够了`,
    ],
    outline: [
      {
        heading: "开头钩子",
        text: `第一句就说结果或反差，例如「${name}我踩过坑，今天只留真正值得拍的」。用${platform}前 3 秒把人留住，不要先自我介绍。${extraLine}`,
      },
      {
        heading: "中段",
        text: `按「看得到的过程」拍 3 个点：顾客进店会碰到什么、${industry}里最容易被忽略的细节、${name}和普通做法差在哪。每一点配一个特写，口播不超过两句。`,
      },
      {
        heading: "结尾",
        text: `收在一个可执行动作上：评论区留「想看哪一道 / 哪一步」，或者告诉同城的人到店报这句口令。不要承诺播放量和涨粉。`,
      },
    ],
  };
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function extractJson(text: string): CopyResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      titles?: unknown;
      outline?: unknown;
    };
    if (!Array.isArray(parsed.titles) || parsed.titles.length < 3) return null;
    if (!Array.isArray(parsed.outline) || parsed.outline.length < 1) return null;
    const titles = parsed.titles.slice(0, 3).map((item) => String(item).trim()).filter(Boolean);
    const outline = parsed.outline
      .map((item) => {
        const section = item as { heading?: unknown; text?: unknown };
        return { heading: String(section.heading ?? "").trim(), text: String(section.text ?? "").trim() };
      })
      .filter((section) => section.heading && section.text);
    if (titles.length < 3 || outline.length < 1) return null;
    return { source: "llm", notice: null, titles, outline };
  } catch {
    return null;
  }
}

export async function generateCopy(input: CopyInput): Promise<CopyResult> {
  const apiKey = (process.env.LLM_API_KEY || "").trim();
  if (!apiKey) return templateCopy(input);

  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "你是短视频选题编导，服务餐饮、美业和本地生活门店。根据产品写 3 个可直接拍摄的标题，以及口播提纲。只返回 JSON：{\"titles\":[\"\",\"\",\"\"],\"outline\":[{\"heading\":\"开头钩子\",\"text\":\"\"},{\"heading\":\"中段\",\"text\":\"\"},{\"heading\":\"结尾\",\"text\":\"\"}]}。不要承诺播放量，不要输出 Markdown。",
          },
          {
            role: "user",
            content: JSON.stringify({
              产品: input.product,
              行业: input.industry || "",
              平台: input.platform || "",
              补充: input.note || "",
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      const fallback = templateCopy(input);
      fallback.notice = "大模型暂时没有返回结果，已改用本地提纲。";
      return fallback;
    }
    const data = (await response.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(content);
    if (!parsed) {
      const fallback = templateCopy(input);
      fallback.notice = "大模型返回的内容无法解析，已改用本地提纲。";
      return fallback;
    }
    return parsed;
  } catch {
    const fallback = templateCopy(input);
    fallback.notice = "大模型连接失败，已改用本地提纲。";
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
