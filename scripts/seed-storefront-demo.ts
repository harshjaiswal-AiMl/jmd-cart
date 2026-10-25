import { PrismaClient, LocationType } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PRODUCTS = [
  {
    name: "Aashirvaad Shudh Whole Wheat Chakki Atta",
    shortCode: "AASH-ATTA-10KG",
    brand: "Aashirvaad",
    category: "Staples & Atta",
    weight: "10kg Bag",
    packSize: 2,
    packLabel: "Bora (2x10kg)",
    mrp: 495,
    priceC: 418,
    priceB: 395,
    priceA: 375,
    hsn: "1101",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDzLyHBxGs0tpq5Gv-H0B_jRjXvylwyxQxaPvYOdwrqoKqTOW1OkKJvmeRTNejj7Hb356b5-xCufJOt_ZmAqqpkTxS8KptwhIlQofymS4dIlltURSX11O4isaIEzlUQsbOCpO_UJz1K3BR-R8YoVDXo0ifp9fIHieuzQd-nobOvtJUgSwYFFbRJGzA9e9T3m3B_MouzV03efWFlm2O97Jto8NnCtXj_y3QPNPL_MWUvzl8NiVxDMmC4ZQ",
  },
  {
    name: "Fortune Kachi Ghani Pure Mustard Oil",
    shortCode: "FORT-OIL-1L",
    brand: "Fortune",
    category: "Oil & Ghee",
    weight: "1L Pouch",
    packSize: 16,
    packLabel: "Carton (16x1L)",
    mrp: 165,
    priceC: 144,
    priceB: 138,
    priceA: 132,
    hsn: "1514",
    gstRateBp: 500,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA30S5rioNxu8csJtCTDao7iYRzvGJjOfW2GLkbKTEk2QU8dCqOWzqUYcRZbUPTs-WmRmJAMMXki27THCLCwts1PxhV4Kk7vfadockSIPKF-aHM_HC2-D63V9QNFyyEyWSecvgd7GRZy7zMyPgozbNYYDQWjRBRejxvWaJzeUyFie1Bgw0D24Znw5ZEBFeGka4Jyr-tP9WHbEGljpzUjyjrkKp4vEo4oNXD8_K3qH-KquHx7W7RemeZzg",
  },
  {
    name: "India Gate Feast Rozzana Basmati Rice",
    shortCode: "IG-BAS-1KG",
    brand: "India Gate",
    category: "Staples & Atta",
    weight: "1kg Pouch",
    packSize: 20,
    packLabel: "Carton (20x1kg)",
    mrp: 145,
    priceC: 118,
    priceB: 110,
    priceA: 102,
    hsn: "1006",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBLAXM9BfHCCgeOo_g91yTiNa3fPRS4qkn726QLalc7Agdk-7wwnNKDlQnCNssHq2halk7PDPCSgJWAm0MQv_qyP8ZFjDu1k-P4smy3at2eidWXntPrB2dC6qjUJW5zMIozumHjOC4RXq0zv9PgY4nxtlet-tv2YqjFHriolF3lGlFo5lWPtXacZ0GIxUPFhUlevbxN4UDVuE2zpExyUGS3V9edSXkaP-y-EJbu2-Pw7pDkNOqhWQv2cQ",
  },
  {
    name: "MDH Deggi Mirch Natural Red Pepper Powder",
    shortCode: "MDH-DMIR-100G",
    brand: "MDH",
    category: "Spices & Masala",
    weight: "100g Box",
    packSize: 180,
    packLabel: "Carton (180x100g)",
    mrp: 98,
    priceC: 82,
    priceB: 76,
    priceA: 70,
    hsn: "0910",
    gstRateBp: 500,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuApbBtRqrS0QrytOtlx6X8kjMDMDyGg3W7SXTJ-nY1BgwvTRIPNqTwl5T7JTUl_-RBL7nM7ke4cby9MzyEvn4PBwAWqvMIFIN2gdmo4LmfTzkp7T3JERAUZuezna2mSUVw0kahsmdPJiDPMAaiqSj0WcYEwRMKYSe_Fe0MtsgO4mns7IrFbRLANYjZWWCDHebuUylVFuJ1uTqvBC3ac8_v5CZtN_TYqMzY_v3QdmeG-4pFiw-jpvDt6FQ",
  },
  {
    name: "Tata Sampann Unpolished High-Protein Toor Dal",
    shortCode: "TATA-TOOR-1KG",
    brand: "Tata Sampann",
    category: "Staples & Atta",
    weight: "1kg Pack",
    packSize: 20,
    packLabel: "Carton (20x1kg)",
    mrp: 185,
    priceC: 152,
    priceB: 145,
    priceA: 138,
    hsn: "0713",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBG9yc3X0acryCWF-DhhIkSpwaJ7bDohVnShlrWFmk2sNR0C1pS39aPtHEeo8m31wMdIA9rNRYoLsw1S-T7f8WQKBqi0sBc_L7w9qiLV7B6eqNZ7_oYxrCd7xmrSH0hFkbyb-Kdo3YWp1gu3hoP3swBeeCrlzoHEDXcvQcoejURyfPEM5TrWvJVrXXYEBiYFnU_9_5D5wQJzN2GOsTzTGdfMRxEfsmFgsBswiJg-QnCuQxx6Lw9tB6aCg",
  },
  {
    name: "Tata Sampann Unpolished Desi Chana Dal",
    shortCode: "TATA-CHANA-1KG",
    brand: "Tata Sampann",
    category: "Staples & Atta",
    weight: "1kg Pack",
    packSize: 20,
    packLabel: "Carton (20x1kg)",
    mrp: 135,
    priceC: 112,
    priceB: 105,
    priceA: 98,
    hsn: "0713",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBG9yc3X0acryCWF-DhhIkSpwaJ7bDohVnShlrWFmk2sNR0C1pS39aPtHEeo8m31wMdIA9rNRYoLsw1S-T7f8WQKBqi0sBc_L7w9qiLV7B6eqNZ7_oYxrCd7xmrSH0hFkbyb-Kdo3YWp1gu3hoP3swBeeCrlzoHEDXcvQcoejURyfPEM5TrWvJVrXXYEBiYFnU_9_5D5wQJzN2GOsTzTGdfMRxEfsmFgsBswiJg-QnCuQxx6Lw9tB6aCg",
  },
  {
    name: "Fortune Sharbati Desi Wheat Superior Atta",
    shortCode: "FORT-SHAR-5KG",
    brand: "Fortune",
    category: "Staples & Atta",
    weight: "5kg Bag",
    packSize: 4,
    packLabel: "Bora (4x5kg)",
    mrp: 290,
    priceC: 248,
    priceB: 235,
    priceA: 220,
    hsn: "1101",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBn0oF4X9Ec_650bB9GysuYk3jVu8lBHzkobCxHg8Rt0o4447x3J8drsJ5ATMDNgTmD1ViTFZQGCis-WhzzSM_9-3V77ood-NEwjlDqWTOUKTs9Y8LqAxSPHHSezefCNl54DuRksng0P_1anb8CpZfEnAz34HE6jVrXRs7WQMwPfLkTySHqNqCm5AzBIz7-gmCOyOQDgkgza_vfhIvtWlYBQTZFTKeJxU94XeQWnM2-P-ZCyU9sFX09Q",
  },
  {
    name: "Special Kosi Katarni Chawal (Aromatic Grain Bora)",
    shortCode: "KOSI-KATA-25KG",
    brand: "India Gate",
    category: "Staples & Atta",
    weight: "25kg Sack",
    packSize: 1,
    packLabel: "Bora (25kg)",
    mrp: 3800,
    priceC: 3400,
    priceB: 3200,
    priceA: 3000,
    hsn: "1006",
    gstRateBp: 0,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBLAXM9BfHCCgeOo_g91yTiNa3fPRS4qkn726QLalc7Agdk-7wwnNKDlQnCNssHq2halk7PDPCSgJWAm0MQv_qyP8ZFjDu1k-P4smy3at2eidWXntPrB2dC6qjUJW5zMIozumHjOC4RXq0zv9PgY4nxtlet-tv2YqjFHriolF3lGlFo5lWPtXacZ0GIxUPFhUlevbxN4UDVuE2zpExyUGS3V9edSXkaP-y-EJbu2-Pw7pDkNOqhWQv2cQ",
  },
  {
    name: "Bikaji Bikaneri Bhujia Pouch",
    shortCode: "BIK-BHUJ-1KG",
    brand: "Bikaji",
    category: "Biscuits & Snacks",
    weight: "1kg Pack",
    packSize: 10,
    packLabel: "Carton (10x1kg)",
    mrp: 310,
    priceC: 260,
    priceB: 245,
    priceA: 230,
    hsn: "2106",
    gstRateBp: 1200,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB2k-ZpQWOjgPr4_8KHThHRJ-RcurFbv_82yF-C0naJRNT4lTDTUW_aYqP3PxGWaEVM6h_Ecf5li8b4tb5XWpidlG33tgAHaae61GOj5A7d0BWHDJ_pbq2FsIf22i-FIPf2rxK9F3kRM2-3eO6TOeCe8dTSlH79XTAB5839xhPgf5yfgQE2i2i-EGzGczWMqb1GX5yZEqfGt1EUON3KZttR8CoIIcgdaK_RKu-KxLTEJMwEWFGOMp_ZWw",
  },
  {
    name: "Tata Tea Gold Blend",
    shortCode: "TATA-TEA-500G",
    brand: "Tata Sampann",
    category: "Beverages",
    weight: "500g Pack",
    packSize: 20,
    packLabel: "Carton (20x500g)",
    mrp: 540,
    priceC: 485,
    priceB: 460,
    priceA: 435,
    hsn: "0902",
    gstRateBp: 500,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCfISN3PrMpM_O_13OeSfIj8W2wwfUsrMbhfbgiYZ-w0c0_kLQQvX8BUVRXYPkOsGVmMGNwYyNbYwMzawMkR3-3hezcx8b-3oJI0KivWqcPIK7j0xoYSrTx2MpQdhcNaye-mRBrUKcIDC86tu-x04yPVqYqnvZS49HMsGYeR1saPcNpIqoZe6sMzPJ3jNEmtAD-02sk3_4a9GFT-z9w-NFcm5dsFnvdcsXmnpZqbZfcccRrvyWEbqPEYg",
  },
  {
    name: "MDH Garam Masala Authentic Spice Blend",
    shortCode: "MDH-GMAS-100G",
    brand: "MDH",
    category: "Spices & Masala",
    weight: "100g Box",
    packSize: 180,
    packLabel: "Carton (180x100g)",
    mrp: 118,
    priceC: 78,
    priceB: 74,
    priceA: 70,
    hsn: "0910",
    gstRateBp: 500,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuApbBtRqrS0QrytOtlx6X8kjMDMDyGg3W7SXTJ-nY1BgwvTRIPNqTwl5T7JTUl_-RBL7nM7ke4cby9MzyEvn4PBwAWqvMIFIN2gdmo4LmfTzkp7T3JERAUZuezna2mSUVw0kahsmdPJiDPMAaiqSj0WcYEwRMKYSe_Fe0MtsgO4mns7IrFbRLANYjZWWCDHebuUylVFuJ1uTqvBC3ac8_v5CZtN_TYqMzY_v3QdmeG-4pFiw-jpvDt6FQ",
  },
  {
    name: "Saloni Pure Kachi Ghani Mustard Oil Tin",
    shortCode: "SAL-TIN-15L",
    brand: "Saloni",
    category: "Oil & Ghee",
    weight: "15L Tin",
    packSize: 1,
    packLabel: "Tin (15L)",
    mrp: 2250,
    priceC: 2040,
    priceB: 1950,
    priceA: 1880,
    hsn: "1514",
    gstRateBp: 500,
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA30S5rioNxu8csJtCTDao7iYRzvGJjOfW2GLkbKTEk2QU8dCqOWzqUYcRZbUPTs-WmRmJAMMXki27THCLCwts1PxhV4Kk7vfadockSIPKF-aHM_HC2-D63V9QNFyyEyWSecvgd7GRZy7zMyPgozbNYYDQWjRBRejxvWaJzeUyFie1Bgw0D24Znw5ZEBFeGka4Jyr-tP9WHbEGljpzUjyjrkKp4vEo4oNXD8_K3qH-KquHx7W7RemeZzg",
  },
];

