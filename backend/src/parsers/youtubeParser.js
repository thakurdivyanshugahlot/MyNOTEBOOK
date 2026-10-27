import { YoutubeTranscript } from "youtube-transcript";

// Marker used to recognize this failure later in the indexing function.
export const YOUTUBE_CAPTIONS_MARKER = "YOUTUBE_CAPTIONS_UNAVAILABLE";

// Errors from youtube-transcript that will not fix themselves on retry.
const PERMANENT_ERROR_PATTERN =
  /disabled|not available|no transcript|no captions|unavailable|too many requests|captcha|sign in/i;

/**
 * Fetches the auto-generated/manual caption track for a YouTube video and
 * converts it into the same {start, end, text} cue shape used for VTT/SRT,
 * so it flows through the same timestamp-aware chunker.
 */
export async function parseYoutubeVideo(url) {
  let items;

  try {
    items = await YoutubeTranscript.fetchTranscript(url);
  } catch (err) {
    const message = String(err?.message || err);

    if (PERMANENT_ERROR_PATTERN.test(message)) {
      throw new Error(`${YOUTUBE_CAPTIONS_MARKER}: ${message}`);
    }

    // Unknown/transient error (network etc.): let Inngest retry it.
    throw err;
  }

  if (!items || items.length === 0) {
    throw new Error(
      `${YOUTUBE_CAPTIONS_MARKER}: No transcript/captions available for ${url}`,
    );
  }

  const cues = items.map((item) => ({
    start: item.offset / 1000,
    end: (item.offset + item.duration) / 1000,
    text: item.text,
  }));

  return { type: "subtitle", cues, url };
}