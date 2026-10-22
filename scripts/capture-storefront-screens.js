const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../design/live-screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const pagesToCapture = [
  { url: 'http://localhost:3000/', name: '1_home' },
  { url: 'http://localhost:3000/categories', name: '2_categories' },
  { url: 'http://localhost:3000/wholesale', name: '3_wholesale' },
  { url: 'http://localhost:3000/cart', name: '4_cart' },
  { url: 'http://localhost:3000/checkout', name: '5_checkout' },
  { url: 'http://localhost:3000/product/fortune-kachi-ghani-pure-mustard-oil', name: '6_pdp_mustard_oil' },
  { url: 'http://localhost:3000/product/mdh-deggi-mirch-natural-red-pepper-powder', name: '7_pdp_mdh_mirch' },
  { url: 'http://localhost:3000/product/aashirvaad-shudh-whole-wheat-chakki-atta', name: '8_pdp_aashirvaad_atta' },
  { url: 'http://localhost:3000/product/india-gate-feast-rozzana-basmati-rice', name: '9_pdp_basmati_rice' },
];

async function capture() {
  console.log('Launching browser to capture live screenshots...');
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const item of pagesToCapture) {
    console.log(`Capturing ${item.name} from ${item.url}...`);
    try {
      if (item.name === '4_cart' || item.name === '5_checkout') {
        const guestCart = [
          { productId: 'cmvij15q1000312838zeicxd5', qty: 2 },
          { productId: 'cmvij15ri00071283jocdx7bv', qty: 4 },
          { productId: 'cmvij15rx000f1283lw52twqm', qty: 3 },
        ];
        await context.addCookies([
          {
            name: 'jmd_guest_cart',
            value: encodeURIComponent(JSON.stringify(guestCart)),
            domain: 'localhost',
            path: '/',
          },
        ]);
      }
      await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
      const outPath = path.join(outDir, `${item.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  ✓ Saved ${item.name}.png`);
    } catch (err) {
      console.error(`  ✗ Error capturing ${item.name}:`, err.message);
    }
  }

  await browser.close();
  console.log('\nAll screenshots captured in design/live-screenshots/!');
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
