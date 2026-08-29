import { YoutubeTranscript } from "youtube-transcript";

/**
 * Fetches the auto-generated/manual caption track for a YouTube video and
 * converts it into the same {start, end, text} cue shape used for VTT/SRT,
 * so it flows through the same timestamp-aware chunker.
 */
export async function parseYoutubeVideo(url) {
  const items = await YoutubeTranscript.fetchTranscript(url);

  if (!items || items.length === 0) {
    throw new Error(`No transcript/captions available for ${url}`);
  }

  const cues = items.map((item) => ({
    start: item.offset / 1000,
    end: (item.offset + item.duration) / 1000,
    text: item.text,
  }));

  return { type: "subtitle", cues, url };
}
