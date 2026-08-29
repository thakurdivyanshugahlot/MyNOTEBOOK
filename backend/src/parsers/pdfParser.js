import fs from "fs/promises";
import pdfParse from "pdf-parse";

export async function parsePdfFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const pageTexts = [];

  const data = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      pageTexts.push(pageText);
      return pageText; // pdf-parse still uses this for data.text if you need it
    },
  });

  return { type: "text", pageTexts, pageCount: data.numpages };
}