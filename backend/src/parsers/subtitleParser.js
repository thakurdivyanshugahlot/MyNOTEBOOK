import fs from "fs/promises";

const TIME_LINE_REGEX = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;

function timeToSeconds(timeStr) {
  const normalized = timeStr.replace(",", ".");
  const [h, m, sMs] = normalized.split(":");
  const [s, ms] = sMs.split(".");
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/** Parses .vtt and .srt (structurally near-identical) into timestamped cues. */
export async function parseSubtitleFile(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  const normalized = raw.replace(/\r\n/g, "\n").replace(/^WEBVTT.*\n/, "");
  const blocks = normalized
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const timeLineIndex = lines.findIndex((line) => TIME_LINE_REGEX.test(line));
    if (timeLineIndex === -1) continue;

    const match = lines[timeLineIndex].match(TIME_LINE_REGEX);
    const start = timeToSeconds(match[1]);
    const end = timeToSeconds(match[2]);
    const text = lines
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text) cues.push({ start, end, text });
  }

  return { type: "subtitle", cues };
}
