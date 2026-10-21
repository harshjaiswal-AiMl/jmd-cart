import { deflateRawSync, inflateRawSync } from "zlib";

export interface ParsedCell {
  raw: string | number | null;
  display: string;
  isPercentFormatted?: boolean;
  numFmtCode?: string;
}

export interface ParsedWorksheet {
  name: string;
  rows: ParsedCell[][];
}

export interface WriteWorksheetInput {
  name: string;
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

// Precomputed CRC32 table for ZIP archive reading & writing
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Extract all files from a standard ZIP buffer (such as an .xlsx file).
 */
function unzipBuffer(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();

  // Locate End of Central Directory (EOCD) signature 0x06054b50
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Invalid .xlsx / ZIP archive: End of Central Directory not found");
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  let ptr = cdOffset;
  for (let e = 0; e < totalEntries; e++) {
    if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const fileNameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);

    const fileName = buf
      .subarray(ptr + 46, ptr + 46 + fileNameLen)
      .toString("utf8")
      .replace(/\\/g, "/");

    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 > buf.length) continue;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = buf.subarray(dataStart, dataStart + compressedSize);

    if (fileName.endsWith("/")) continue;

    if (compressionMethod === 0) {
      files.set(fileName, Buffer.from(compressedData));
    } else if (compressionMethod === 8) {
      files.set(fileName, inflateRawSync(compressedData));
    }
  }

  return files;
}

/**
 * Create a standard ZIP buffer from a map of file paths and contents.
 */
function createZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const uncompressed = entry.data;
    const compressed = deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    // Local File Header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression method: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra len

    localParts.push(localHeader, nameBuf, compressed);

    // Central Directory Header (46 bytes + name)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // signature
    cdHeader.writeUInt16LE(20, 4); // version made by
    cdHeader.writeUInt16LE(20, 6); // version needed
    cdHeader.writeUInt16LE(0, 8); // flags
    cdHeader.writeUInt16LE(8, 10); // compression method: deflate
    cdHeader.writeUInt16LE(0, 12); // mod time
    cdHeader.writeUInt16LE(0, 14); // mod date
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(compressed.length, 20);
    cdHeader.writeUInt32LE(uncompressed.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30); // extra len
    cdHeader.writeUInt16LE(0, 32); // comment len
    cdHeader.writeUInt16LE(0, 34); // disk number
    cdHeader.writeUInt16LE(0, 36); // internal attrs
    cdHeader.writeUInt32LE(0, 38); // external attrs
    cdHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(cdHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const cdBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuffer, eocd]);
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert Excel column letters (A, B, ..., Z, AA, AB...) to 0-based column index.
 */
function colLettersToIndex(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/**
 * Convert 0-based column index to Excel column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
function colIndexToLetters(index: number): string {
  let n = index + 1;
  let str = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

function parseSharedStrings(xml: string): string[] {
  const result: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    const siBody = match[1];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    let text = "";
    while ((tMatch = tRegex.exec(siBody)) !== null) {
      text += decodeXmlEntities(tMatch[1]);
    }
    result.push(text);
  }
  return result;
}

/**
 * Parse styles.xml to determine which cell style indices (`s="..."`) use a percentage format.
 * Built-in Excel numFmtIds 9 (`0%`) and 10 (`0.00%`) are percentage formats, plus custom formats containing `%`.
 */
function parseStylePercentFlags(xml: string | undefined): boolean[] {
  if (!xml) return [];
  const customFmtMap = new Map<number, string>();
  const numFmtRegex = /<numFmt\b([^>]*)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = numFmtRegex.exec(xml)) !== null) {
    const attrs = m[1];
    const idMatch = /\bnumFmtId="(\d+)"/.exec(attrs);
    const codeMatch = /\bformatCode="([^"]*)"/.exec(attrs);
    if (idMatch && codeMatch) {
      customFmtMap.set(Number(idMatch[1]), decodeXmlEntities(codeMatch[1]));
    }
  }

  const cellXfsBlockMatch = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!cellXfsBlockMatch) return [];

  const flags: boolean[] = [];
  const xfRegex = /<xf\b([^>]*)\/?>/g;
  let xfMatch: RegExpExecArray | null;
  while ((xfMatch = xfRegex.exec(cellXfsBlockMatch[1])) !== null) {
    const attrs = xfMatch[1];
    const fmtIdMatch = /\bnumFmtId="(\d+)"/.exec(attrs);
    const fmtId = fmtIdMatch ? Number(fmtIdMatch[1]) : 0;
    const customCode = customFmtMap.get(fmtId);
    const isPercent =
      fmtId === 9 ||
      fmtId === 10 ||
      Boolean(customCode && customCode.includes("%"));
    flags.push(isPercent);
  }
  return flags;
}

