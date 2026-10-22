const fs = require('fs');
const path = require('path');
const https = require('https');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const dir = path.join(__dirname, '../public/brand/products');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const items = [
  {
    slug: 'fortune-kachi-ghani-pure-mustard-oil',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmgwu_vK3-s7PYKRzTdeC5OukLolQxe654hH1J_xUAtUXecTObLBZgFPPM7-CBnRP8NctvjmgYoKcnf58ov2eUc3D9yVnSNHyeobjPGv4qmUbVwIAoc5F2y7E8lIdZVXVajUL8TUpXFyJsm9q-o3k1SkbxMaE2eu-A99CWRqSybO1NJwpCJi5sUA_2YbU5sYVH0bPT5PXdAvszcXVvuF03BpWAWcrhukxsfcO6P0saC9DIw122khLebQ'
  },
  {
    slug: 'mdh-deggi-mirch-natural-red-pepper-powder',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0K3OtpKRJhFe_Y-P7EVkvhA80ovKCuvnHAT2djaeBkhlaz8PTFBXnf_SlO7Z-YAmft86BVWGF0EZ0pnYSzjRiMOKzDj2t5DqLMd3FHUv1pJI7WTe_FVBMbw1hsFTC8vGQjM_QGSqEeJ3gY3sIriEYEYUxmuahmQmLWGCOESUyUNQysKlIT7VA8A1ZeLLb9G_yclfGPLdTKYVzVg_C6PdfGYorO6_O7DtVa9oOslqjeS9HH2_8TXKPIQ'
  },
  {
    slug: 'aashirvaad-shudh-whole-wheat-chakki-atta',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBLAXM9BfHCCgeOo_g91yTiNa3fPRS4qkn726QLalc7Agdk-7wwnNKDlQnCNssHq2halk7PDPCSgJWAm0MQv_qyP8ZFjDu1k-P4smy3at2eidWXntPrB2dC6qjUJW5zMIozumHjOC4RXq0zv9PgY4nxtlet-tv2YqjFHriolF3lGlFo5lWPtXacZ0GIxUPFhUlevbxN4UDVuE2zpExyUGS3V9edSXkaP-y-EJbu2-Pw7pDkNOqhWQv2cQ'
  },
  {
    slug: 'india-gate-feast-rozzana-basmati-rice',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7DOuRMg9WjZU0pCW1fwpfarhTujvKeflpWK9kGxUSOmEixZP1tPLzNB5H0h0wd8X3tspqYMyA8rekjyNMXFjuCfrRI4FbkGBJlqV7T1c5VkrzJ_KYz_5J5kg1lrUUWsV-_-i31xwBjpSasb5lq8VHDodr0DL_7LbFIWhJn4kyUm3t-BCmMlO6ZPBRNAjnhkP6WYU3k1xziucFAtAHnnobFDwyOxpIYpdQc4J9H6tzIhFlq0wFLyEFhw'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  for (const item of items) {
    const dest = path.join(dir, `${item.slug}.png`);
    console.log(`Downloading ${item.slug}...`);
    try {
      await download(item.url, dest);
      const localPath = `/brand/products/${item.slug}.png`;
      await prisma.product.updateMany({
        where: { slug: item.slug },
        data: { imageUrl: localPath }
      });
      console.log(`  ✓ Saved to ${localPath} and updated DB`);
    } catch (e) {
      console.error(`  ✗ Error downloading ${item.slug}:`, e.message);
    }
  }
  await prisma.$disconnect();
  console.log('Finished downloading PDP images!');
}

run();
