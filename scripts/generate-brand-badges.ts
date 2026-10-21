import fs from 'fs';
import path from 'path';

const brandDir = 'd:/JMD CART/public/brand';
if (!fs.existsSync(brandDir)) {
  fs.mkdirSync(brandDir, { recursive: true });
}

// Remove old dummy placeholder directory if it exists
const mdhOldDir = path.join(brandDir, 'mdh');
if (fs.existsSync(mdhOldDir)) {
  fs.rmSync(mdhOldDir, { recursive: true, force: true });
  console.log('Removed old dummy placeholder directory: public/brand/mdh');
}

// Brand Visual Styling config
const BRANDS_CONFIG: Record<string, { bg: string; accent: string; text: string; subtitle: string; icon: string }> = {
  mdh: { bg: '#8B0000', accent: '#FFD700', text: '#FFFFFF', subtitle: 'Asli Masale Sach Sach', icon: '🌶️' },
  bikaji: { bg: '#D97706', accent: '#FEF3C7', text: '#FFFFFF', subtitle: 'Amitji Ki Pasand', icon: '🥨' },
  testo: { bg: '#B91C1C', accent: '#FEF2F2', text: '#FFFFFF', subtitle: 'Sauces & Pickles', icon: '🥫' },
  dawat: { bg: '#065F46', accent: '#D1FAE5', text: '#FFFFFF', subtitle: 'The Heritage Basmati Rice', icon: '🌾' },
  saloni: { bg: '#B45309', accent: '#FEF9C3', text: '#FFFFFF', subtitle: 'Pure Kacchi Ghani Mustard Oil', icon: '🛢️' },
  'nature-fresh': { bg: '#047857', accent: '#ECFDF5', text: '#FFFFFF', subtitle: 'Chakki Fresh & Pure Oils', icon: '🌱' },
  'namaste-india': { bg: '#1E40AF', accent: '#DBEAFE', text: '#FFFFFF', subtitle: 'Pure Desi Ghee & Dairy', icon: '🥛' },
  patanjali: { bg: '#EA580C', accent: '#FFF7ED', text: '#FFFFFF', subtitle: 'Prakriti Ka Aashirwad', icon: '🌿' },
  'patanjali-aastha': { bg: '#9A3412', accent: '#FFEDD5', text: '#FFFFFF', subtitle: 'Pooja Samagri & Agarbatti', icon: '🪔' },
  'city-gold': { bg: '#15803D', accent: '#DCFCE7', text: '#FFFFFF', subtitle: 'Premium Assam & Dooars Tea', icon: '🍵' },
  denver: { bg: '#18181B', accent: '#F4F4F5', text: '#FFFFFF', subtitle: 'For The Real Men', icon: '✨' },
  'sundrop': { bg: '#EAB308', accent: '#713F12', text: '#713F12', subtitle: 'The Healthy Oil & Popcorn', icon: '🍿' },
  'vi-john': { bg: '#BE123C', accent: '#FFE4E6', text: '#FFFFFF', subtitle: 'Grooming & Skin Care', icon: '🪒' },
  nisha: { bg: '#9333EA', accent: '#F3E8FF', text: '#FFFFFF', subtitle: 'Hair Color & Beauty', icon: '💇' },
  nilons: { bg: '#166534', accent: '#DCFCE7', text: '#FFFFFF', subtitle: 'Achaar & Masale', icon: '🥒' },
  himalaya: { bg: '#0F766E', accent: '#CCFBF1', text: '#FFFFFF', subtitle: 'Since 1930 Herbal Wellness', icon: '🍃' },
  eveready: { bg: '#DC2626', accent: '#FEF2F2', text: '#FFFFFF', subtitle: 'Give Me Red - Batteries & Lights', icon: '🔋' },
  lizzat: { bg: '#CA8A04', accent: '#FEF08A', text: '#FFFFFF', subtitle: 'Shri Mahila Griha Udyog Lijjat', icon: '🫓' },
  uttam: { bg: '#2563EB', accent: '#EFF6FF', text: '#FFFFFF', subtitle: 'Sulphurless Pure Sugar', icon: '🍬' },
  'ds-group': { bg: '#475569', accent: '#F8FAFC', text: '#FFFFFF', subtitle: 'Quality Products', icon: '🍬' },
  aashirvad: { bg: '#B91C1C', accent: '#FEF2F2', text: '#FFFFFF', subtitle: 'ITC Shuddhata Ka Vaada', icon: '🧂' },
  hamdard: { bg: '#991B1B', accent: '#FEE2E2', text: '#FFFFFF', subtitle: 'Sharbat Rooh Afza', icon: '🍷' },
  regency: { bg: '#78350F', accent: '#FEF3C7', text: '#FFFFFF', subtitle: 'Premium Dry Fruits', icon: '🥜' },
  swastik: { bg: '#C2410C', accent: '#FFEDD5', text: '#FFFFFF', subtitle: 'Healthy Grains & Daliya', icon: '🥣' },
  gokul: { bg: '#A16207', accent: '#FEF9C3', text: '#FFFFFF', subtitle: 'Pure Traditional Spices', icon: '🍛' },
  crystal: { bg: '#0284C7', accent: '#E0F2FE', text: '#FFFFFF', subtitle: 'Food Containers & Disposables', icon: '📦' },
  default: { bg: '#790E11', accent: '#FDAF18', text: '#FFFFFF', subtitle: 'JMD Cart Genuine Quality', icon: '🛒' }
};

