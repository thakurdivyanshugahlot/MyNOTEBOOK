import { parseTextFile } from "./textParser.js";
import { parsePdfFile } from "./pdfParser.js";
import { parseSubtitleFile } from "./subtitleParser.js";
import { parseWebsite } from "./websiteParser.js";
import { parseYoutubeVideo } from "./youtubeParser.js";

/**
 * @param {{ type: string, filePath?: string, sourceUrl?: string }} source
 */
export async function parseSource(source) {
  switch (source.type) {
    case "text":
      return parseTextFile(source.filePath);
    case "pdf":
      return parsePdfFile(source.filePath);
    case "vtt":
      return parseSubtitleFile(source.filePath);
    case "website":
      return parseWebsite(source.sourceUrl);
    case "youtube":
      return parseYoutubeVideo(source.sourceUrl);
    default:
      throw new Error(`No parser registered for source type "${source.type}"`);
  }
}
