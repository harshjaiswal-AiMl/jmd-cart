import fs from "fs";
import path from "path";

const BASE_DIR = path.resolve(process.cwd(), "design/stitch-export/customer-app");

interface ScreenDef {
  id: string;
  title: string;
  htmlContent: string;
}

const screens: ScreenDef[] = [
  {
    id: "splash",
    title: "Splash Screen",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>JMD Cart - Splash</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #7A2433; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #FFF; position: relative; }
    .logo-container { width: 96px; height: 96px; background: #FFF; border-radius: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.2); margin-bottom: 24px; }
    .logo-text { font-family: 'Epilogue', serif; font-size: 52px; font-weight: 800; color: #7A2433; }
    h1 { font-family: 'Epilogue', serif; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
    p { font-size: 13px; color: #FFDADC; margin-top: 6px; letter-spacing: 0.5px; }
    .tagline { position: absolute; bottom: 40px; font-size: 12px; color: #FFB2B9; font-weight: 500; }
  </style>
</head>
<body>
  <div class="logo-container">
    <span class="logo-text">J</span>
  </div>
  <h1>JMD Cart</h1>
  <p>Kirana & Wholesale at Lowest Rates</p>
  <div class="tagline">Made with trust in Bihar • jmdcart.com</div>
</body>
</html>`,
  },
  {
    id: "language-picker",
    title: "Language Selection",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>Choose Language / भाषा चुनें</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #FFF9F1; padding: 24px 20px; display: flex; flex-direction: column; justify-content: space-between; }
    .header { margin-top: 40px; text-align: center; }
    h1 { font-family: 'Epilogue', serif; font-size: 24px; color: #7A2433; margin-bottom: 8px; }
    p { font-size: 14px; color: #554243; }
    .options { display: flex; flex-direction: column; gap: 16px; margin-top: 40px; }
    .card { background: #FFF; border: 2px solid #EAE3DC; border-radius: 16px; padding: 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
    .card.selected { border-color: #7A2433; background: #FFFBFA; }
    .lang-name { font-size: 18px; font-weight: 700; color: #1B1C1C; }
    .lang-sub { font-size: 13px; color: #707070; margin-top: 4px; }
    .check { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #7A2433; display: flex; align-items: center; justify-content: center; background: #7A2433; color: #FFF; font-size: 12px; }
    .btn { background: #7A2433; color: #FFF; font-weight: 600; padding: 16px; border-radius: 12px; text-align: center; font-size: 16px; border: none; cursor: pointer; }
  </style>
</head>
<body>
  <div>
    <div class="header">
      <h1>Select Language</h1>
      <p>अपनी पसंदीदा भाषा चुनें</p>
    </div>
    <div class="options">
      <div class="card selected">
        <div>
          <div class="lang-name">English</div>
          <div class="lang-sub">Use English for app text</div>
        </div>
        <div class="check">✓</div>
      </div>
      <div class="card">
        <div>
          <div class="lang-name">हिन्दी (Hindi)</div>
          <div class="lang-sub">ऐप को हिन्दी में चलाएं</div>
        </div>
      </div>
    </div>
  </div>
  <button class="btn">Continue / आगे बढ़ें</button>
</body>
</html>`,
  },
  {
    id: "home",
    title: "Customer Mobile Home",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>JMD Cart - Home</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #FFF9F1; display: flex; flex-direction: column; overflow: hidden; }
    .top-bar { background: #7A2433; color: #FFF; padding: 16px 16px 12px; }
    .loc-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .loc-title { font-size: 12px; color: #FFDADC; font-weight: 500; }
    .loc-val { font-size: 14px; font-weight: 700; color: #FFF; }
    .search-box { background: #FFF; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; color: #707070; font-size: 13px; }
    .content { flex: 1; overflow-y: auto; padding: 12px 14px 80px; }
    .banner { background: linear-gradient(135deg, #FC9430, #E0720A); border-radius: 14px; padding: 16px; color: #FFF; margin-bottom: 16px; }
    .banner h2 { font-family: 'Epilogue', serif; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .banner p { font-size: 12px; opacity: 0.9; }
    .section-title { font-family: 'Epilogue', serif; font-size: 16px; font-weight: 700; color: #1B1C1C; margin: 16px 0 10px; display: flex; justify-content: space-between; }
    .categories { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; }
    .cat-item { min-width: 70px; display: flex; flex-direction: column; align-items: center; text-align: center; font-size: 11px; font-weight: 600; color: #554243; }
    .cat-circle { width: 56px; height: 56px; border-radius: 50%; background: #FFF; border: 1px solid #EAE3DC; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .p-card { background: #FFF; border: 1px solid #EAE3DC; border-radius: 14px; padding: 10px; position: relative; }
    .p-badge { position: absolute; top: 8px; left: 8px; background: rgba(27,120,55,0.1); color: #1B7837; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
    .p-img { width: 100%; height: 100px; object-fit: contain; background: #FAF7F2; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; font-size: 32px; }
    .p-title { font-size: 13px; font-weight: 600; color: #1B1C1C; line-height: 1.2; margin-bottom: 4px; }
    .p-weight { font-size: 11px; color: #707070; margin-bottom: 8px; }
    .p-price-row { display: flex; align-items: baseline; justify-content: space-between; }
    .p-price { font-size: 15px; font-weight: 700; color: #1B1C1C; }
    .p-mrp { font-size: 11px; text-decoration: line-through; color: #9E9E9E; margin-left: 4px; }
    .add-btn { background: #FFF; border: 1.5px solid #F28C28; color: #F28C28; font-weight: 700; font-size: 12px; padding: 4px 14px; border-radius: 8px; cursor: pointer; }
    .bottom-nav { position: absolute; bottom: 0; left: 0; width: 100%; height: 60px; background: #FFF; border-top: 1px solid #EAE3DC; display: flex; align-items: center; justify-content: space-around; font-size: 10px; font-weight: 600; color: #707070; }
    .nav-item.active { color: #7A2433; }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="loc-row">
      <div>
        <div class="loc-title">Delivering to Saharsa & Patna</div>
        <div class="loc-val">Patna Main Branch • 30 Mins ⚡</div>
      </div>
      <div style="font-size: 20px;">🔔</div>
    </div>
    <div class="search-box">
      <span>🔍</span>
      <span>Search "Mustard Oil", "Atta", "Rice"...</span>
    </div>
  </div>
  <div class="content">
    <div class="banner">
      <h2>Flat ₹50 OFF on 1st App Order</h2>
      <p>Use code JMDFIRST • Free delivery above ₹499</p>
    </div>
    <div class="section-title">
      <span>Top Categories</span>
      <span style="font-size: 12px; color: #7A2433;">View All</span>
    </div>
    <div class="categories">
      <div class="cat-item"><div class="cat-circle">🌾</div>Atta & Flour</div>
      <div class="cat-item"><div class="cat-circle">🍚</div>Rice & Dals</div>
      <div class="cat-item"><div class="cat-circle">🛢️</div>Edible Oils</div>
      <div class="cat-item"><div class="cat-circle">🌶️</div>Masalas</div>
      <div class="cat-item"><div class="cat-circle">🧼</div>Soaps & Clean</div>
    </div>
    <div class="section-title">
      <span>Trending Essentials</span>
    </div>
    <div class="grid">
      <div class="p-card">
        <span class="p-badge">Wholesale B available</span>
        <div class="p-img">🌾</div>
        <div class="p-title">Aashirvaad Shudh Chakki Atta</div>
        <div class="p-weight">10 kg Bag</div>
        <div class="p-price-row">
          <div>
            <span class="p-price">₹395</span>
            <span class="p-mrp">₹440</span>
          </div>
          <button class="add-btn">ADD</button>
        </div>
      </div>
      <div class="p-card">
        <span class="p-badge">Save ₹45</span>
        <div class="p-img">🛢️</div>
        <div class="p-title">Fortune Kachi Ghani Mustard Oil</div>
        <div class="p-weight">1 L Pouch</div>
        <div class="p-price-row">
          <div>
            <span class="p-price">₹142</span>
            <span class="p-mrp">₹165</span>
          </div>
          <button class="add-btn">ADD</button>
        </div>
      </div>
    </div>
  </div>
  <div class="bottom-nav">
    <div class="nav-item active">🏠<br>Home</div>
    <div class="nav-item">📁<br>Categories</div>
    <div class="nav-item">🛒<br>Cart (2)</div>
    <div class="nav-item">📦<br>Orders</div>
    <div class="nav-item">👤<br>Account</div>
  </div>
</body>
</html>`,
  },
  {
    id: "product-detail",
    title: "Product Detail with Wholesale Tier Pricing",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>Product Details</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #FFF9F1; display: flex; flex-direction: column; }
    .header { height: 50px; background: #FFF; border-bottom: 1px solid #EAE3DC; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-weight: 700; color: #1B1C1C; }
    .content { flex: 1; overflow-y: auto; padding: 14px; }
    .img-box { width: 100%; height: 220px; background: #FFF; border-radius: 16px; border: 1px solid #EAE3DC; display: flex; align-items: center; justify-content: center; font-size: 72px; margin-bottom: 16px; }
    h1 { font-family: 'Epilogue', serif; font-size: 18px; color: #1B1C1C; margin-bottom: 4px; }
    .weight { font-size: 13px; color: #707070; margin-bottom: 12px; }
    .price-box { display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px; }
    .cur-price { font-size: 22px; font-weight: 800; color: #7A2433; }
    .mrp { font-size: 14px; text-decoration: line-through; color: #9E9E9E; }
    .discount-pill { background: #E8F5E9; color: #1B7837; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .tier-box { background: #FFF; border: 1.5px dashed #1B7837; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
    .tier-title { font-size: 12px; font-weight: 700; color: #1B7837; margin-bottom: 6px; }
    .tier-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #F0F0F0; }
    .unit-selector { margin-bottom: 16px; }
    .unit-title { font-size: 12px; font-weight: 600; color: #554243; margin-bottom: 8px; }
    .unit-chips { display: flex; gap: 8px; }
    .chip { padding: 8px 14px; border: 1.5px solid #7A2433; background: #FFF; border-radius: 8px; font-size: 12px; font-weight: 700; color: #7A2433; }
    .chip.active { background: #7A2433; color: #FFF; }
    .bottom-bar { background: #FFF; border-top: 1px solid #EAE3DC; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .buy-btn { background: #F28C28; color: #FFF; border: none; font-weight: 700; padding: 12px 24px; border-radius: 10px; font-size: 15px; flex: 1; margin-left: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="header">
    <span>← Back</span>
    <span>Fortune Mustard Oil</span>
    <span>🔗 Share</span>
  </div>
  <div class="content">
    <div class="img-box">🛢️</div>
    <h1>Fortune Kachi Ghani Pure Mustard Oil</h1>
    <div class="weight">Pack Size: 1 Litre Pouch • HSN: 1514</div>
    <div class="price-box">
      <span class="cur-price">₹142</span>
      <span class="mrp">₹165</span>
      <span class="discount-pill">Save ₹23 (14% OFF)</span>
    </div>
    <div class="tier-box">
      <div class="tier-title">💰 Wholesale Bulk Slabs (Kirana / Business)</div>
      <div class="tier-row"><span>Single Pcs (Retail)</span><strong>₹142/pc</strong></div>
      <div class="tier-row"><span>Buy 1 Carton (12 pcs)</span><strong style="color: #1B7837;">₹138/pc (Save ₹48)</strong></div>
      <div class="tier-row" style="border:none;"><span>Wholesaler Tier A</span><strong style="color: #1B7837;">₹135/pc (Save ₹84)</strong></div>
    </div>
    <div class="unit-selector">
      <div class="unit-title">Select Pack Option:</div>
      <div class="unit-chips">
        <div class="chip active">1 Piece (₹142)</div>
        <div class="chip">Carton of 12 (₹1,656)</div>
      </div>
    </div>
    <div style="font-size: 12px; color: #707070; line-height: 1.5;">
      100% pure cold-pressed mustard oil with traditional pungent aroma and natural antioxidants. Essential for North Indian cooking.
    </div>
  </div>
  <div class="bottom-bar">
    <div>
      <div style="font-size: 11px; color: #707070;">Total Price</div>
      <div style="font-size: 18px; font-weight: 800; color: #1B1C1C;">₹142</div>
    </div>
    <button class="buy-btn">Add to Cart</button>
  </div>
</body>
</html>`,
  },
  {
    id: "order-tracking",
    title: "Live Order Tracking & Dispatch Status",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>Order Tracking</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #FFF9F1; display: flex; flex-direction: column; }
    .header { height: 50px; background: #7A2433; color: #FFF; display: flex; align-items: center; padding: 0 16px; font-weight: 700; }
    .content { flex: 1; overflow-y: auto; padding: 16px; }
    .card { background: #FFF; border: 1px solid #EAE3DC; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
    .order-num { font-size: 16px; font-weight: 700; color: #1B1C1C; margin-bottom: 4px; }
    .order-meta { font-size: 12px; color: #707070; }
    .stepper { margin: 16px 0; }
    .step { display: flex; gap: 12px; margin-bottom: 16px; position: relative; }
    .step::before { content: ''; position: absolute; left: 11px; top: 24px; bottom: -12px; width: 2px; background: #E0E0E0; }
    .step:last-child::before { display: none; }
    .step.done::before { background: #1B7837; }
    .dot { width: 24px; height: 24px; border-radius: 50%; background: #E0E0E0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #FFF; font-weight: 700; z-index: 1; }
    .step.done .dot { background: #1B7837; }
    .step.current .dot { background: #FC9430; box-shadow: 0 0 0 4px rgba(252,148,48,0.2); }
    .step-title { font-size: 13px; font-weight: 700; color: #1B1C1C; }
    .step-desc { font-size: 11px; color: #707070; margin-top: 2px; }
    .delivery-box { background: #E8F5E9; border-radius: 12px; padding: 12px; display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
    .call-btn { background: #1B7837; color: #FFF; padding: 8px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header">Order Tracking</div>
  <div class="content">
    <div class="card">
      <div class="order-num">Order #ORD-202611-0082</div>
      <div class="order-meta">Placed on Today, 3:45 PM • 3 Items • ₹1,240 (COD)</div>
      <div class="stepper">
        <div class="step done">
          <div class="dot">✓</div>
          <div>
            <div class="step-title">Order Booked</div>
            <div class="step-desc">Your order was received and logged</div>
          </div>
        </div>
        <div class="step done">
          <div class="dot">✓</div>
          <div>
            <div class="step-title">Order Accepted</div>
            <div class="step-desc">Shop godown confirmed inventory</div>
          </div>
        </div>
        <div class="step done">
          <div class="dot">✓</div>
          <div>
            <div class="step-title">Packing Complete</div>
            <div class="step-desc">Items boxed & sealed with invoice</div>
          </div>
        </div>
        <div class="step current">
          <div class="dot">🚚</div>
          <div>
            <div class="step-title">Out for Delivery</div>
            <div class="step-desc">Delivery partner is on the way</div>
          </div>
        </div>
        <div class="step">
          <div class="dot">📍</div>
          <div>
            <div class="step-title">Delivered</div>
            <div class="step-desc">Expected by 4:30 PM</div>
          </div>
        </div>
      </div>
      <div class="delivery-box">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #1B7837;">Ramesh Kumar</div>
          <div style="font-size: 11px; color: #555;">Delivery Executive • Van #BR-01-9482</div>
        </div>
        <a href="tel:+919876543210" class="call-btn">📞 Call</a>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: "saved-lists",
    title: "Saved Shopping Lists (P0 Kirana Feature)",
    htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=360, height=800, initial-scale=1.0">
  <title>Saved Lists</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { width: 360px; height: 800px; background: #FFF9F1; display: flex; flex-direction: column; }
    .header { height: 50px; background: #7A2433; color: #FFF; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; font-weight: 700; }
    .content { flex: 1; overflow-y: auto; padding: 14px; }
    .card { background: #FFF; border: 1px solid #EAE3DC; border-radius: 14px; padding: 16px; margin-bottom: 12px; }
    .title { font-size: 15px; font-weight: 700; color: #1B1C1C; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #707070; margin-bottom: 12px; }
    .add-all-btn { background: #F28C28; color: #FFF; border: none; font-weight: 700; padding: 10px; border-radius: 8px; width: 100%; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="header">
    <span>My Saved Lists</span>
    <span>+ New List</span>
  </div>
  <div class="content">
    <div class="card">
      <div class="title">📋 Monthly Kirana Household List</div>
      <div class="meta">8 items • Approx ₹3,450</div>
      <button class="add-all-btn">⚡ Add All 8 Items to Cart</button>
    </div>
    <div class="card">
      <div class="title">🏪 Retail Shop Weekly Restock</div>
      <div class="meta">14 items (Cartons) • Approx ₹18,900</div>
      <button class="add-all-btn">⚡ Add All 14 Items to Cart</button>
    </div>
  </div>
</body>
</html>`,
  },
];

function generateScreens() {
  for (const s of screens) {
    const screenDir = path.join(BASE_DIR, s.id);
    fs.mkdirSync(screenDir, { recursive: true });
    const filePath = path.join(screenDir, "screen.html");
    fs.writeFileSync(filePath, s.htmlContent, "utf-8");
    console.log(`[stitch-export] Saved ${s.title} to ${filePath}`);
  }
}

generateScreens();
