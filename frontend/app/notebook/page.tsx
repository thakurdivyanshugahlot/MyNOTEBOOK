"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Notebook,
  listNotebooks,
  createNotebook,
  renameNotebook,
  deleteNotebook,
} from "@/lib/api";

const SPINE_COLORS = ["#E8B94D", "#E8748A", "#6FA8DC", "#8BAE8C"];
function spineColor(id: string) {
  const hash = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SPINE_COLORS[hash % SPINE_COLORS.length];
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function refresh() {
    try {
      setNotebooks(await listNotebooks());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createNotebook(newName.trim());
      setNewName("");
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Delete this notebook and all its sources? This can't be undone.",
      )
    )
      return;
    await deleteNotebook(id);
    await refresh();
  }

  async function handleRenameSubmit(id: string) {
    if (!renameValue.trim()) return;
    await renameNotebook(id, renameValue.trim());
    setRenamingId(null);
    await refresh();
  }

  return (
    <div className="min-h-screen bg-[#1E2B24] relative">
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@700&family=IBM+Plex+Mono:wght@500&display=swap");
        .font-hand {
          font-family: "Kalam", cursive;
        }
        .font-data {
          font-family: "IBM Plex Mono", monospace;
        }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #F3EFE4 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      <main className="relative max-w-3xl mx-auto px-6 md:px-16 py-14">
        <h1 className="text-3xl font-semibold mb-1 text-[#F3EFE4]">
          Your <span className="font-hand text-[#E8B94D]">notebooks</span>
        </h1>
        <p className="text-[#A9AF9F] mb-8">
          Each notebook keeps its own isolated set of sources and answers.
        </p>

        <div className="flex gap-2 mb-10 ">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New notebook name..."
            className="flex-1 border-2 border-dashed border-[#F3EFE4]/20 rounded-lg px-4 py-2.5 bg-[#f3f5f4] text-[#1f1f1f] placeholder:text-[#6E786F] focus:outline-none focus:ring-1 focus:ring-[#E8B94D] focus:border-[#E8B94D] transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="bg-[#E8B94D] text-[#1E2B24] font-semibold px-5 py-2.5 rounded-lg disabled:opacity-30 hover:bg-[#F3EFE4] transition-colors"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>

        {error && <p className="text-[#E8748A] mb-4">{error}</p>}

        {loading ? (
          <p className="text-[#6E786F] font-data text-sm">loading notebooks…</p>
        ) : notebooks.length === 0 ? (
          <div className="relative border-2 border-dashed border-[#F3EFE4]/15 rounded-xl p-12 text-center text-[#6E786F] bg-[#26362D]/40">
            <svg
              aria-hidden
              className="mx-auto mb-4 opacity-60"
              width="60"
              height="40"
              viewBox="0 0 60 40"
              fill="none"
            >
              <path
                d="M4 34 C 20 10, 30 30, 44 12"
                stroke="#E8B94D"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M44 12 L 38 14 M44 12 L 42 20"
                stroke="#E8B94D"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p className="mb-1 font-medium text-[#d1d4cd]">
              Your desk is empty.
            </p>
            <p className="text-md text-amber-50">
              Create a notebook above to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notebooks.map((nb) => (
              <li
                key={nb.id}
                className="group relative border border-[#F3EFE4]/10 rounded-xl pl-5 pr-4 py-4 flex items-center justify-between bg-[#26362D] hover:border-[#E8B94D]/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all overflow-hidden"
              >
                <span
                  aria-hidden
                  className="absolute -top-1.5 left-8 w-9 h-4 rotate-[-3deg] opacity-70"
                  style={{ backgroundColor: spineColor(nb.id) }}
                />
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: spineColor(nb.id) }}
                />

                {renamingId === nb.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleRenameSubmit(nb.id)
                    }
                    onBlur={() => handleRenameSubmit(nb.id)}
                    className="flex-1 border border-[#F3EFE4]/20 rounded px-2 py-1 mr-3 bg-[#1E2B24] text-[#F3EFE4]"
                  />
                ) : (
                  <Link href={`/notebook/${nb.id}`} className="flex-1 pt-1">
                    <div className="font-medium text-[#F3EFE4]">{nb.name}</div>
                    <div className="text-sm text-[#8B9189] font-data">
                      {nb._count?.sources ?? 0} source
                      {nb._count?.sources === 1 ? "" : "s"}
                    </div>
                  </Link>
                )}

                <div className="flex gap-2 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setRenamingId(nb.id);
                      setRenameValue(nb.name);
                    }}
                    className="text-sm text-[#8B9189] hover:text-[#F3EFE4] px-2 py-1"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(nb.id)}
                    className="text-sm text-[#E8748A] hover:text-[#f09aab] px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