export function getBrandSlug(brand: string): string {
  const clean = brand.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (clean.includes('mdh')) return 'mdh';
  if (clean.includes('bikaji')) return 'bikaji';
  if (clean.includes('testo')) return 'testo';
  if (clean.includes('dawat') || clean.includes('daawat')) return 'dawat';
  if (clean.includes('saloni')) return 'saloni';
  if (clean.includes('nature-fresh')) return 'nature-fresh';
  if (clean.includes('namaste')) return 'namaste-india';
  if (clean.includes('aastha')) return 'patanjali-aastha';
  if (clean.includes('patanjali')) return 'patanjali';
  if (clean.includes('city-gold')) return 'city-gold';
  if (clean.includes('denver') || clean.includes('denever')) return 'denver';
  if (clean.includes('sundrop')) return 'sundrop';
  if (clean.includes('vi-john') || clean.includes('vijohn')) return 'vi-john';
  if (clean.includes('nisha')) return 'nisha';
  if (clean.includes('nilon')) return 'nilons';
  if (clean.includes('himalaya')) return 'himalaya';
  if (clean.includes('eveready')) return 'eveready';
  if (clean.includes('lizzat') || clean.includes('lijjat')) return 'lizzat';
  if (clean.includes('uttam')) return 'uttam';
  if (clean.includes('ds')) return 'ds-group';
  if (clean.includes('aashirvad') || clean.includes('ashirvad')) return 'aashirvad';
  if (clean.includes('hamdard') || clean.includes('rooh')) return 'hamdard';
  if (clean.includes('regency')) return 'regency';
  if (clean.includes('swastik')) return 'swastik';
  if (clean.includes('gokul')) return 'gokul';
  if (clean.includes('crystal')) return 'crystal';
  return 'default';
}

function generateSvg(slug: string, displayName: string): string {
  const conf = BRANDS_CONFIG[slug] || BRANDS_CONFIG.default;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${conf.bg}" />
      <stop offset="100%" stop-color="${conf.bg}" stop-opacity="0.9" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="400" height="400" rx="24" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>
  <rect x="20" y="20" width="360" height="360" rx="18" fill="url(#bgGrad)" />
  
  <!-- Decorative Ring -->
  <circle cx="200" cy="160" r="80" fill="#FFFFFF" fill-opacity="0.12" />
  <circle cx="200" cy="160" r="64" fill="#FFFFFF" fill-opacity="0.18" />
  
  <!-- Icon Emoji -->
  <text x="200" y="175" font-size="52" text-anchor="middle" dominant-baseline="middle">${conf.icon}</text>
  
  <!-- Brand Display Name -->
  <text x="200" y="270" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="28" fill="${conf.text}" text-anchor="middle" letter-spacing="1">
    ${displayName.toUpperCase()}
  </text>
  
  <!-- Subtitle Tagline -->
  <text x="200" y="305" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="14" fill="${conf.accent}" text-anchor="middle" letter-spacing="0.5">
    ${conf.subtitle}
  </text>
  
  <!-- Trust Badge -->
  <rect x="110" y="330" width="180" height="24" rx="12" fill="#FFFFFF" fill-opacity="0.2" />
  <text x="200" y="346" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="10" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.8">
    100% GENUINE • JMD CART
  </text>
</svg>`;
}

export function generateAllBrandBadges() {
  for (const [slug, conf] of Object.entries(BRANDS_CONFIG)) {
    const displayName = slug.replace(/-/g, ' ').toUpperCase();
    const svgContent = generateSvg(slug, displayName);
    const filePath = path.join(brandDir, `${slug}.svg`);
    fs.writeFileSync(filePath, svgContent, 'utf8');
  }
  console.log(`Generated ${Object.keys(BRANDS_CONFIG).length} clean brand visual SVGs in public/brand/`);
}

if (require.main === module) {
  generateAllBrandBadges();
}
