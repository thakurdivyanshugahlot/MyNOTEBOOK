"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Notebook, Source, getNotebook, listSources, deleteSource, reindexSource } from "@/lib/api";
import SourceListItem from "@/components/SourceListItem";
import SourceUploadModal from "@/components/SourceUploadModal";
import ChatPanel from "@/components/ChatPanel";

export default function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = use(params);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nb, srcs] = await Promise.all([getNotebook(notebookId), listSources(notebookId)]);
      setNotebook(nb);
      setSources(srcs);
    } catch (err: any) {
      setError(err.message);
    }
  }, [notebookId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const hasPending = sources.some((s) => s.status === "uploading" || s.status === "indexing");
    if (!hasPending) return;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [sources, refresh]);

  async function handleDelete(id: string) {
    await deleteSource(id);
    await refresh();
  }

  async function handleReindex(id: string) {
    await reindexSource(id);
    await refresh();
  }

  const hasReadySources = sources.some((s) => s.status === "ready");

  if (error) {
    return (
      <div className="min-h-screen bg-[#1E2B24] flex items-center justify-center">
        <div className="max-w-2xl mx-auto py-16 text-center">
          <p className="text-[#E8748A] mb-4">{error}</p>
          <Link href="/notebook" className="text-[#E8B94D] underline">
            Back to notebooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1E2B24]">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=IBM+Plex+Mono:wght@500&display=swap");
        .font-hand {
          font-family: "Kalam", cursive;
        }
        .font-data {
          font-family: "IBM Plex Mono", monospace;
        }
      `}</style>

      <header className="border-b border-[#F3EFE4]/10 px-6 py-3 flex items-center justify-between bg-[#1E2B24]">
        <div className="flex items-center gap-3">
          <Link href="/notebook" className="text-[#8A8479] hover:text-[#F3EFE4] text-sm transition-colors">
            ← Back
          </Link>
          <h1 className="font-hand text-lg text-[#F3EFE4]">{notebook?.name || "Loading..."}</h1>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-[#F3EFE4]/10 bg-[#182119] flex flex-col overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-[#8A8479] uppercase tracking-wide">Sources</span>
            <button
              onClick={() => setShowUpload(true)}
              className="text-sm bg-[#E8B94D] text-[#1E2B24] font-semibold rounded-lg px-3 py-1.5 hover:bg-[#F3EFE4] transition-colors"
            >
              + Add Source
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {sources.length === 0 && (
              <li className="text-sm text-[#6E786F] border border-dashed border-[#F3EFE4]/15 rounded-lg p-4 text-center">
                No sources yet.
              </li>
            )}
            {sources.map((s) => (
              <SourceListItem key={s.id} source={s} onDelete={handleDelete} onReindex={handleReindex} />
            ))}
          </ul>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#1E2B24]">
          <ChatPanel notebookId={notebookId} hasReadySources={hasReadySources} />
        </main>
      </div>

      {showUpload && (
        <SourceUploadModal notebookId={notebookId} onClose={() => setShowUpload(false)} onAdded={refresh} />
      )}
    </div>
  ); 
}