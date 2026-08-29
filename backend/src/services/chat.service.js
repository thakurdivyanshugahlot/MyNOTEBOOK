import "dotenv/config";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";

function buildContextBlock(chunks) {
  return chunks
    .map((c, i) => `[${i + 1}] (source: "${c.sourceName}")\n${c.text}`)
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are a research assistant aswell as a Frierndly Teacher best in the world who teaches his student in way that they remember evrything thay ask and  answering questions using ONLY the numbered
source excerpts provided in the user message.

Formatting rules — write like a well-organized study guide, not a plain paragraph:
- If the answer covers more than one topic, section it with "###" Markdown headers.
- **Bold** key terms, names, library/function names, and important values.
- Use bullet or numbered lists for anything enumerable (steps, properties, options, functions).
- Put code, commands, or syntax in fenced code blocks with a language tag (\`\`\`python), or inline
  backticks for a short snippet like \`df.head()\`.
- Nest related sub-points under their parent bullet instead of flattening everything.
- Keep prose tight — this is a reference document, not an essay.

Grounding rules:
- Answer only from the given excerpts. If they don't contain the answer, say so plainly — do not guess or use outside knowledge.
- Every claim you make must be followed by a citation marker like [1] or [2] referencing the excerpt(s) it came from.
- If multiple excerpts support a claim, cite all of them, e.g. [1][3].
- Never place a citation marker inside a code block — put it in the line of prose introducing or following the code instead.
- Do not fabricate citation numbers beyond what was provided.`;

export async function streamGroundedAnswer({ query, chunks, writeEvent }) {
  if (chunks.length === 0) {
    await writeEvent({
      type: "token",
      content: "I couldn't find anything in this notebook's sources that answers that question.",
    });
    await writeEvent({ type: "done", citations: [] });
    return;
  }

  const contextBlock = buildContextBlock(chunks);
  const userMessage = `Question: ${query}\n\nSource excerpts:\n${contextBlock}`;

  const stream = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content;
    if (token) {
      await writeEvent({ type: "token", content: token });
    }
  }

  const citations = chunks.map((c, i) => ({
    index: i + 1,
    sourceId: c.sourceId,
    sourceName: c.sourceName,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl ?? null,
    snippet: c.text,
    startPage: c.startPage ?? null,
    endPage: c.endPage ?? null,
    startTime: c.startTime ?? null,
    startTimestamp: c.startTimestamp ?? null,
    endTimestamp: c.endTimestamp ?? null,
  }));

  await writeEvent({ type: "done", citations });
}