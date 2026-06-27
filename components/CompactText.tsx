"use client";

import { useMemo, useState } from "react";

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function compactPreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return {
      normalized,
      preview: normalized,
      hidden: "",
    };
  }

  const sentenceEnd = normalized.slice(0, maxLength).search(/[.!?](?=\s|$)(?!.*[.!?](?=\s|$))/);
  if (sentenceEnd > 64) {
    const preview = normalized.slice(0, sentenceEnd + 1);
    return {
      normalized,
      preview,
      hidden: normalized.slice(preview.length).trim(),
    };
  }

  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const preview = clipped.slice(0, lastSpace > 64 ? lastSpace : maxLength).trim();
  return {
    normalized,
    preview: `${preview}...`,
    hidden: normalized.slice(preview.length).trim(),
  };
}

export function CompactText({
  text,
  maxLength = 140,
  minHiddenWords = 10,
  className,
}: {
  text: string;
  maxLength?: number;
  minHiddenWords?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { normalized, preview, hidden } = useMemo(() => compactPreview(text, maxLength), [maxLength, text]);
  const hiddenWordCount = countWords(hidden);
  const canExpand = hiddenWordCount > minHiddenWords || hidden.length > 110;

  return (
    <div className={className ? `compact-text ${className}` : "compact-text"}>
      <p>{expanded || !canExpand ? normalized : preview}</p>
      {canExpand ? (
        <button
          type="button"
          className="text-toggle"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
