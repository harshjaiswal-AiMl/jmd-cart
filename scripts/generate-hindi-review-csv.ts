import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/idms?schema=public";
}

const DOMAIN_GLOSSARY: Record<string, string> = {
  oil: "तेल",
  mustard: "सरसों",
  refined: "रिफाइंड",
  soyabean: "सोयाबीन",
  sunflower: "सूरजमुखी",
  ghee: "घी",
  atta: "आटा",
  maida: "मैदा",
  suji: "सूजी",
  besan: "बेसन",
  rice: "चावल",
  basmati: "बासमती",
  dal: "दाल",
  moong: "मूंग",
  masoor: "मसूर",
  chana: "चना",
  arhar: "अरहर",
  toor: "तूर",
  urad: "उड़द",
  sugar: "चीनी",
  salt: "नमक",
  haldi: "हल्दी",
  turmeric: "हल्दी",
  mirch: "मिर्च",
  chilli: "मिर्च",
  dhaniya: "धनिया",
  jeera: "जीरा",
  garam: "गरम",
  masala: "मसाला",
  spices: "मसाले",
  tea: "चाय",
  coffee: "कॉफी",
  milk: "दूध",
  soap: "साबुन",
  detergent: "सर्फ",
  powder: "पाउडर",
  biscuit: "बिस्कुट",
  biscuits: "बिस्कुट",
  namkeen: "नमकीन",
  bhujia: "भुजिया",
  noodles: "नूडल्स",
  pasta: "पास्ता",
  sauce: "सॉस",
  jam: "जैम",
  honey: "शहद",
  pouch: "पाउच",
  pack: "पैक",
  packet: "पैकेट",
  box: "बॉक्स",
  jar: "जार",
  bottle: "बोतल",
  tin: "टिन",
  patti: "पत्ती",
  gold: "गोल्ड",
  special: "स्पेशल",
  kirana: "किराना",
  store: "स्टोर",
  stores: "स्टोर्स",
  mart: "मार्ट",
  traders: "ट्रेडर्स",
  trading: "ट्रेडिंग",
  enterprise: "एंटरप्राइज",
  enterprises: "एंटरप्राइजेज",
  general: "जनरल",
  provision: "प्रोविजन",
  bhandar: "भंडार",
  agency: "एजेंसी",
  agencies: "एजेंसीज",
  brothers: "ब्रदर्स",
  sons: "सन्स",
  distributor: "डिस्ट्रीब्यूटर",
  wholesale: "होलसेल",
  super: "सुपर",
  market: "मार्केट",
  bazar: "बाजार",
  bazaar: "बाजार",
  kumar: "कुमार",
  sharma: "शर्मा",
  gupta: "गुप्ता",
  singh: "सिंह",
  verma: "वर्मा",
  yadav: "यादव",
  saharsa: "सहरसा",
  bikaji: "बीकाजी",
  fortune: "फॉर्च्यून",
  aashirvaad: "आशीर्वाद",
  tata: "टाटा",
  mdh: "एमडीएच",
  everest: "एवरेस्ट",
  saloni: "सलोनी",
  dawat: "दावत",
  daawat: "दावत",
  parle: "पार्ले",
  britannia: "ब्रिटानिया",
  amul: "अमूल",
  maggi: "मैगी",
  surf: "सर्फ",
  excel: "एक्सेल",
  lux: "लक्स",
  lifebuoy: "लाइफबॉय",
  colgate: "कोलगेट",
  rin: "रिन",
  vim: "विम",
  wheel: "व्हील",
  patanjali: "पतंजलि",
  haldiram: "हल्दीराम",
};

const DIGRAPH_MAP: Array<[string, string]> = [
  ["sh", "श"],
  ["chh", "छ"],
  ["ch", "च"],
  ["kh", "ख"],
  ["gh", "घ"],
  ["th", "थ"],
  ["dh", "ध"],
  ["bh", "भ"],
  ["ph", "फ"],
  ["jh", "झ"],
  ["ng", "ंग"],
  ["oo", "ू"],
  ["ee", "ी"],
  ["aa", "ा"],
  ["ai", "ै"],
  ["au", "ौ"],
];

const CHAR_MAP: Record<string, string> = {
  a: "अ", b: "ब", c: "क", d: "द", e: "ए", f: "फ", g: "ग", h: "ह",
  i: "इ", j: "ज", k: "क", l: "ल", m: "म", n: "न", o: "ओ", p: "प",
  q: "क", r: "र", s: "स", t: "त", u: "उ", v: "व", w: "व", x: "क्स",
  y: "य", z: "ज़",
};

const MATRA: Record<string, string> = {
  aa: "ा", a: "", i: "ि", ee: "ी", u: "ु", oo: "ू", e: "े", ai: "ै", o: "ो", au: "ौ",
};

