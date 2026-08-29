/**
 * Lightweight website text extractor — no headless browser, just fetch +
 * strip markup. Good enough for article/docs-style pages. Pages that
 * render content client-side via JS won't extract well; that's a known
 * limitation (see README).
 */
function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function parseWebsite(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NotebookRAG/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (status ${res.status})`);
  }

  const html = await res.text();

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : url;

  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const text = decodeEntities(withoutNoise.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    throw new Error(`No extractable text content found at ${url}`);
  }

  return { type: "text", text, title, url };
}
