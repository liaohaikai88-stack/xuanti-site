"use client";

import { useState, type FormEvent } from "react";
import { CopyButton } from "./copy-button";

type Industry = { slug: string; name: string };
type Result = {
  source: "llm" | "template";
  notice: string | null;
  titles: string[];
  outline: Array<{ heading: string; text: string }>;
};

export function CopyStudio({
  industries,
  loggedIn,
  showCredits,
  credits,
}: {
  industries: Industry[];
  loggedIn: boolean;
  showCredits: boolean;
  credits: number;
}) {
  const [product, setProduct] = useState("");
  const [industry, setIndustry] = useState(industries[0]?.name ?? "");
  const [platform, setPlatform] = useState("抖音");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!loggedIn) {
      window.location.href = "/login?next=/tools/copy";
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/tools/copy", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ product, industry, platform, note }),
    });
    setPending(false);
    const data = (await response.json()) as Result & { error?: string };
    if (!response.ok) {
      setResult(null);
      setError(data.error || "生成失败");
      return;
    }
    setResult(data);
  }

  return (
    <div className="tool-card">
      {showCredits ? <p className="fine">剩余可用次数：{credits}</p> : null}
      <form className="form" onSubmit={onSubmit}>
        <label>
          <span>产品或招牌</span>
          <input value={product} onChange={(event) => setProduct(event.target.value)} placeholder="例如：红烧牛肉面、头皮护理" maxLength={40} required />
        </label>
        <div className="grid-2">
          <label>
            <span>行业</span>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
              {industries.map((item) => (
                <option key={item.slug}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>平台</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              <option>抖音</option>
              <option>小红书</option>
              <option>视频号</option>
              <option>抖音/小红书</option>
            </select>
          </label>
        </div>
        <label>
          <span>补充，可选</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="客单价、主打卖点、不想出现的说法" maxLength={200} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "正在整理…" : loggedIn ? "生成标题和提纲" : "登录后生成"}
        </button>
      </form>
      {error ? <p className="alert">{error}</p> : null}
      {result ? (
        <div>
          {result.notice ? <p className="alert">{result.notice}</p> : null}
          <h2>标题</h2>
          {result.titles.map((title) => (
            <div className="result-title" key={title}>
              <strong>{title}</strong>
              <CopyButton text={title} label="复制" />
            </div>
          ))}
          <h2>提纲</h2>
          {result.outline.map((section) => (
            <div key={section.heading} className="direction">
              <b>{section.heading}</b>
              {section.text}
            </div>
          ))}
        </div>
      ) : (
        <p className="fine">填一个正在卖的东西，得到 3 个标题和一段能直接开拍的提纲。</p>
      )}
    </div>
  );
}
