"use client";

import { useEffect, useRef, useState } from "react";
import { queryChannel } from "@/lib/inngest-channels";

import { useRealtime } from "inngest/react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Citation,
  QuerySession,
  startQuery,
} from "@/lib/api";

import CitationBadge from "./CitationBadge";
import SourceViewerModal from "./SourceViewerModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  streaming?: boolean;
}

// Turns bare "[1]" citation markers into markdown link syntax so the
// markdown parser hands us an <a href="citation:1"> node we can intercept
// and render as a CitationBadge instead of a real link.
//
// NOTE: this only catches markers that are NOT already a markdown link
// (i.e. not already followed by "(...)"). If the model itself ever emits
// "[6](https://...)" or "[6](#)" directly, this regex intentionally leaves
// it alone to avoid double-wrapping — which is why the `a` renderer below
// does its own text-based check as a second line of defense.
function prepareCitationLinks(text: string): string {
  return text.replace(
    /\[(\d+)\](?!\()/g,
    "[$1](citation:$1)",
  );
}

function AssistantMarkdown({
  content,
  citations,
  onCitationClick,
}: {
  content: string;
  citations: Citation[] | undefined;
  onCitationClick: (c: Citation) => void;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">
            {children}
          </p>
        ),

        h1: ({ children }) => (
          <h3 className="text-base font-semibold text-[#E8B94D] mt-3 mb-1.5">
            {children}
          </h3>
        ),

        h2: ({ children }) => (
          <h3 className="text-base font-semibold text-[#E8B94D] mt-3 mb-1.5">
            {children}
          </h3>
        ),

        h3: ({ children }) => (
          <h4 className="text-sm font-semibold text-[#E8B94D] mt-3 mb-1">
            {children}
          </h4>
        ),

        strong: ({ children }) => (
          <strong className="font-semibold text-[#F3EFE4]">
            {children}
          </strong>
        ),

        ul: ({ children }) => (
          <ul className="list-disc pl-5 space-y-1 mb-2">
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="list-decimal pl-5 space-y-1 mb-2">
            {children}
          </ol>
        ),

        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),

        hr: () => (
          <hr className="border-[#F3EFE4]/10 my-3" />
        ),

        code: ({
          className,
          children,
          ...props
        }: any) => {
          const isBlock = /language-/.test(className || "");

          if (!isBlock) {
            return (
              <code className="bg-[#1E2B24] border border-[#F3EFE4]/10 rounded px-1 py-0.5 text-[13px] font-data text-[#8BAE8C]">
                {children}
              </code>
            );
          }

          return (
            <pre className="bg-[#1E2B24] border border-[#F3EFE4]/10 rounded-lg p-3 overflow-x-auto mb-2">
              <code
                className="text-[13px] font-data text-[#D8D3C5] leading-relaxed"
                {...props}
              >
                {children}
              </code>
            </pre>
          );
        },

        // --------------------------------------------------
        // Citation interception
        //
        // Two checks, in order:
        //
        // 1. Text-based check: if the visible link text is a
        //    bare number that matches a known citation index,
        //    treat it as a citation REGARDLESS of what its href
        //    is. This covers the case where the model already
        //    emits a real markdown link like "[6](https://...)"
        //    or "[6](#)" — which prepareCitationLinks() leaves
        //    untouched (see its comment above) and which would
        //    otherwise fall through to a real <a> and navigate
        //    the browser away.
        //
        // 2. href-based check: our own "citation:N" scheme,
        //    injected by prepareCitationLinks() for bare "[6]"
        //    markers that weren't already a link.
        //
        // Anything else renders as a normal external link.
        // --------------------------------------------------
        a: ({ href, children }) => {
          const rawText = Array.isArray(children)
            ? children.join("")
            : String(children ?? "");

          const textAsIndex = Number(rawText.trim());

          if (
            rawText.trim() !== "" &&
            !Number.isNaN(textAsIndex) &&
            citations?.some((c) => c.index === textAsIndex)
          ) {
            const citation = citations.find(
              (c) => c.index === textAsIndex,
            )!;

            return (
              <CitationBadge
                citation={citation}
                onClick={onCitationClick}
              />
            );
          }

          if (href?.startsWith("citation:")) {
            const idx = Number(
              href.replace("citation:", ""),
            );

            const citation = citations?.find(
              (c) => c.index === idx,
            );

            if (citation) {
              return (
                <CitationBadge
                  citation={citation}
                  onClick={onCitationClick}
                />
              );
            }

            return null;
          }

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8B94D] underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {prepareCitationLinks(content)}
    </ReactMarkdown>
  );
}

