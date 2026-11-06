export {};

async function main() {
  const res = await fetch("https://jmdcart.com/");
  const html = await res.text();
  console.log("Homepage HTML length:", html.length);
  console.log("Homepage Status:", res.status);
  console.log("Cache-Control:", res.headers.get("cache-control"));
  console.log("Server / CDN:", res.headers.get("server"), res.headers.get("cf-ray"));

  const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
  const imgs: string[] = [];
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    imgs.push(m[1]);
  }

  console.log(`Found ${imgs.length} image src attributes.`);

  // Test content-length of the first 5 images
  for (const imgUrl of imgs.slice(0, 8)) {
    const fullUrl = imgUrl.startsWith("http") ? imgUrl : `https://jmdcart.com${imgUrl}`;
    try {
      const hRes = await fetch(fullUrl, { method: "HEAD" });
      const len = hRes.headers.get("content-length");
      const cType = hRes.headers.get("content-type");
      const cControl = hRes.headers.get("cache-control");
      console.log(`- ${fullUrl.substring(0, 70)}... -> ${(parseInt(len || "0", 10) / 1024).toFixed(1)} KB | ${cType} | Cache: ${cControl}`);
    } catch (err: any) {
      console.log(`- ${fullUrl} -> Error: ${err.message}`);
    }
  }

  // Calculate total payload of all unique images
  const uniqueUrls = [...new Set(imgs.map(u => u.startsWith("http") ? u : `https://jmdcart.com${u}`))];
  console.log(`\nCalculating total bytes for ${uniqueUrls.length} unique images...`);
  let totalBytes = 0;
  for (const u of uniqueUrls) {
    try {
      const hRes = await fetch(u, { method: "HEAD" });
      const len = parseInt(hRes.headers.get("content-length") || "0", 10);
      totalBytes += len;
    } catch {}
  }
  console.log(`TOTAL PAYLOAD OF ALL UNIQUE HOMEPAGE IMAGES: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${(totalBytes / 1024).toFixed(1)} KB)`);

  // Also check product API
  const apiRes = await fetch("https://jmdcart.com/api/store/v1/products?limit=20");
  const apiData = await apiRes.json();
  const products = apiData.products || apiData.items || [];
  console.log(`\nStorefront Products API returned ${products.length} products.`);
  if (products.length > 0) {
    console.log("Sample product imageUrl:", products[0].name, products[0].imageUrl);
  }
}

main().catch(console.error);