function parseSheetXml(
  xml: string,
  sharedStrings: string[],
  stylePercentFlags: boolean[]
): ParsedCell[][] {
  const rows: ParsedCell[][] = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowBody = rowMatch[2];
    const rowCells: ParsedCell[] = [];

    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextColIdx = 0;

    while ((cellMatch = cellRegex.exec(rowBody)) !== null) {
      const attrs = cellMatch[1];
      const cellBody = cellMatch[2] ?? "";

      const refMatch = /\br="([A-Z]+)\d+"/.exec(attrs);
      const colIdx = refMatch ? colLettersToIndex(refMatch[1]) : nextColIdx;
      nextColIdx = colIdx + 1;

      const typeMatch = /\bt="([^"]+)"/.exec(attrs);
      const cellType = typeMatch ? typeMatch[1] : "n";

      const styleMatch = /\bs="(\d+)"/.exec(attrs);
      const styleIdx = styleMatch ? Number(styleMatch[1]) : -1;
      const isPercentFormatted =
        styleIdx >= 0 ? Boolean(stylePercentFlags[styleIdx]) : false;

      let raw: string | number | null = null;
      let display = "";

      if (cellType === "inlineStr") {
        const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        let text = "";
        while ((tMatch = tRegex.exec(cellBody)) !== null) {
          text += decodeXmlEntities(tMatch[1]);
        }
        raw = text;
        display = text;
      } else {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cellBody);
        const vText = vMatch ? decodeXmlEntities(vMatch[1]).trim() : "";

        if (vText !== "") {
          if (cellType === "s") {
            const sstIdx = Number(vText);
            const str = sharedStrings[sstIdx] ?? "";
            raw = str;
            display = str;
          } else if (cellType === "str" || cellType === "e") {
            raw = vText;
            display = vText;
          } else if (cellType === "b") {
            raw = vText === "1" ? "TRUE" : "FALSE";
            display = raw;
          } else {
            const num = Number(vText);
            if (Number.isFinite(num)) {
              raw = num;
              display = isPercentFormatted ? `${+(num * 100).toFixed(4)}%` : String(num);
            } else {
              raw = vText;
              display = vText;
            }
          }
        }
      }

      while (rowCells.length < colIdx) {
        rowCells.push({ raw: null, display: "" });
      }
      rowCells[colIdx] = {
        raw,
        display,
        isPercentFormatted,
      };
    }

    rows.push(rowCells);
  }

  return rows;
}

/**
 * Parse a CSV string into a single worksheet of ParsedCells.
 */
export function parseCsvToWorksheets(csvText: string, sheetName = "Sheet1"): ParsedWorksheet[] {
  const cleanText = csvText.replace(/^\uFEFF/, "");
  const lines: string[][] = [];
  let curRow: string[] = [];
  let curField = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          curField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        curField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        curRow.push(curField);
        curField = "";
      } else if (ch === "\r") {
        if (cleanText[i + 1] === "\n") i++;
        curRow.push(curField);
        lines.push(curRow);
        curRow = [];
        curField = "";
      } else if (ch === "\n") {
        curRow.push(curField);
        lines.push(curRow);
        curRow = [];
        curField = "";
      } else {
        curField += ch;
      }
    }
  }
  if (curField.length > 0 || curRow.length > 0) {
    curRow.push(curField);
    lines.push(curRow);
  }

  const rows: ParsedCell[][] = lines.map((line) =>
    line.map((cellStr) => {
      const trimmed = cellStr.trim();
      if (trimmed === "") return { raw: null, display: "" };
      const isPct = trimmed.endsWith("%") && Number.isFinite(Number(trimmed.slice(0, -1)));
      if (isPct) {
        return {
          raw: trimmed,
          display: trimmed,
          isPercentFormatted: true,
        };
      }
      const num = Number(trimmed);
      if (Number.isFinite(num) && !/^0\d+/.test(trimmed)) {
        return { raw: num, display: trimmed };
      }
      return { raw: trimmed, display: trimmed };
    })
  );

  return [{ name: sheetName, rows }];
}

/**
 * Parse either an .xlsx buffer or a .csv buffer into an array of worksheets.
 */