async function main() {
  console.log("Starting JMD Cart Storefront Demo Seeder...");

  // 1. Ensure Main Godown location
  const godown = await prisma.location.upsert({
    where: { id: "loc-godown-main" },
    update: {},
    create: {
      id: "loc-godown-main",
      name: "Main Godown",
      type: LocationType.GODOWN,
    },
  });

  // 2. Upsert categories & companies
  for (const item of DEMO_PRODUCTS) {
    const comp = await prisma.company.upsert({
      where: { name: item.brand },
      update: {},
      create: { name: item.brand },
    });

    const cat = await prisma.category.upsert({
      where: { name: item.category },
      update: {},
      create: { name: item.category },
    });

    const product = await prisma.product.upsert({
      where: { shortCode: item.shortCode },
      update: {
        name: item.name,
        companyId: comp.id,
        categoryId: cat.id,
        weight: item.weight,
        packSize: item.packSize,
        packLabel: item.packLabel,
        mrpPaise: item.mrp * 100,
        priceCPaise: item.priceC * 100,
        priceBPaise: item.priceB * 100,
        priceAPaise: item.priceA * 100,
        hsn: item.hsn,
        gstRateBp: item.gstRateBp,
        imageUrl: item.imageUrl,
        active: true,
      },
      create: {
        shortCode: item.shortCode,
        name: item.name,
        companyId: comp.id,
        categoryId: cat.id,
        weight: item.weight,
        packSize: item.packSize,
        packLabel: item.packLabel,
        mrpPaise: item.mrp * 100,
        priceCPaise: item.priceC * 100,
        priceBPaise: item.priceB * 100,
        priceAPaise: item.priceA * 100,
        hsn: item.hsn,
        gstRateBp: item.gstRateBp,
        imageUrl: item.imageUrl,
        active: true,
      },
    });

    // Ensure stock balance in godown
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: godown.id,
        },
      },
      update: {
        qty: 150 * item.packSize, // In stock
      },
      create: {
        productId: product.id,
        locationId: godown.id,
        qty: 150 * item.packSize,
      },
    });
  }

  console.log(`✓ Seeded ${DEMO_PRODUCTS.length} storefront items with stock & images!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
