"use client";

import { useState } from "react";

export function FavoriteButton({ topicId, initial = false }: { topicId: number; initial?: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className={on ? "fav on" : "fav"}
      disabled={pending}
      aria-pressed={on}
      onClick={async () => {
        setPending(true);
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ topicId }),
        });
        setPending(false);
        if (response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { favorited?: boolean };
        setOn(Boolean(data.favorited));
      }}
    >
      {on ? "已收藏" : "收藏"}
    </button>
  );
}
