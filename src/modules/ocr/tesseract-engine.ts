import { createWorker, Worker } from "tesseract.js";
import path from "node:path";
import fs from "node:fs";
import { OcrEngine, OcrResult, OcrPage, OcrLine, OcrWord } from "./ocr.types";

/**
 * Concurrency semaphore: only 1 OCR job executes at a time per instance
 * to prevent CPU starvation and memory spikes on Cloud Run.
 */
class Semaphore {
  private running = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<() => void> {
    if (!this.running) {
      this.running = true;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running = true;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.running = false;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const semaphore = new Semaphore();

export class TesseractEngine implements OcrEngine {
  private langPath: string;

  constructor() {
    this.langPath = process.env.OCR_LANG_PATH || path.resolve(process.cwd(), "src/modules/ocr/vendor/tessdata");
    if (!fs.existsSync(path.join(this.langPath, "eng.traineddata"))) {
      throw new Error(`Vendored OCR traineddata not found at: ${this.langPath}`);
    }
  }

  async processImage(buffer: Buffer, pageNumber: number = 1): Promise<OcrResult> {
    const release = await semaphore.acquire();
    const startTime = Date.now();
    let worker: Worker | null = null;

    try {
      worker = await createWorker("eng", 1, {
        langPath: this.langPath,
        cachePath: this.langPath,
        gzip: false,
        errorHandler: () => {},
      });

      // 30-second hard timeout to protect server
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("OCR processing timed out after 30s")), 30000)
      );

      const recognizePromise = worker.recognize(buffer);
      const ret = await Promise.race([recognizePromise, timeoutPromise]);

      const lines: OcrLine[] = (ret.data.lines || []).map((line) => {
        const words: OcrWord[] = (line.words || []).map((w) => ({
          text: w.text.trim(),
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
          },
        }));

        return {
          text: line.text.trim(),
          words,
          bbox: {
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1,
          },
        };
      });

      const allWords = lines.flatMap((l) => l.words);

      const page: OcrPage = {
        pageNumber,
        text: ret.data.text || "",
        lines,
        words: allWords,
        width: 1000,
        height: 1000,
      };

      return {
        pages: [page],
        durationMs: Date.now() - startTime,
        confidence: ret.data.confidence,
        engine: "TESSERACT_WASM",
      };
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // Ignore termination errors
        }
      }
      release();
    }
  }

  async processPdf(buffer: Buffer): Promise<OcrResult> {
    // PDF processing through tesseract falls back to image OCR per page
    return this.processImage(buffer, 1);
  }
}

export const tesseractEngine = new TesseractEngine();
