export type VanLanguage = "en" | "hi";

export interface VanTranslationStrings {
  // Top bar & language toggle
  langToggle: string;
  langName: string;
  routeSales: string;
  handheldPortal: string;
  unassignedVan: string;
  saharsaDivision: string;
  loggedInAs: string;
  subHeader: string;
  loadSheet: string;
  startBilling: string;
  openCounter: string;

  // Primary big buttons
  newSaleTitle: string;
  newSaleSubtitle: string;
  myStockTitle: string;
  myStockSubtitle: string;
  endOfDayTitle: string;
  endOfDaySubtitle: string;

  // Metrics
  todaySales: string;
  cashInHand: string;
  availableStock: string;
  deliveries: string;
  pending: string;
  pcs: string;

  // Load status
  activeMorningLoad: string;
  dispatched: string;
  dispatchedMsg: string;
  createBill: string;
  awaitingMorningDispatch: string;
  awaitingDispatchMsg: string;
  godownDispatchLink: string;
  noVanAssigned: string;
  noVanAssignedMsg: string;

  // PWA Mobile App Cards (/app/van)
  vanCounterTitle: string;
  vanCounterDesc: string;
  todaysBillsTitle: string;
  todaysBillsDesc: string;
  cashCollectionsTitle: string;
  cashCollectionsDesc: string;
  dayEndCloseTitle: string;
  dayEndCloseDesc: string;
  morningLoadStatus: string;
  dispatchedSheet: string;
  pendingMorningIssue: string;

  // Bottom Navigation
  navStock: string;
  navNewBill: string;
  navCollect: string;
  navBills: string;
  navDayEnd: string;

  // Stock Matrix
  searchStockPlaceholder: string;
  allProducts: string;
  cartonsUnit: string;
  looseUnit: string;
  totalPieces: string;
  noStockLoaded: string;
  quickNewBill: string;
  viewBills: string;
  stockMatrixTitle: string;

  // Delivery section
  handedOverDeliveries: string;
  markDelivered: string;
  cashToCollect: string;
  completed: string;
  noPendingDeliveries: string;
  pendingCount: string;
  completedCount: string;
  ordersAssigned: string;
  deliveryAddress: string;
  collectCash: string;
  confirmHandover: string;
}

