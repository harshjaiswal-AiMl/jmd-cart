const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6J-ebDTi0YWqFO58UKm-MKB4kvhmT3tknqLkiZuX74fIw';
const PROJECT_ID = '2516034325085804188';

const outDir = path.join(__dirname, '../design/stitch-export/remix');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        headers: {
          'X-Goog-Api-Key': API_KEY,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function run() {
  console.log(`Fetching screens for project ${PROJECT_ID}...`);
  const listUrl = `https://stitch.googleapis.com/v1/projects/${PROJECT_ID}/screens`;
  const listData = await fetchJson(listUrl);
  const screens = listData.screens || [];
  console.log(`Found ${screens.length} screens.`);

  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    const screenId = s.name.split('/').pop();
    const title = s.title || `screen-${i + 1}`;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    console.log(`\nProcessing [${i + 1}/${screens.length}] ${screenId} (${title})...`);

    // Fetch full screen details
    const detailUrl = `https://stitch.googleapis.com/v1/${s.name}`;
    const detail = await fetchJson(detailUrl);

    // Save full JSON metadata
    fs.writeFileSync(
      path.join(outDir, `${i + 1}_${safeTitle}_${screenId}.json`),
      JSON.stringify(detail, null, 2),
      'utf8'
    );

    // Download HTML
    if (detail.htmlCode && detail.htmlCode.downloadUrl) {
      const htmlPath = path.join(outDir, `${i + 1}_${safeTitle}.html`);
      try {
        await downloadFile(detail.htmlCode.downloadUrl, htmlPath);
        console.log(`  ✓ Saved HTML: ${i + 1}_${safeTitle}.html`);
      } catch (err) {
        console.error(`  ✗ Failed to download HTML:`, err.message);
      }
    }

    // Download Screenshot
    if (detail.screenshot && detail.screenshot.downloadUrl) {
      const imgPath = path.join(outDir, `${i + 1}_${safeTitle}.png`);
      try {
        await downloadFile(detail.screenshot.downloadUrl, imgPath);
        console.log(`  ✓ Downloaded screenshot: ${i + 1}_${safeTitle}.png`);
      } catch (err) {
        console.error(`  ✗ Failed to download screenshot:`, err.message);
      }
    }
  }

  console.log('\nAll Stitch screens processed successfully!');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
