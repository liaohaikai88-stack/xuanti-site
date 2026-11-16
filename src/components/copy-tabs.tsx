"use client";

import { useState } from "react";

export function CopyTabs({
  body,
  storyboard,
  breakdown,
}: {
  body: string;
  storyboard: string;
  breakdown: Array<{ heading: string; text: string }>;
}) {
  const tabs = [
    { id: "copy", label: "文案" },
    ...(storyboard.trim() ? [{ id: "board", label: "分镜" }] : []),
    { id: "why", label: "为什么这样写" },
  ];
  const [tab, setTab] = useState(tabs[0]?.id || "copy");
  const active = tabs.some((item) => item.id === tab) ? tab : "copy";
  return (
    <div className="copy-tabs">
      <div className="chips" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={active === item.id ? "chip on" : "chip"} onClick={() => setTab(item.id)} role="tab" aria-selected={active === item.id}>
            {item.label}
          </button>
        ))}
      </div>
      {active === "copy" ? <p className="copy-body">{body}</p> : null}
      {active === "board" ? <Storyboard text={storyboard} /> : null}
      {active === "why" ? (
        <div className="breakdown">
          {breakdown.length === 0 ? <p className="fine">还没有拆解。</p> : null}
          {breakdown.map((section) => (
            <div key={section.heading}>
              <b>{section.heading}</b>
              <span>{section.text}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Storyboard({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="storyboard">
      {lines.map((line) => {
        const cells = line.split("|").map((cell) => cell.trim());
        return cells.length > 1 ? (
          <div key={line} className="shot-line">
            {cells.map((cell) => (
              <span key={cell}>{cell}</span>
            ))}
          </div>
        ) : (
          <p key={line}>{line}</p>
        );
      })}
    </div>
  );
}
