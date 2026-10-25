export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OcrLine {
  text: string;
  words: OcrWord[];
  bbox: BoundingBox;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  lines: OcrLine[];
  words: OcrWord[];
  width: number;
  height: number;
}

export interface OcrResult {
  pages: OcrPage[];
  durationMs: number;
  confidence: number;
  engine: "TESSERACT_WASM" | "PDF_TEXT" | "MANUAL";
}

export interface OcrEngine {
  processImage(buffer: Buffer, pageNumber?: number): Promise<OcrResult>;
  processPdf(buffer: Buffer): Promise<OcrResult>;
}

export interface ParsedBillItem {
  lineNo: number;
  rawText: string;
  parsedName: string;
  hsn?: string;
  billedQty: number;
  billedUnit: string;
  billedQtyPieces: number;
  ratePaise: number;
  gstRateBp: number;
  amountPaise: number;
  discountPercent?: number;
  flags: string[];
  confidence: number;
}

export interface ParsedBill {
  supplierName?: string;
  supplierGstin?: string;
  billNo?: string;
  billDate?: Date;
  billTotalPaise?: number;
  taxableTotalPaise?: number;
  taxTotalPaise?: number;
  items: ParsedBillItem[];
  confidence: number;
  rawText: string;
}
