import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getStorage } from "../src/lib/storage";
import { detectImageMimeType } from "../src/lib/storage/image-validation";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

async function main() {
  const isApply = process.argv.includes("--apply");

  console.log("==================================================");
  console.log("       MIGRATE LOCAL UPLOADS TO CLOUDFLARE R2     ");
  console.log(` Mode: ${isApply ? "APPLY (Committing changes)" : "DRY-RUN (Simulating only, use --apply to commit)"}`);
  console.log("==================================================\n");

  const storage = getStorage();

  const products = await prisma.product.findMany({
    where: {
      imageUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      shortCode: true,
      imageUrl: true,
    },
  });

  console.log(`Found ${products.length} products with an image URL.\n`);

  let countAlreadyR2 = 0;
  let countMigrated = 0;
  let countMissing = 0;
  let countExternal = 0;

  for (const product of products) {
    const rawUrl = product.imageUrl!;

    if (rawUrl.startsWith("/media/") || rawUrl.includes("r2.cloudflarestorage.com") || rawUrl.includes("cdn.jmdcart.com")) {
      countAlreadyR2++;
      continue;
    }

    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      countExternal++;
      continue;
    }

    if (rawUrl.startsWith("/uploads/")) {
      const relativePath = rawUrl.replace(/^\//, "");
      const localFilePath = path.join(process.cwd(), "public", relativePath);

      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(localFilePath);
      } catch (err) {
        console.warn(`[MISSING] Product ${product.shortCode} (${product.name}): file not found at ${localFilePath}`);
        countMissing++;
        continue;
      }

      const mime = detectImageMimeType(fileBuffer);
      if (!mime) {
        console.warn(`[INVALID] Product ${product.shortCode} (${product.name}): file at ${localFilePath} is not a valid image format.`);
        countMissing++;
        continue;
      }

      let ext = "jpg";
      if (mime === "image/png") ext = "png";
      else if (mime === "image/webp") ext = "webp";
      else if (mime === "image/gif") ext = "gif";

      const fileHash = crypto.randomBytes(8).toString("hex");
      const key = `products/${product.id}_${fileHash}.${ext}`;
      const newMediaUrl = `/media/${key}`;

      if (isApply) {
        console.log(`[MIGRATING] Uploading ${rawUrl} -> ${key}...`);
        await storage.put(key, fileBuffer, {
          contentType: mime,
          cacheControl: "public, max-age=31536000, immutable",
        });

        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: newMediaUrl },
        });

        console.log(`[UPDATED] Product ${product.shortCode} updated to ${newMediaUrl}`);
      } else {
        console.log(`[DRY-RUN] Would upload ${rawUrl} -> ${key} and update product to ${newMediaUrl}`);
      }

      countMigrated++;
    }
  }

  console.log("\n==================================================");
  console.log("                 SUMMARY REPORT                   ");
  console.log("==================================================");
  console.log(` Total products inspected: ${products.length}`);
  console.log(` Already in R2 (/media/...): ${countAlreadyR2}`);
  console.log(` Local uploads migrated:    ${countMigrated}`);
  console.log(` Local uploads missing:     ${countMissing}`);
  console.log(` External / other URLs:     ${countExternal}`);
  console.log("==================================================");

  if (!isApply && countMigrated > 0) {
    console.log("\nRun with --apply to commit these migrations to Cloudflare R2 and update the database.");
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
