"use client";

import { Citation } from "@/lib/api";

function buildOpenUrl(citation: Citation): string | null {
  if (citation.sourceType === "youtube" && citation.sourceUrl) {
    const seconds = citation.startTime ? Math.floor(citation.startTime) : 0;
    const separator = citation.sourceUrl.includes("?") ? "&" : "?";
    return `${citation.sourceUrl}${separator}t=${seconds}s`;
  }
  if (citation.sourceType === "website" && citation.sourceUrl) {
    return citation.sourceUrl;
  }
  return null;
}

const TYPE_LABEL: Record<string, string> = {
  pdf: "PDF",
  text: "Text file",
  vtt: "Subtitle file",
  website: "Website",
  youtube: "YouTube",
};

export default function SourceViewerModal({
  citation,
  onClose,
}: {
  citation: Citation;
  onClose: () => void;
}) {
  const openUrl = buildOpenUrl(citation);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-semibold">
                {citation.index}
              </span>
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                {TYPE_LABEL[citation.sourceType] ?? citation.sourceType}
              </span>
            </div>
            <h2 className="text-base font-semibold text-ink leading-snug">
              {citation.sourceName}
            </h2>

            {(citation.startPage != null || citation.startTimestamp) && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-2.5 py-1">
                {citation.startPage != null ? (
                  <span>
                    Page {citation.startPage}
                    {citation.endPage != null && citation.endPage !== citation.startPage
                      ? `–${citation.endPage}`
                      : ""}
                  </span>
                ) : (
                  <span>
                    {citation.startTimestamp} – {citation.endTimestamp}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-ink hover:bg-neutral-100 rounded-full w-8 h-8 flex items-center justify-center shrink-0 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div
            className="relative max-h-72 overflow-y-auto pr-2
                       [&::-webkit-scrollbar]:w-1.5
                       [&::-webkit-scrollbar-track]:bg-transparent
                       [&::-webkit-scrollbar-thumb]:bg-neutral-200
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300"
          >
            <blockquote
              className="border-l-2 border-accent/50 pl-4 text-[15px] leading-[1.75]
                         text-neutral-700 whitespace-pre-wrap font-serif"
            >
              {citation.snippet}
            </blockquote>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          {openUrl ? (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-ink text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {citation.sourceType === "youtube"
                ? `Open video at ${citation.startTimestamp}`
                : "Open original page"}
              <span aria-hidden>↗</span>
            </a>
          ) : (
            <p className="text-xs text-neutral-400 leading-relaxed">
              This is an uploaded file — the excerpt above is the cited section from{" "}
              <span className="font-medium text-neutral-500">{citation.sourceName}</span>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}