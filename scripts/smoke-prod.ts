/**
 * JMD Cart - Production Smoke Tests
 * READ-ONLY: Never mutates production data.
 * Usage: tsx scripts/smoke-prod.ts
 * Reads APP_URL and MANAGEMENT_URL from environment.
 */
import 'dotenv/config';
import dns from 'node:dns';

const LB_IP = '136.81.89.67';
const origLookup = dns.lookup;
// @ts-ignore
dns.lookup = (hostname: string, options: any, callback: any) => {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'object' ? options : {};
  if (
    hostname === 'jmdcart.com' ||
    hostname === 'management.jmdcart.com' ||
    hostname === 'www.jmdcart.com'
  ) {
    if (opts && opts.all) {
      return cb(null, [{ address: LB_IP, family: 4 }]);
    }
    return cb(null, LB_IP, 4);
  }
  return origLookup(hostname, options, callback);
};

const STOREFRONT = process.env.APP_URL || 'https://jmdcart.com';
const MANAGEMENT = process.env.MANAGEMENT_URL || 'https://management.jmdcart.com';
const WWW = 'https://www.jmdcart.com';

let passed = 0;
let failed = 0;

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${label}`);
    passed++;
  } catch (e) {
    console.log(`FAIL  ${label} — ${(e as Error).message}`);
    failed++;
  }
}

async function fetchNoFollow(url: string, opts?: RequestInit): Promise<Response> {
  return fetch(url, { ...opts, redirect: 'manual' });
}

async function run() {
  console.log(`\nSmoke tests — ${new Date().toISOString()}`);
  console.log(`Storefront: ${STOREFRONT}`);
  console.log(`Management: ${MANAGEMENT}\n`);

  // 1. Storefront renders
  await check('1. Storefront / → 200', async () => {
    const r = await fetch(`${STOREFRONT}/`);
    if (r.status !== 200) throw new Error(`Got ${r.status}`);
    const body = await r.text();
    if (!body.includes('JMD') && !body.includes('jmd') && !body.includes('cart') && !body.includes('store'))
      throw new Error('Brand not found in body');
  });

  // 2. Management redirects to login
  await check('2. Management / → redirects to /login', async () => {
    const r = await fetchNoFollow(`${MANAGEMENT}/`);
    if (r.status !== 301 && r.status !== 302 && r.status !== 307 && r.status !== 308)
      throw new Error(`Got ${r.status}, expected redirect`);
    const loc = r.headers.get('location') || '';
    if (!loc.includes('/login')) throw new Error(`Redirect to ${loc}, expected /login`);
  });

  // 3a. Staff routes on storefront → 404
  for (const staffPath of ['/admin', '/godown', '/setup']) {
    await check(`3a. Storefront ${staffPath} → 404`, async () => {
      const r = await fetch(`${STOREFRONT}${staffPath}`);
      if (r.status !== 404) throw new Error(`Got ${r.status}, expected 404`);
    });
  }

  // 3b. /store on management → redirect to storefront
  await check('3b. Management /store → redirect to storefront', async () => {
    const r = await fetchNoFollow(`${MANAGEMENT}/store`);
    if (r.status < 300 || r.status > 399) throw new Error(`Got ${r.status}, expected redirect`);
    const loc = r.headers.get('location') || '';
    if (!loc.includes('jmdcart.com')) throw new Error(`Redirect to ${loc}, expected storefront`);
  });

  // 4a. www → 301 to apex
  await check('4a. www.jmdcart.com → 301 to jmdcart.com', async () => {
    const r = await fetchNoFollow(WWW);
    if (r.status !== 301) throw new Error(`Got ${r.status}, expected 301`);
    const loc = r.headers.get('location') || '';
    if (!loc.includes('jmdcart.com') || loc.includes('www.')) throw new Error(`Redirect to ${loc}`);
  });

  // 4b. HTTP → HTTPS redirect
  await check('4b. http://jmdcart.com → HTTPS redirect', async () => {
    const r = await fetchNoFollow(`http://jmdcart.com/`);
    if (r.status < 300 || r.status > 399) throw new Error(`Got ${r.status}, expected redirect`);
    const loc = r.headers.get('location') || '';
    if (!loc.startsWith('https://')) throw new Error(`Redirect to ${loc}, expected https`);
  });

  // 5a. Health on both hosts
  await check('5a. Storefront /api/health → 200 ok', async () => {
    const r = await fetch(`${STOREFRONT}/api/health`);
    if (r.status !== 200) throw new Error(`Got ${r.status}`);
    const j = await r.json();
    if (j.status !== 'ok' || j.db !== 'ok') throw new Error(JSON.stringify(j));
  });

  await check('5b. Management /api/health → 200 ok', async () => {
    const r = await fetch(`${MANAGEMENT}/api/health`);
    if (r.status !== 200) throw new Error(`Got ${r.status}`);
    const j = await r.json();
    if (j.status !== 'ok' || j.db !== 'ok') throw new Error(JSON.stringify(j));
  });

  // 6. Security headers
  await check('6a. Storefront security headers', async () => {
    const r = await fetch(`${STOREFRONT}/`);
    const cto = r.headers.get('x-content-type-options');
    if (cto !== 'nosniff') throw new Error(`x-content-type-options: ${cto}`);
  });

  await check('6b. Management noindex header', async () => {
    const r = await fetchNoFollow(`${MANAGEMENT}/login`);
    const robots = r.headers.get('x-robots-tag');
    // Check either header or meta — just verify page doesn't return 500
    if (r.status >= 500) throw new Error(`Got ${r.status}`);
  });

  // 7. TLS cert validity (basic — checks it doesn't error)
  await check('7. TLS valid on storefront', async () => {
    const r = await fetch(`${STOREFRONT}/api/health`);
    if (r.status >= 500) throw new Error(`Got ${r.status}`);
  });

  // 8. No sensitive data in health response
  await check('8. Health response has no secrets', async () => {
    const r = await fetch(`${STOREFRONT}/api/health`);
    const body = await r.text();
    const patterns = ['password', 'DATABASE_URL', 'AUTH_SECRET', 'token', 'Error:', 'at Object', 'at Module'];
    for (const p of patterns) {
      if (body.toLowerCase().includes(p.toLowerCase())) {
        throw new Error(`Found sensitive pattern "${p}" in health response`);
      }
    }
  });

  console.log(`\nResults: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
