"use client";

import { useRef, useState } from "react";
import { uploadFileSource, addLinkSource } from "@/lib/api";

type Tab = "pdf" | "text" | "vtt" | "website" | "youtube";

const TABS: { key: Tab; label: string; accept?: string }[] = [
  { key: "pdf", label: "PDF", accept: ".pdf" },
  { key: "text", label: "Text", accept: ".txt" },
  { key: "vtt", label: "VTT / Transcript", accept: ".vtt,.srt" },
  { key: "website", label: "Web Link" },
  { key: "youtube", label: "YouTube" },
];

export default function SourceUploadModal({
  notebookId,
  onClose,
  onAdded,
}: {
  notebookId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [tab, setTab] = useState<Tab>("pdf");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await uploadFileSource(notebookId, file);
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkSubmit() {
    if (!url.trim()) {
      setError("Enter a URL first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addLinkSource(notebookId, tab as "website" | "youtube", url.trim());
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isLinkTab = tab === "website" || tab === "youtube";

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@700&display=swap");
        .font-hand {
          font-family: "Kalam", cursive;
        }
      `}</style>

      <div
        className="bg-[#FAF6EF] rounded-xl w-full max-w-lg p-6 shadow-xl border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            Add a <span className="font-hand text-accent">source</span>
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-ink hover:bg-neutral-200/60 rounded-full w-7 h-7 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setError(null);
                setFileName(null);
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                tab === t.key
                  ? "bg-ink text-white border-ink"
                  : "border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-400 bg-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLinkTab ? (
          <div className="space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                tab === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://example.com/article"
              }
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            />

            {tab === "youtube" && (
              <p className="text-xs text-neutral-500 leading-relaxed bg-white border border-neutral-200 rounded-lg px-3 py-2">
                YouTube indexing needs the video&apos;s captions, and it can fail
                on the hosted version if YouTube blocks the server. If it does,{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("vtt");
                    setError(null);
                    setFileName(null);
                  }}
                  className="text-accent underline"
                >
                  upload the transcript as a file
                </button>{" "}
                instead.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleLinkSubmit}
              disabled={submitting}
              className="w-full bg-ink text-white rounded-lg py-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {submitting ? "Adding..." : "Add source"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="source-file-input"
              className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-neutral-300 rounded-lg py-8 px-4 bg-white cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors text-center"
            >
              <span className="text-2xl" aria-hidden>
                📎
              </span>
              <span className="text-sm font-medium text-ink">
                {fileName ?? "Click to choose a file"}
              </span>
              <span className="text-xs text-neutral-400">
                {TABS.find((t) => t.key === tab)?.accept?.replaceAll(",", " · ")}
              </span>
              <input
                id="source-file-input"
                ref={fileInputRef}
                type="file"
                accept={TABS.find((t) => t.key === tab)?.accept}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                className="hidden"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={handleFileSubmit}
              disabled={submitting}
              className="w-full bg-ink text-white rounded-lg py-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {submitting ? "Uploading..." : "Upload source"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}