"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Bubble = { role: "user" | "assistant"; content: string };

export function AiChat({
  enabled,
  conversationId,
  initialMessages,
  topicId,
  quotaLabel,
}: {
  enabled: boolean;
  conversationId?: number;
  initialMessages: Bubble[];
  topicId?: number;
  quotaLabel: string;
}) {
  const [messages, setMessages] = useState<Bubble[]>(initialMessages);
  const [text, setText] = useState(topicId ? "用这个选题帮我写" : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState(conversationId);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [messages, pending]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = text.trim();
    if (!content || pending || !enabled) return;
    setText("");
    setError("");
    setPending(true);
    setMessages((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: currentId, topicId, content }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "发送失败");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = JSON.parse(line.slice(5)) as { delta?: string; replace?: string; error?: string; conversationId?: number };
          if (payload.conversationId) setCurrentId(payload.conversationId);
          if (payload.error) throw new Error(payload.error);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return next;
            if (payload.replace) last.content = payload.replace;
            else if (payload.delta) last.content += payload.delta;
            return next;
          });
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发送失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chat-shell">
      <p className="fine">{quotaLabel}</p>
      <div className="chat-log" ref={box}>
        {messages.length === 0 ? <p className="fine">说说你的店、招牌和想拍的平台。也可以从一条选题点「用这个选题帮我写」。</p> : null}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={message.role === "user" ? "bubble me" : "bubble ai"}>
            {message.content || (pending ? "正在写…" : "")}
          </div>
        ))}
      </div>
      {error ? <p className="alert">{error}</p> : null}
      <form className="chat-form" onSubmit={send}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={enabled ? "想让这条选题怎么改成你家的？" : "即将上线"} disabled={!enabled || pending} maxLength={2000} />
        <button className="btn btn-primary" type="submit" disabled={!enabled || pending}>
          {enabled ? "发送" : "即将上线"}
        </button>
      </form>
    </div>
  );
}
