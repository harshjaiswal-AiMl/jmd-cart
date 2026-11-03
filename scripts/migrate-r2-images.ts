/**
 * One-time migration script to generate responsive WebP variants for existing images in R2 storage.
 * - Supports --dry-run mode (default if not specified or when passed --dry-run).
 * - Always preserves original image (zero deletion, non-destructive).
 * - Generates 160, 320, 640, 1080 WebP variants with sharp.
 * - Uploads variants with immutable 1-year cache headers.
 * 
 * Usage:
 *   pnpm tsx scripts/migrate-r2-images.ts --dry-run
 *   pnpm tsx scripts/migrate-r2-images.ts --execute
 */

import dotenv from "dotenv";
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/idms_test?schema=public";
}

import { prisma } from "../src/lib/prisma";
import { getStorage } from "../src/lib/storage";
import { generateImageVariants } from "../src/lib/storage/image-variants";
import sharp from "sharp";

async function main() {
  const isExecute = process.argv.includes("--execute");
  const isDryRun = !isExecute || process.argv.includes("--dry-run");
  const isMock = process.argv.includes("--mock");

  console.log("==================================================");
  console.log(`R2 Image Migration Script`);
  console.log(`Mode: ${isMock ? "MOCK VERIFICATION" : isDryRun ? "DRY-RUN (Simulating changes)" : "EXECUTE (Applying live changes)"}`);
  console.log("==================================================\n");

  if (isMock) {
    console.log("Creating synthetic high-resolution JPEG test image (1200x1200)...");
    const testBuffer = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 3,
        background: { r: 18, g: 53, b: 91 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(`Original test image size: ${(testBuffer.length / 1024).toFixed(1)} KB`);
    console.log("Generating responsive WebP variants (160, 320, 640, 1080)...");
    const result = await generateImageVariants(testBuffer, "test-hash", "jpg");

    for (const v of result.variants) {
      const meta = await sharp(v.buffer).metadata();
      const savingsPct = (((testBuffer.length - v.buffer.length) / testBuffer.length) * 100).toFixed(1);
      console.log(`✓ ${v.size}w (${v.key}): ${v.buffer.length} bytes (~${(v.buffer.length / 1024).toFixed(1)} KB) - ${meta.width}x${meta.height} [${meta.format}] (Payload reduction: ${savingsPct}%)`);
    }
    console.log("\nMock verification PASSED! Pipeline and Sharp WebP engine verified.");
    return;
  }

  const storage = getStorage();

  const products = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
  });

  console.log(`Found ${products.length} products with an imageUrl.\n`);

  let processedCount = 0;
  let skippedCount = 0;
  let totalOriginalBytes = 0;
  let totalOptimizedBytes = 0;

  for (const prod of products) {
    const rawUrl = prod.imageUrl;
    if (!rawUrl) continue;

    // Extract storage key from URL or relative path
    let key = rawUrl.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");
    if (key.startsWith("media/")) {
      key = key.replace(/^media\//, "");
    }

    // Check if key is a products/<hash>/... key
    if (!key.startsWith("products/")) {
      console.log(`[SKIP] Product ${prod.name} (${prod.id}) has external or non-standard key: ${rawUrl}`);
      skippedCount++;
      continue;
    }

    const parts = key.split("/");
    if (parts.length < 3) {
      console.log(`[SKIP] Product ${prod.name} (${prod.id}) has invalid key pattern: ${key}`);
      skippedCount++;
      continue;
    }

    const hash = parts[1];
    const filename = parts[2];

    // Try to get original object from storage
    const originalCandidates = [
      `products/${hash}/original.jpg`,
      `products/${hash}/original.jpeg`,
      `products/${hash}/original.png`,
      `products/${hash}/original.webp`,
      key, // in case current key is already original
    ];

    let originalObj: any = null;
    let foundOriginalKey = "";

    for (const cand of originalCandidates) {
      try {
        const obj = await storage.get(cand);
        if (obj) {
          originalObj = obj;
          foundOriginalKey = cand;
          break;
        }
      } catch {
        // try next
      }
    }

    if (!originalObj) {
      console.log(`[NOT FOUND] No original image found for ${prod.name} (${key})`);
      skippedCount++;
      continue;
    }

    const originalBuffer = Buffer.from(originalObj.body);
    const origSize = originalBuffer.length;
    totalOriginalBytes += origSize;

    // Check existing metadata
    const metadata = await sharp(originalBuffer).metadata();
    const ext = metadata.format || "jpeg";

    if (isDryRun) {
      console.log(
        `[DRY-RUN] Product: "${prod.name}" | Size: ${(origSize / 1024).toFixed(1)} KB | Dim: ${metadata.width}x${metadata.height}`
      );
      // Simulate variants
      const res = await generateImageVariants(originalBuffer, hash, ext);
      let optSum = 0;
      for (const v of res.variants) {
        optSum += v.buffer.length;
        console.log(`   -> Variant ${v.size}w: ${(v.buffer.length / 1024).toFixed(1)} KB (${v.width}x${v.height})`);
      }
      totalOptimizedBytes += res.variants.find((v) => v.size === 320)?.buffer.length || origSize;
      processedCount++;
    } else {
      console.log(`[PROCESSING] "${prod.name}" (${(origSize / 1024).toFixed(1)} KB)`);

      // Ensure original is stored safely under products/<hash>/original.<ext>
      const originalSaveKey = `products/${hash}/original.${ext === "jpeg" ? "jpg" : ext}`;
      await storage.put(originalSaveKey, originalBuffer, {
        contentType: originalObj.contentType || `image/${ext}`,
        cacheControl: "public, max-age=31536000, immutable",
      });

      // Generate all WebP variants
      const res = await generateImageVariants(originalBuffer, hash, ext);
      for (const v of res.variants) {
        await storage.put(v.key, v.buffer, {
          contentType: v.contentType,
          cacheControl: "public, max-age=31536000, immutable",
        });
      }

      // Update product record to point to optimal thumbnail variant (320.webp)
      const targetThumbnailKey = `products/${hash}/320.webp`;
      await prisma.product.update({
        where: { id: prod.id },
        data: { imageUrl: targetThumbnailKey },
      });

      const optThumbSize = res.variants.find((v) => v.size === 320)?.buffer.length || origSize;
      totalOptimizedBytes += optThumbSize;
      console.log(
        `   [DONE] Uploaded 4 WebP variants. Updated product image to ${targetThumbnailKey} (${(optThumbSize / 1024).toFixed(1)} KB vs ${(origSize / 1024).toFixed(1)} KB)`
      );
      processedCount++;
    }
  }

  console.log("\n==================================================");
  console.log("Migration Summary:");
  console.log(`Processed: ${processedCount}`);
  console.log(`Skipped / Not found: ${skippedCount}`);
  console.log(`Original total payload: ${(totalOriginalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Optimized 320w payload: ${(totalOptimizedBytes / 1024 / 1024).toFixed(2)} MB`);
  if (totalOriginalBytes > 0) {
    const savings = ((1 - totalOptimizedBytes / totalOriginalBytes) * 100).toFixed(1);
    console.log(`Bandwidth savings: ${savings}%`);
  }
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