export function readWorkbookFromBuffer(
  buffer: Buffer,
  filename = "upload.xlsx"
): ParsedWorksheet[] {
  // Check if ZIP header (PK\x03\x04)
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (!isZip || filename.toLowerCase().endsWith(".csv")) {
    const baseName = filename.replace(/\.[^.]+$/, "") || "Sheet1";
    return parseCsvToWorksheets(buffer.toString("utf8"), baseName);
  }

  const files = unzipBuffer(buffer);

  const sharedStringsXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];

  const stylesXml = files.get("xl/styles.xml")?.toString("utf8");
  const stylePercentFlags = parseStylePercentFlags(stylesXml);

  const workbookXml = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";

  // Map r:id -> target path inside xl/
  const relMap = new Map<string, string>();
  const relRegex = /<Relationship\b([^>]*)\/?>/g;
  let relMatch: RegExpExecArray | null;
  while ((relMatch = relRegex.exec(relsXml)) !== null) {
    const attrs = relMatch[1];
    const idMatch = /\bId="([^"]+)"/.exec(attrs);
    const targetMatch = /\bTarget="([^"]+)"/.exec(attrs);
    if (idMatch && targetMatch) {
      let target = targetMatch[1].replace(/^\/+/, "");
      if (!target.startsWith("xl/")) {
        target = `xl/${target}`;
      }
      relMap.set(idMatch[1], target);
    }
  }

  const worksheets: ParsedWorksheet[] = [];
  const sheetTagRegex = /<sheet\b([^>]*)\/?>/g;
  let sheetMatch: RegExpExecArray | null;
  let idx = 1;

  while ((sheetMatch = sheetTagRegex.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const nameMatch = /\bname="([^"]+)"/.exec(attrs);
    const rIdMatch = /\br:id="([^"]+)"/.exec(attrs);
    const sheetName = nameMatch ? decodeXmlEntities(nameMatch[1]) : `Sheet${idx}`;
    const rId = rIdMatch ? rIdMatch[1] : "";

    const targetPath = relMap.get(rId) || `xl/worksheets/sheet${idx}.xml`;
    const sheetXml = files.get(targetPath)?.toString("utf8");
    if (sheetXml) {
      const rows = parseSheetXml(sheetXml, sharedStrings, stylePercentFlags);
      worksheets.push({ name: sheetName, rows });
    }
    idx++;
  }

  // Fallback if workbook.xml didn't match standard sheet tags
  if (worksheets.length === 0) {
    for (const [path, data] of files.entries()) {
      if (path.startsWith("xl/worksheets/sheet") && path.endsWith(".xml")) {
        const rows = parseSheetXml(data.toString("utf8"), sharedStrings, stylePercentFlags);
        worksheets.push({ name: `Sheet${worksheets.length + 1}`, rows });
      }
    }
  }

  return worksheets;
}

/**
 * Build a valid multi-sheet .xlsx Buffer from an array of worksheets.
 */
export function writeWorkbookToBuffer(sheets: WriteWorksheetInput[]): Buffer {
  const safeSheets =
    sheets.length > 0 ? sheets : [{ name: "Sheet1", rows: [[]] }];

  const entries: Array<{ name: string; data: Buffer }> = [];

  // 1. [Content_Types].xml
  const sheetOverrides = safeSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
  entries.push({ name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") });

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  entries.push({ name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") });

  // 3. xl/workbook.xml
  const workbookSheetsXml = safeSheets
    .map((s, i) => {
      const cleanName = escapeXml(s.name.slice(0, 31) || `Sheet${i + 1}`);
      return `<sheet name="${cleanName}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    })
    .join("");

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${workbookSheetsXml}</sheets>
</workbook>`;
  entries.push({ name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") });

  // 4. xl/_rels/workbook.xml.rels
  const wbRelsItems = safeSheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("");
  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${wbRelsItems}
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  entries.push({ name: "xl/_rels/workbook.xml.rels", data: Buffer.from(wbRelsXml, "utf8") });

  // 5. xl/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;
  entries.push({ name: "xl/styles.xml", data: Buffer.from(stylesXml, "utf8") });

  // 6. xl/worksheets/sheet{N}.xml
  safeSheets.forEach((sheet, sIdx) => {
    const rowXmlParts: string[] = [];
    sheet.rows.forEach((row, rIdx) => {
      const rowNum = rIdx + 1;
      const cellXmlParts: string[] = [];
      row.forEach((cellVal, cIdx) => {
        if (cellVal === null || cellVal === undefined || cellVal === "") return;
        const colRef = `${colIndexToLetters(cIdx)}${rowNum}`;
        if (typeof cellVal === "number" && Number.isFinite(cellVal)) {
          cellXmlParts.push(`<c r="${colRef}" t="n"><v>${cellVal}</v></c>`);
        } else if (typeof cellVal === "boolean") {
          cellXmlParts.push(`<c r="${colRef}" t="b"><v>${cellVal ? 1 : 0}</v></c>`);
        } else {
          const text = escapeXml(String(cellVal));
          cellXmlParts.push(
            `<c r="${colRef}" t="inlineStr"><is><t>${text}</t></is></c>`
          );
        }
      });
      rowXmlParts.push(`<row r="${rowNum}">${cellXmlParts.join("")}</row>`);
    });

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXmlParts.join("")}</sheetData>
</worksheet>`;
    entries.push({
      name: `xl/worksheets/sheet${sIdx + 1}.xml`,
      data: Buffer.from(sheetXml, "utf8"),
    });
  });

  return createZipBuffer(entries);
}