export const VAN_TRANSLATIONS: Record<VanLanguage, VanTranslationStrings> = {
  en: {
    // Top bar & language toggle
    langToggle: "English",
    langName: "EN",
    routeSales: "Route Operations",
    handheldPortal: "Handheld Sales Portal",
    unassignedVan: "Unassigned Van",
    saharsaDivision: "Saharsa Division",
    loggedInAs: "Logged in as",
    subHeader: "Daily route loading, customer deliveries & mobile billing",
    loadSheet: "Load Sheet",
    startBilling: "Start Billing",
    openCounter: "Open Counter",

    // Primary big buttons
    newSaleTitle: "1. 🛒 NEW SALE",
    newSaleSubtitle: "Start 3-Step Field Invoice",
    myStockTitle: "2. 📦 MY STOCK",
    myStockSubtitle: "{pieces} pcs loaded ({products} products)",
    endOfDayTitle: "3. 🏁 END OF DAY",
    endOfDaySubtitle: "Daily Reconciliation & Cash Handover",

    // Metrics
    todaySales: "Today's Sales",
    cashInHand: "Cash In Hand",
    availableStock: "Available Stock",
    deliveries: "Deliveries",
    pending: "PENDING",
    pcs: "pcs",

    // Load status
    activeMorningLoad: "Active Morning Load",
    dispatched: "DISPATCHED",
    dispatchedMsg: "Transferred from Central Godown. Ready for customer billing.",
    createBill: "Create Bill",
    awaitingMorningDispatch: "Awaiting Morning Dispatch",
    awaitingDispatchMsg: "No morning load sheet has been issued for this van yet today. When the Godown team loads stock, it will appear here instantly.",
    godownDispatchLink: "Godown Dispatch →",
    noVanAssigned: "No Van Assigned",
    noVanAssignedMsg: "Your user account is not currently assigned to any delivery vehicle. Please contact the Godown Manager or Super Admin.",

    // PWA Mobile App Cards (/app/van)
    vanCounterTitle: "Van Counter",
    vanCounterDesc: "Issue bills by Peti & Pcs on the road",
    todaysBillsTitle: "Today's Bills",
    todaysBillsDesc: "Reprint bluetooth slip & view list",
    cashCollectionsTitle: "Cash Collections",
    cashCollectionsDesc: "Record money collected vs pending",
    dayEndCloseTitle: "Day-End Close",
    dayEndCloseDesc: "Return unsold stock & submit cash",
    morningLoadStatus: "Morning Load Status:",
    dispatchedSheet: "Dispatched • Sheet #{sheet}",
    pendingMorningIssue: "Pending Morning Issue",

    // Bottom Navigation
    navStock: "Stock",
    navNewBill: "New Bill",
    navCollect: "Collect",
    navBills: "Bills",
    navDayEnd: "Day End",

    // Stock Matrix
    searchStockPlaceholder: "Search loaded items by name or code...",
    allProducts: "All Products",
    cartonsUnit: "Cartons / Peti",
    looseUnit: "Loose Pieces",
    totalPieces: "Total Pieces",
    noStockLoaded: "No stock currently loaded in this vehicle.",
    quickNewBill: "⚡ New Bill",
    viewBills: "📜 Bills",
    stockMatrixTitle: "Van Inventory & Loaded Stock",

    // Delivery section
    handedOverDeliveries: "Handed-Over Deliveries",
    markDelivered: "Mark Delivered",
    cashToCollect: "Cash to Collect",
    completed: "Completed",
    noPendingDeliveries: "No pending deliveries assigned for this route.",
    pendingCount: "Pending",
    completedCount: "Delivered",
    ordersAssigned: "orders assigned to this vehicle",
    deliveryAddress: "Delivery Address",
    collectCash: "Collect Cash",
    confirmHandover: "Confirm Handover & Payment",
  },
  hi: {
    // Top bar & language toggle
    langToggle: "हिंदी",
    langName: "हिं",
    routeSales: "रूट बिक्री (वैन सेल्स)",
    handheldPortal: "मोबाइल सेल्स पोर्टल",
    unassignedVan: "गाड़ी असाइन नहीं है",
    saharsaDivision: "सहरसा डिवीजन",
    loggedInAs: "लॉगिन:",
    subHeader: "दैनिक गाड़ी लोडिंग, कस्टमर डिलीवरी और मोबाइल बिलिंग",
    loadSheet: "लोड शीट",
    startBilling: "बिलिंग शुरू करें",
    openCounter: "काउंटर खोलें",

    // Primary big buttons
    newSaleTitle: "1. 🛒 नया बिल काटें",
    newSaleSubtitle: "रास्ते में तुरंत 3-स्टेप बिल बनाएं",
    myStockTitle: "2. 📦 गाड़ी का स्टॉक",
    myStockSubtitle: "कुल {pieces} पीस लोड ({products} आइटम)",
    endOfDayTitle: "3. 🏁 दिन का हिसाब / क्लोजिंग",
    endOfDaySubtitle: "बचा माल वापसी और नकद जमा",

    // Metrics
    todaySales: "आज की कुल बिक्री",
    cashInHand: "हाथ में नकद (कैश)",
    availableStock: "गाड़ी में उपलब्ध स्टॉक",
    deliveries: "कस्टमर डिलीवरी",
    pending: "बाकी",
    pcs: "पीस",

    // Load status
    activeMorningLoad: "सुबह की गाड़ी लोडिंग",
    dispatched: "गाड़ी लोड है",
    dispatchedMsg: "सेंट्रल गोदाम से माल लोड होकर निकल चुका है। बिलिंग के लिए तैयार।",
    createBill: "बिल बनाएं",
    awaitingMorningDispatch: "सुबह की लोडिंग बाकी है",
    awaitingDispatchMsg: "आज के लिए अभी गाड़ी लोडिंग शीट नहीं बनी है। जैसे ही गोदाम से माल चढ़ेगा, यहाँ दिख जाएगा।",
    godownDispatchLink: "गोदाम डिस्पैच →",
    noVanAssigned: "कोई गाड़ी असाइन नहीं है",
    noVanAssignedMsg: "आपके खाते से कोई वैन लिंक नहीं है। कृपया गोदाम मैनेजर या एडमिन से संपर्क करें।",

    // PWA Mobile App Cards (/app/van)
    vanCounterTitle: "वैन काउंटर",
    vanCounterDesc: "दुकान-दुकान पेटी और पीस का बिल काटें",
    todaysBillsTitle: "आज के बिल",
    todaysBillsDesc: "ब्लूटूथ रसीद प्रिंट करें व लिस्ट देखें",
    cashCollectionsTitle: "कैश कलेक्शन",
    cashCollectionsDesc: "दुकानदारों से वसूली का हिसाब दर्ज करें",
    dayEndCloseTitle: "शाम का क्लोजिंग",
    dayEndCloseDesc: "बचा माल वापस करें व कैश जमा कराएं",
    morningLoadStatus: "सुबह का लोडिंग स्टेटस:",
    dispatchedSheet: "लोड हो चुकी • शीट #{sheet}",
    pendingMorningIssue: "लोडिंग अभी बाकी है",

    // Bottom Navigation
    navStock: "स्टॉक",
    navNewBill: "नया बिल",
    navCollect: "कलेक्शन",
    navBills: "आज के बिल",
    navDayEnd: "हिसाब",

    // Stock Matrix
    searchStockPlaceholder: "सामान का नाम या कोड खोजें...",
    allProducts: "सभी प्रोडक्ट्स",
    cartonsUnit: "पेटी (Cartons)",
    looseUnit: "खुला पीस",
    totalPieces: "कुल पीस",
    noStockLoaded: "गाड़ी में अभी कोई स्टॉक लोड नहीं है।",
    quickNewBill: "⚡ नया बिल",
    viewBills: "📜 आज के बिल",
    stockMatrixTitle: "गाड़ी का लाइव स्टॉक व इन्वेंट्री",

    // Delivery section
    handedOverDeliveries: "गाड़ी में रखी गई डिलीवरी",
    markDelivered: "डिलीवरी पूरी करें",
    cashToCollect: "नकद वसूली",
    completed: "डिलीवर हो चुका",
    noPendingDeliveries: "इस रूट पर अभी कोई पेंडिंग डिलीवरी नहीं है।",
    pendingCount: "बाकी",
    completedCount: "पूरी हुई",
    ordersAssigned: "ऑर्डर इस गाड़ी को दिए गए हैं",
    deliveryAddress: "डिलीवरी का पता",
    collectCash: "कैश प्राप्त करें",
    confirmHandover: "डिलीवरी व भुगतान कन्फर्म करें",
  },
};
