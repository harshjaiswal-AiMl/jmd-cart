import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import { OcrEngine, OcrResult, OcrPage, OcrLine, OcrWord } from "./ocr.types";

interface TextItem {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, transX, transY]
  width: number;
  height: number;
}

export class PdfTextEngine implements OcrEngine {
  async processImage(buffer: Buffer): Promise<OcrResult> {
    throw new Error("PdfTextEngine only processes PDF documents");
  }

  async processPdf(buffer: Buffer): Promise<OcrResult> {
    const startTime = Date.now();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const pages: OcrPage[] = [];
    let totalText = "";

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const words: OcrWord[] = [];
      const lineMap = new Map<number, OcrWord[]>();

      for (const rawItem of textContent.items) {
        const item = rawItem as TextItem;
        const text = item.str?.trim();
        if (!text) continue;

        const x0 = Math.round(item.transform[4]);
        const y0 = Math.round(viewport.height - item.transform[5]);
        const x1 = Math.round(x0 + (item.width || 0));
        const y1 = Math.round(y0 + (item.height || 10));

        const word: OcrWord = {
          text,
          confidence: 99.0, // Digital PDF text has 99%+ accuracy
          bbox: { x0, y0, x1, y1 },
        };

        words.push(word);

        // Group into lines by similar Y coordinate (within 4 pixels)
        let foundLineY: number | null = null;
        for (const lineY of lineMap.keys()) {
          if (Math.abs(lineY - y0) <= 4) {
            foundLineY = lineY;
            break;
          }
        }

        if (foundLineY !== null) {
          lineMap.get(foundLineY)!.push(word);
        } else {
          lineMap.set(y0, [word]);
        }
      }

      // Sort lines vertically from top to bottom
      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => a - b);
      const lines: OcrLine[] = sortedYs.map((y) => {
        const lineWords = lineMap.get(y)!.sort((a, b) => a.bbox.x0 - b.bbox.x0);
        return {
          text: lineWords.map((w) => w.text).join(" "),
          words: lineWords,
          bbox: {
            x0: Math.min(...lineWords.map((w) => w.bbox.x0)),
            y0: Math.min(...lineWords.map((w) => w.bbox.y0)),
            x1: Math.max(...lineWords.map((w) => w.bbox.x1)),
            y1: Math.max(...lineWords.map((w) => w.bbox.y1)),
          },
        };
      });

      const pageText = lines.map((l) => l.text).join("\n");
      totalText += pageText + "\n";

      pages.push({
        pageNumber: i,
        text: pageText,
        lines,
        words,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
      });
    }

    return {
      pages,
      durationMs: Date.now() - startTime,
      confidence: 98.0,
      engine: "PDF_TEXT",
    };
  }
}

export const pdfTextEngine = new PdfTextEngine();
