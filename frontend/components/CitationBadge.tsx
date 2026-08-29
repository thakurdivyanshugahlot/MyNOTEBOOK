"use client";

import { Citation } from "@/lib/api";

function citationLabel(citation: Citation): string {
  if (citation.startPage != null) {
    return citation.startPage === citation.endPage
      ? `p.${citation.startPage}`
      : `p.${citation.startPage}-${citation.endPage}`;
  }
  if (citation.startTimestamp != null) {
    return citation.startTimestamp;
  }
  return String(citation.index);
}

export default function CitationBadge({
  citation,
  onClick,
}: {
  citation: Citation;
  onClick: (c: Citation) => void;
}) {
  return (
    <button
  type="button"
  onClick={() => onClick(citation)}
  title={citation.sourceName}
  className="inline-flex items-center justify-center h-5 px-1.5 text-[11px] rounded-full bg-accent/15 text-accent hover:bg-accent hover:text-white transition-colors align-super ml-0.5"
>
  {citationLabel(citation)}
</button>
  );
}