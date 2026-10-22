const https = require('https');

const routes = [
  { path: '/', expected: 200, host: 'jmdcart.com' },
  { path: '/categories', expected: 200, host: 'jmdcart.com' },
  { path: '/brands', expected: 200, host: 'jmdcart.com' },
  { path: '/wholesale', expected: 200, host: 'jmdcart.com' },
  { path: '/cart', expected: 200, host: 'jmdcart.com' },
  { path: '/checkout', expected: 200, host: 'jmdcart.com' },
  { path: '/faqs', expected: 200, host: 'jmdcart.com' },
  { path: '/about', expected: 200, host: 'jmdcart.com' },
  { path: '/contact', expected: 200, host: 'jmdcart.com' },
  { path: '/serviceability', expected: 200, host: 'jmdcart.com' },
  { path: '/shipping-policy', expected: 200, host: 'jmdcart.com' },
  { path: '/terms', expected: 200, host: 'jmdcart.com' },
  { path: '/privacy', expected: 200, host: 'jmdcart.com' },
  { path: '/sitemap.xml', expected: 200, host: 'jmdcart.com' },
  { path: '/robots.txt', expected: 200, host: 'jmdcart.com' },
  { path: '/api/health', expected: 200, host: 'jmdcart.com' },
  { path: '/api/store/v1/settings', expected: 200, host: 'jmdcart.com' },
  { path: '/admin', expected: 404, host: 'jmdcart.com' },
  { path: '/godown', expected: 404, host: 'jmdcart.com' },
  { path: '/', expected: 307, host: 'management.jmdcart.com' },
];

function checkRoute(route) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: '136.81.89.67',
        port: 443,
        path: route.path,
        method: 'GET',
        headers: { Host: route.host },
        rejectUnauthorized: false,
      },
      (res) => {
        const passed = res.statusCode === route.expected;
        console.log(
          `${passed ? '✓' : '✗'} [${route.host}] ${route.path} -> ${res.statusCode} (expected ${route.expected})`
        );
        resolve(passed);
      }
    );
    req.on('error', (err) => {
      console.log(`✗ [${route.host}] ${route.path} -> Error: ${err.message}`);
      resolve(false);
    });
    req.end();
  });
}

async function run() {
  console.log('Testing live production routes on 136.81.89.67...\n');
  let allPassed = true;
  for (const r of routes) {
    const ok = await checkRoute(r);
    if (!ok) allPassed = false;
  }
  console.log(`\nAll tests passed: ${allPassed ? 'YES' : 'NO'}`);
  process.exit(allPassed ? 0 : 1);
}

run();
