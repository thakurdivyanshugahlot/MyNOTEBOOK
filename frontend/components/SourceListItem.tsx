"use client";

import { Source } from "@/lib/api";

const TYPE_LABEL: Record<Source["type"], string> = {
  pdf: "PDF",
  text: "Text",
  vtt: "Transcript",
  website: "Web Link",
  youtube: "YouTube",
};

const STATUS_COLOR: Record<Source["status"], string> = {
  uploading: "#6FA8DC",
  indexing: "#E8B94D",
  ready: "#8BAE8C",
  failed: "#E8748A",
};

export default function SourceListItem({
  source,
  onDelete,
  onReindex,
}: {
  source: Source;
  onDelete: (id: string) => void;
  onReindex: (id: string) => void;
}) {
  const isBusy = source.status === "uploading" || source.status === "indexing";

  // Missing/blocked YouTube captions won't fix themselves on retry.
  const isCaptionFailure =
    source.status === "failed" &&
    source.type === "youtube" &&
    /captions/i.test(source.errorMessage ?? "");

  return (
    <li className="relative border border-neutral-200 rounded-lg pl-4 pr-3 py-3 bg-white hover:shadow-sm hover:-translate-y-0.5 transition-all overflow-hidden">
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-1 ${isBusy ? "animate-pulse" : ""}`}
        style={{ backgroundColor: STATUS_COLOR[source.status] }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs uppercase tracking-wide text-neutral-400 font-mono">
            {TYPE_LABEL[source.type]}
          </span>

          <div className="text-sm font-medium truncate mt-0.5" title={source.originalName}>
            {source.originalName}
          </div>

          {source.status === "failed" ? (
            <p
              className="text-xs mt-1 leading-relaxed break-words"
              style={{ color: STATUS_COLOR.failed }}
            >
              {source.errorMessage || "Indexing failed"}
            </p>
          ) : (
            <div className="text-xs text-neutral-400 mt-0.5 font-mono">
              {source.status === "uploading" && "uploading…"}
              {source.status === "indexing" && "indexing…"}
              {source.status === "ready" && `ready · ${source.chunkCount} chunks`}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0 items-end">
          {source.status === "failed" && !isCaptionFailure && (
            <button
              onClick={() => onReindex(source.id)}
              className="text-xs text-accent hover:underline"
            >
              Retry
            </button>
          )}
          <button
            onClick={() => onDelete(source.id)}
            className="text-xs text-neutral-400 hover:text-red-500"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}