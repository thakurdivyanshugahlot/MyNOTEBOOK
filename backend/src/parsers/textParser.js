import fs from "fs/promises";

export async function parseTextFile(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  return { type: "text", text: content };
}
