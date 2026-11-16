"use client";

import { useState, type FormEvent } from "react";
import { splitByHits, type ForbiddenHit } from "@/lib/forbidden";

export function ForbiddenChecker({ remainingLabel }: { remainingLabel: string }) {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<ForbiddenHit[]>([]);
  const [note, setNote] = useState(remainingLabel);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/tools/forbidden", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json()) as { error?: string; hits?: ForbiddenHit[]; remaining?: string };
    if (!response.ok) {
      setError(data.error || "检测失败");
      return;
    }
    setHits(data.hits || []);
    if (data.remaining) setNote(data.remaining);
  }

  const pieces = splitByHits(text, hits);
  return (
    <form className="form" onSubmit={onSubmit}>
      <p className="fine">{note}</p>
      {error ? <p className="alert">{error}</p> : null}
      <label>
        <span>把要发的文案贴进来</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={2000} required />
      </label>
      <button className="btn btn-primary" type="submit">
        检测
      </button>
      {text && hits.length >= 0 && pieces.some((piece) => piece.hit) ? (
        <div className="copy-card">
          <p className="marked-text">
            {pieces.map((piece, index) =>
              piece.hit ? (
                <mark key={index} className="bad-word">
                  {piece.text}
                </mark>
              ) : (
                <span key={index}>{piece.text}</span>
              ),
            )}
          </p>
          <ul>
            {hits.map((hit) => (
              <li key={`${hit.index}-${hit.phrase}`}>
                {hit.phrase}
                {hit.replacement ? ` 可改成 ${hit.replacement}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {text && hits.length === 0 && note.includes("未发现") ? <p>这段里没有词库里的说法。</p> : null}
    </form>
  );
}
