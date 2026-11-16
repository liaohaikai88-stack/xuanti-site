import { splitByHits, type ForbiddenHit } from "@/lib/forbidden";

export function MarkedText({ text, hits }: { text: string; hits: ForbiddenHit[] }) {
  const pieces = splitByHits(text, hits.filter((hit) => text.includes(hit.phrase)));
  return (
    <p className="marked-text">
      {pieces.map((piece, index) =>
        piece.hit ? (
          <mark key={`${piece.hit.index}-${index}`} className="bad-word" title={piece.hit.replacement ? `可改成：${piece.hit.replacement}` : undefined}>
            {piece.text}
          </mark>
        ) : (
          <span key={index}>{piece.text}</span>
        ),
      )}
    </p>
  );
}