export default function ChatPanel({
  notebookId,
  hasReadySources,
}: {
  notebookId: string;
  hasReadySources: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);

  const [input, setInput] = useState("");

  const [sending, setSending] = useState(false);

  const [querySession, setQuerySession] =
    useState<QuerySession | null>(null);

  const [activeCitation, setActiveCitation] =
    useState<Citation | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // --------------------------------------------------
  // Inngest Realtime configuration
  // --------------------------------------------------

  const realtimeChannel = querySession
  ? queryChannel({
      requestId: querySession.requestId,
    })
  : undefined;

  const realtimeTopics = ["token", "done", "error"] as const;

const {
  messages: realtimeMessages,
  error: realtimeError,
} = useRealtime({
  channel: realtimeChannel,
  topics: realtimeTopics,
  token: querySession?.realtimeToken,
  key: querySession?.requestId,
  enabled: !!querySession,
  bufferInterval: 50,
});

  // --------------------------------------------------
  // Scroll chat to bottom
  // --------------------------------------------------

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // --------------------------------------------------
  // Handle Realtime messages
  // --------------------------------------------------

  useEffect(() => {
    if (!querySession) return;

    for (const message of realtimeMessages.delta) {
      // Ignore lifecycle/run messages.
      if (message.kind === "run") {
        continue;
      }

      // ----------------------------------------------
      // TOKEN
      // ----------------------------------------------

      if (message.topic === "token") {
        const data = message.data as {
          content: string;
        };

        setMessages((prev) => {
          const next = [...prev];

          const last = next[next.length - 1];

          // Defensive check so a delayed/stale event
          // cannot corrupt the message list.
          if (!last || last.role !== "assistant") {
            return prev;
          }

          next[next.length - 1] = {
            ...last,
            content:
              last.content + data.content,
          };

          return next;
        });

        continue;
      }

      // ----------------------------------------------
      // DONE
      // ----------------------------------------------

      if (message.topic === "done") {
        const data = message.data as {
          citations: Citation[];
        };

        setMessages((prev) => {
          const next = [...prev];

          const last = next[next.length - 1];

          if (!last || last.role !== "assistant") {
            return prev;
          }

          next[next.length - 1] = {
            ...last,
            citations: data.citations ?? [],
            streaming: false,
          };

          return next;
        });

        setSending(false);

        setQuerySession(null);

        continue;
      }

      // ----------------------------------------------
      // ERROR
      // ----------------------------------------------

      if (message.topic === "error") {
        const data = message.data as {
          message: string;
        };

        setMessages((prev) => {
          const next = [...prev];

          const last = next[next.length - 1];

          if (!last || last.role !== "assistant") {
            return prev;
          }

          next[next.length - 1] = {
            ...last,
            content: `Something went wrong: ${data.message}`,
            streaming: false,
          };

          return next;
        });

        setSending(false);

        setQuerySession(null);
      }
    }
  }, [
    realtimeMessages.delta,
    querySession,
  ]);

  // --------------------------------------------------
  // Realtime connection error
  // --------------------------------------------------

  useEffect(() => {
    if (!realtimeError || !querySession) {
      return;
    }

    setMessages((prev) => {
      const next = [...prev];

      const last = next[next.length - 1];

      if (!last || last.role !== "assistant") {
        return prev;
      }

      next[next.length - 1] = {
        ...last,
        content: `Something went wrong: ${realtimeError.message}`,
        streaming: false,
      };

      return next;
    });

    setSending(false);

    setQuerySession(null);
  }, [
    realtimeError,
    querySession,
  ]);

  // --------------------------------------------------
  // Send query
  // --------------------------------------------------

  async function handleSend() {
    const query = input.trim();

    if (!query || sending) {
      return;
    }

    setInput("");

    setSending(true);

    // Add user message + empty assistant message
    // immediately so tokens have somewhere to go.
    setMessages((prev) => [
      ...prev,

      {
        role: "user",
        content: query,
      },

      {
        role: "assistant",
        content: "",
        streaming: true,
      },
    ]);

    try {
      const session = await startQuery(
        notebookId,
        query,
      );

      setQuerySession(session);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Query failed";

      setMessages((prev) => {
        const next = [...prev];

        const last = next[next.length - 1];

        if (!last || last.role !== "assistant") {
          return prev;
        }

        next[next.length - 1] = {
          ...last,
          content: `Something went wrong: ${message}`,
          streaming: false,
        };

        return next;
      });

      setSending(false);

      setQuerySession(null);
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-[#6E786F] text-sm mt-10 text-center">
            {hasReadySources
              ? "Ask a question grounded in this notebook's sources."
              : "Add and index at least one source, then ask a question here."}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "text-right"
                : "text-left"
            }
          >
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-sm text-left ${
                m.role === "user"
                  ? "bg-[#E8B94D] text-[#1E2B24] font-medium"
                  : "bg-[#26362D] border border-[#F3EFE4]/10 text-[#F3EFE4]"
              }`}
            >
              {m.content ? (
                m.role === "assistant" ? (
                  <AssistantMarkdown
                    content={m.content}
                    citations={m.citations}
                    onCitationClick={
                      setActiveCitation
                    }
                  />
                ) : (
                  <span className="whitespace-pre-wrap">
                    {m.content}
                  </span>
                )
              ) : (
                m.streaming && (
                  <span className="text-[#8B9189]">
                    Thinking...
                  </span>
                )
              )}
            </div>
          </div>
        ))}

        <div ref={scrollRef} />
      </div>

      <div className="border-t border-[#F3EFE4]/10 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Type a query here....."
          disabled={sending}
          className="flex-1 border border-[#F3EFE4]/15 rounded-lg px-4 py-2 bg-[#26362D] text-[#F3EFE4] placeholder:text-[#6E786F] focus:outline-none focus:ring-1 focus:ring-[#E8B94D] focus:border-[#E8B94D] disabled:opacity-60 transition-colors"
        />

        <button
          onClick={handleSend}
          disabled={
            sending || !input.trim()
          }
          className="bg-[#E8B94D] text-[#1E2B24] font-semibold px-5 py-2 rounded-lg disabled:opacity-30 hover:bg-[#F3EFE4] transition-colors"
        >
          Ask
        </button>
      </div>

      {activeCitation && (
        <SourceViewerModal
          citation={activeCitation}
          onClose={() =>
            setActiveCitation(null)
          }
        />
      )}
    </div>
  );
}