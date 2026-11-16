"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyButton } from "./copy-button";
import { StoryboardView } from "./storyboard-view";

type OpenCopy = { key: string; label: string; body: string };
type OpenBoard = { key: string; label: string; text: string };
type OpenWhy = { key: string; label: string; sections: Array<{ heading: string; text: string }> };
type OpenBench = { key: string; title: string; platform: string; likes: string; favorites: string; url: string; asOf: string };

export function TopicStudio({
  topicId,
  copyText,
  copies,
  boards,
  whys,
  benches,
  lockedCopies,
  lockedBoards,
  lockedWhys,
  lockedBenches,
  showRewrite,
  applyHref,
}: {
  topicId: number;
  copyText: string;
  copies: OpenCopy[];
  boards: OpenBoard[];
  whys: OpenWhy[];
  benches: OpenBench[];
  lockedCopies: number;
  lockedBoards: number;
  lockedWhys: number;
  lockedBenches: number;
  showRewrite: boolean;
  applyHref: string;
}) {
  const tabs = [
    { id: "copy", label: "文案" },
    { id: "board", label: "分镜" },
    { id: "why", label: "为什么这样写" },
    { id: "bench", label: "对标爆款" },
  ];
  const [tab, setTab] = useState("copy");
  const activeText =
    tab === "board"
      ? boards.map((item) => item.text).join("\n")
      : tab === "why"
        ? whys.map((item) => item.sections.map((section) => `${section.heading}：${section.text}`).join("\n")).join("\n\n")
        : tab === "bench"
          ? benches.map((item) => `${item.title} ${item.platform} 点赞 ${item.likes} 收藏 ${item.favorites}`).join("\n")
          : copies.map((item) => item.body).join("\n\n");
  return (
    <section className="studio">
      <div className="chips" role="tablist">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "chip on" : "chip"} onClick={() => setTab(item.id)} role="tab" aria-selected={tab === item.id}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "copy" ? (
        <div>
          {copies.map((item) => (
            <article key={item.key} className="copy-card">
              <div className="copy-style">{item.label}</div>
              <p className="copy-body">{item.body}</p>
            </article>
          ))}
          <Locked count={lockedCopies} label="条文案" applyHref={applyHref} />
        </div>
      ) : null}
      {tab === "board" ? (
        <div>
          {boards.length === 0 && lockedBoards === 0 ? <p className="fine">这条还没有分镜。</p> : null}
          {boards.map((item) => (
            <article key={item.key} className="copy-card">
              <div className="copy-style">{item.label}</div>
              <StoryboardView text={item.text} />
            </article>
          ))}
          <Locked count={lockedBoards} label="条分镜" applyHref={applyHref} />
        </div>
      ) : null}
      {tab === "why" ? (
        <div>
          {whys.map((item) => (
            <article key={item.key} className="copy-card">
              <div className="copy-style">{item.label}</div>
              <div className="breakdown">
                {item.sections.map((section) => (
                  <div key={section.heading}>
                    <b>{section.heading}</b>
                    <span>{section.text}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
          <Locked count={lockedWhys} label="条拆解" applyHref={applyHref} />
        </div>
      ) : null}
      {tab === "bench" ? (
        <div>
          {benches.length === 0 && lockedBenches === 0 ? <p className="fine">还没有对标。这里只放标题、数字和链接。</p> : null}
          {benches.map((item) => (
            <article key={item.key} className="copy-card">
              <div className="copy-style">{item.platform || "对标"}</div>
              <h3>{item.title}</h3>
              <p className="fine">点赞 {item.likes} · 收藏 {item.favorites}</p>
              {item.asOf ? <p className="fine">{item.asOf}</p> : null}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer">
                  查看原链接
                </a>
              ) : null}
            </article>
          ))}
          <Locked count={lockedBenches} label="个对标" applyHref={applyHref} />
        </div>
      ) : null}
      <div className="dock">
        {showRewrite ? (
          <Link className="btn btn-primary" href={`/shop?topic=${topicId}`}>
            按我的店改写
          </Link>
        ) : null}
        <CopyButton text={activeText || copyText} label="复制" className="btn btn-ghost" />
      </div>
    </section>
  );
}

function Locked({ count, label, applyHref }: { count: number; label: string; applyHref: string }) {
  if (count <= 0) return null;
  return (
    <article className="vip-lock">
      <div className="vip-blur" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <h3>还有 {count} {label}</h3>
      <p>看全部文案、分镜和拆解</p>
      <Link className="btn btn-primary" href={applyHref}>
        申请内测
      </Link>
    </article>
  );
}
