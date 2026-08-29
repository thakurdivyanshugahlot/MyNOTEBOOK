import { formatTimestamp } from "./formatTimestamp.js";

const DEFAULT_CHUNK_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 150;
const DEFAULT_MAX_CUE_GROUP_CHARS = 800;

/** Sliding-window character chunking for plain text (txt/website). */
export function chunkPlainText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP_CHARS;

  const cleaned = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const chunkText = cleaned.slice(start, end).trim();

    if (chunkText) {
      chunks.push({ text: chunkText, metadata: { chunkIndex } });
      chunkIndex += 1;
    }

    if (end === cleaned.length) break;
    start = end - overlap;
  }

  return chunks;
}

/** Sliding-window chunking that tracks which PDF page(s) each chunk came from. */
export function chunkPlainTextWithPages(pageTexts, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP_CHARS;

  const pageRanges = [];
  let combined = "";

  pageTexts.forEach((raw, idx) => {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    const start = combined.length;
    combined += (combined ? " " : "") + cleaned;
    pageRanges.push({ pageNumber: idx + 1, start, end: combined.length });
  });

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < combined.length) {
    const end = Math.min(start + chunkSize, combined.length);
    const chunkText = combined.slice(start, end).trim();

    if (chunkText) {
      const overlappingPages = pageRanges
        .filter((p) => p.start < end && p.end > start)
        .map((p) => p.pageNumber);

      chunks.push({
        text: chunkText,
        metadata: {
          chunkIndex,
          startPage: overlappingPages[0] ?? null,
          endPage: overlappingPages[overlappingPages.length - 1] ?? null,
        },
      });
      chunkIndex += 1;
    }

    if (end === combined.length) break;
    start = end - overlap;
  }

  return chunks;
}

/** Groups timestamped cues (vtt/srt/youtube) into chunks, preserving start/end time. */
export function chunkSubtitleCues(cues, options = {}) {
  const maxChars = options.maxChunkChars || DEFAULT_MAX_CUE_GROUP_CHARS;

  const chunks = [];
  let buffer = [];
  let bufferChars = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (buffer.length === 0) return;

    const startTime = buffer[0].start;
    const endTime = buffer[buffer.length - 1].end;
    const text = buffer.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim();

    chunks.push({
      text,
      metadata: {
        chunkIndex,
        startTime,
        endTime,
        startTimestamp: formatTimestamp(startTime),
        endTimestamp: formatTimestamp(endTime),
      },
    });

    chunkIndex += 1;
    buffer = [];
    bufferChars = 0;
  };

  for (const cue of cues) {
    if (bufferChars + cue.text.length > maxChars && buffer.length > 0) flush();
    buffer.push(cue);
    bufferChars += cue.text.length;
  }
  flush();

  return chunks;
}