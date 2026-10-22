import fs from 'fs';
import path from 'path';

function findIcons(dir, ext) {
  let icons = new Set();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry.name)) {
        findIcons(full, ext).forEach((i) => icons.add(i));
      }
    } else if (ext.some((e) => entry.name.endsWith(e))) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/material-symbols-outlined[^>]*>([a-z0-9_]+)<\//g);
      for (const m of matches) {
        icons.add(m[1].trim());
      }
    }
  }
  return icons;
}

const icons1 = findIcons('design/stitch-export/ecommerce', ['.html', '.js']);
const icons2 = findIcons('src', ['.tsx', '.ts']);

// Common ecommerce UI icons
const commonUi = [
  'search', 'shopping_cart', 'person', 'favorite', 'favorite_border', 'menu', 'close',
  'expand_more', 'chevron_right', 'chevron_left', 'arrow_forward', 'arrow_back',
  'check', 'check_circle', 'add', 'remove', 'delete', 'star', 'star_half',
  'verified', 'local_shipping', 'inventory', 'storefront', 'category', 'home',
  'phone', 'call', 'mail', 'location_on', 'pin_drop', 'share', 'badge',
  'credit_card', 'account_balance', 'lock', 'help', 'info', 'warning', 'error',
  'notifications', 'filter_list', 'sort', 'tune', 'refresh', 'percent', 'savings',
  'eco', 'bolt', 'schedule', 'receipt_long', 'support_agent', 'whatsapp'
];

const allIcons = Array.from(new Set([...icons1, ...icons2, ...commonUi])).filter(Boolean).sort();
console.log(`Total unique icons (${allIcons.length}):`, allIcons.join(' '));

// Material Symbols glyph ligature subset text
const textParam = encodeURIComponent(allIcons.join(' '));
const cssUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&text=${textParam}`;

async function main() {
  console.log('Fetching Google Fonts CSS...');
  const res = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const css = await res.text();
  const fontUrlMatch = css.match(/src:\s*url\((https:[^)]+)\)\s*format\(['"]woff2['"]\)/);
  if (!fontUrlMatch) {
    console.error('Could not find woff2 url in CSS:', css);
    process.exit(1);
  }

  const fontUrl = fontUrlMatch[1];
  console.log('Downloading subsetted woff2 from:', fontUrl);
  const fontRes = await fetch(fontUrl);
  const buffer = Buffer.from(await fontRes.arrayBuffer());

  fs.mkdirSync('public/fonts', { recursive: true });
  fs.writeFileSync('public/fonts/material-symbols-outlined.woff2', buffer);
  console.log(`Downloaded subset font: ${buffer.length} bytes (${Math.round(buffer.length / 1024)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