function transliterateWord(word: string): string {
  const lower = word.toLowerCase();
  if (DOMAIN_GLOSSARY[lower]) return DOMAIN_GLOSSARY[lower];

  // Preserve numeric weights/measurements like 1kg, 500g, 200ml, 1L, Rs10
  if (/^\d+(?:[a-zA-Z]+)?$/.test(word)) {
    return word
      .replace(/kg$/i, " किग्रा")
      .replace(/gm?$/i, " ग्राम")
      .replace(/ml$/i, " मिली")
      .replace(/ltr?$/i, " लीटर");
  }

  let out = "";
  let i = 0;
  let lastWasConsonant = false;

  while (i < lower.length) {
    const ch = lower[i];
    if (!/[a-z]/.test(ch)) {
      out += word[i];
      lastWasConsonant = false;
      i++;
      continue;
    }

    const tri = lower.slice(i, i + 3);
    const bi = lower.slice(i, i + 2);
    let matched = false;

    for (const [pat, dev] of DIGRAPH_MAP) {
      if ((pat.length === 3 && tri === pat) || (pat.length === 2 && bi === pat)) {
        if (pat in MATRA && lastWasConsonant) {
          out += MATRA[pat];
          lastWasConsonant = false;
        } else {
          out += dev;
          lastWasConsonant = !("ाीूैौ".includes(dev));
        }
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (ch in MATRA && lastWasConsonant) {
      out += MATRA[ch];
      lastWasConsonant = false;
    } else if (CHAR_MAP[ch]) {
      out += CHAR_MAP[ch];
      lastWasConsonant = !("aeiou".includes(ch));
    } else {
      out += word[i];
      lastWasConsonant = false;
    }
    i++;
  }

  return out;
}

export function generateEverydayHindiName(englishName: string): string {
  return englishName
    .trim()
    .split(/\s+/)
    .map(transliterateWord)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function csvEscape(v: string | null | undefined): string {
  const s = v ?? "";
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const products = await prisma.$queryRawUnsafe<
    Array<{ id: string; shortCode: string; name: string; nameHi?: string | null; nameHiSource?: string | null }>
  >(
    `SELECT id, short_code AS "shortCode", name FROM products WHERE active = true ORDER BY name ASC`
  );
  const parties = await prisma.$queryRawUnsafe<
    Array<{ id: string; phone: string | null; name: string; nameHi?: string | null; nameHiSource?: string | null }>
  >(
    `SELECT id, phone, name FROM parties WHERE active = true ORDER BY name ASC`
  );

  // Check if name_hi column already exists cleanly without emitting SQL error logs
  const cols = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'name_hi' AND table_name IN ('products', 'parties')`
  );
  const migratedTables = new Set(cols.map((c) => c.table_name));
  if (migratedTables.has("products")) {
    const pHi = await prisma.$queryRawUnsafe<Array<{ id: string; name_hi: string | null; name_hi_source: string | null }>>(
      `SELECT id, name_hi, name_hi_source FROM products WHERE active = true AND name_hi IS NOT NULL`
    );
    const pMap = new Map(pHi.map((r) => [r.id, r]));
    for (const p of products) {
      const hit = pMap.get(p.id);
      if (hit) {
        p.nameHi = hit.name_hi;
        p.nameHiSource = hit.name_hi_source;
      }
    }
  }
  if (migratedTables.has("parties")) {
    const ptHi = await prisma.$queryRawUnsafe<Array<{ id: string; name_hi: string | null; name_hi_source: string | null }>>(
      `SELECT id, name_hi, name_hi_source FROM parties WHERE active = true AND name_hi IS NOT NULL`
    );
    const ptMap = new Map(ptHi.map((r) => [r.id, r]));
    for (const pt of parties) {
      const hit = ptMap.get(pt.id);
      if (hit) {
        pt.nameHi = hit.name_hi;
        pt.nameHiSource = hit.name_hi_source;
      }
    }
  }

  const lines: string[] = ["entity_type,id,short_code_or_phone,name,name_hi,source"];
  let existingProducts = 0;
  let draftProducts = 0;
  let existingParties = 0;
  let draftParties = 0;

  for (const p of products) {
    const hi = p.nameHi?.trim() || generateEverydayHindiName(p.name);
    const src = p.nameHi?.trim() ? (p.nameHiSource || "MANUAL") : "AUTO_DRAFT";
    if (p.nameHi?.trim()) existingProducts++;
    else draftProducts++;
    lines.push(
      ["product", p.id, p.shortCode, p.name, hi, src].map(csvEscape).join(",")
    );
  }

  for (const pt of parties) {
    const hi = pt.nameHi?.trim() || generateEverydayHindiName(pt.name);
    const src = pt.nameHi?.trim() ? (pt.nameHiSource || "MANUAL") : "AUTO_DRAFT";
    if (pt.nameHi?.trim()) existingParties++;
    else draftParties++;
    lines.push(
      ["party", pt.id, pt.phone || "", pt.name, hi, src].map(csvEscape).join(",")
    );
  }

  const outPath = path.resolve(process.cwd(), "artifacts/hindi-names-review.csv");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "\uFEFF" + lines.join("\n") + "\n", "utf8");

  console.log(
    JSON.stringify({
      outPath,
      totalProducts: products.length,
      existingProducts,
      draftProducts,
      totalParties: parties.length,
      existingParties,
      draftParties,
    })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
