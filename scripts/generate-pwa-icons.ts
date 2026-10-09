import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function generatePng(size: number, bgColor = [15, 23, 42, 255], accentColor = [16, 185, 129, 255]): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = createChunk("IHDR", ihdrData);

  // Raw image data with scanline filter 0
  const rowSize = 1 + size * 4;
  const rawData = Buffer.alloc(rowSize * size);

  const center = size / 2;
  const radius = size * 0.42;
  const innerRadius = size * 0.35;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded app icon badge
      const cornerRadius = size * 0.22;
      const rx = Math.abs(x - center) - (center - cornerRadius);
      const ry = Math.abs(y - center) - (center - cornerRadius);
      const isInsideCard =
        rx <= 0 ||
        ry <= 0 ||
        (rx > 0 && ry > 0 && Math.sqrt(rx * rx + ry * ry) <= cornerRadius);

      if (!isInsideCard) {
        // Transparent outside rounded icon
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      } else {
        // Draw truck / cart emblem in center
        // Truck cabin / box rectangle:
        const inBox = (x >= size * 0.22 && x <= size * 0.62 && y >= size * 0.32 && y <= size * 0.62);
        const inCab = (x >= size * 0.62 && x <= size * 0.78 && y >= size * 0.42 && y <= size * 0.62);
        const inWheel1 = Math.sqrt((x - size * 0.36) ** 2 + (y - size * 0.66) ** 2) <= size * 0.08;
        const inWheel2 = Math.sqrt((x - size * 0.68) ** 2 + (y - size * 0.66) ** 2) <= size * 0.08;
        const inStripe = (x >= size * 0.24 && x <= size * 0.60 && y >= size * 0.45 && y <= size * 0.49);

        if (inWheel1 || inWheel2) {
          // Dark tire with accent center
          const distWheel = inWheel1
            ? Math.sqrt((x - size * 0.36) ** 2 + (y - size * 0.66) ** 2)
            : Math.sqrt((x - size * 0.68) ** 2 + (y - size * 0.66) ** 2);
          if (distWheel < size * 0.04) {
            rawData[pixelOffset] = accentColor[0];
            rawData[pixelOffset + 1] = accentColor[1];
            rawData[pixelOffset + 2] = accentColor[2];
            rawData[pixelOffset + 3] = 255;
          } else {
            rawData[pixelOffset] = 255;
            rawData[pixelOffset + 1] = 255;
            rawData[pixelOffset + 2] = 255;
            rawData[pixelOffset + 3] = 255;
          }
        } else if (inStripe) {
          // Accent stripe
          rawData[pixelOffset] = accentColor[0];
          rawData[pixelOffset + 1] = accentColor[1];
          rawData[pixelOffset + 2] = accentColor[2];
          rawData[pixelOffset + 3] = 255;
        } else if (inBox || inCab) {
          // Pure white truck body
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = 255;
        } else {
          // App background
          rawData[pixelOffset] = bgColor[0];
          rawData[pixelOffset + 1] = bgColor[1];
          rawData[pixelOffset + 2] = bgColor[2];
          rawData[pixelOffset + 3] = bgColor[3];
        }
      }
    }
  }

  const idatCompressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", idatCompressed);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files
const outDir = path.join(process.cwd(), "public", "icons");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, "icon-192.png"), generatePng(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), generatePng(512));
fs.writeFileSync(path.join(outDir, "icon-maskable.png"), generatePng(512, [15, 23, 42, 255], [16, 185, 129, 255]));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), generatePng(180));

// Also generate a root favicon.ico (can be a 32x32 PNG file which modern browsers accept as icon)
const publicDir = path.join(process.cwd(), "public");
fs.writeFileSync(path.join(publicDir, "favicon.ico"), generatePng(32));

console.log("PWA Icons generated successfully in public/icons and public/favicon.ico");
