# Google Play Console Store Listing & Data Safety Answers

## 1. App Identity
- **App Name:** JMD Cart - Online Kirana & Wholesale
- **Package Name (Application ID):** `com.jmdcart.shop`
- **Default Language:** English (India) - en-IN
- **Secondary Language:** Hindi (India) - hi-IN
- **Target SDK:** API 34 (Android 14) — Complies with Google Play policy
- **Minimum SDK:** API 26 (Android 8.0 Oreo)
- **App Category:** Shopping (Food & Drink / Grocery)

---

## 2. Store Listing Text

### English (en-IN)
- **Title (30 chars max):** JMD Cart: Kirana & Wholesale
- **Short Description (80 chars max):** Buy fresh groceries, daily essentials & wholesale kirana at the lowest rates!
- **Full Description:**
> Welcome to JMD Cart — Bihar's trusted hyper-local grocery and wholesale procurement app.
> 
> Whether you are ordering daily groceries for your household or restocking bulk cartons and bags for your retail kirana shop, JMD Cart delivers direct from godown to your doorstep in 30 minutes!
> 
> ### Why Shop on JMD Cart?
> - **Lowest Wholesale Rates:** Unlock Tier B and Tier A volume discounts directly from verified manufacturers and distributors.
> - **Wide Selection:** Atta, Basmati Rice, Mustard Oil, Refined Oil, Pulses, Spices, Cleaning Essentials, Packaged Foods & Confectionery.
> - **Bilingual Experience:** Seamlessly switch between English and हिन्दी with a single tap.
> - **Flexible Pack Sizes:** Purchase in single retail units, dozen packs, or full master cartons and sacks.
> - **Multiple Payment Options:** Cash on Delivery (COD), Doorstep UPI Scanner, and Khata / Store Credit for verified retail merchants.
> - **Live Order Tracking:** Transparent stage-by-stage tracking (Booked → Accepted → Packing → Out for Delivery → Delivered) with direct driver calling.
> - **Instant Saved Lists:** Reorder your monthly household kirana list with one tap.
> - **GST Invoices:** Official tax invoices for all business purchases.
> 
> Download JMD Cart today and experience transparent, dependable grocery shopping!

---

### Hindi (hi-IN)
- **शीर्षक (Title):** JMD Cart: किराना व थोक बाजार
- **संक्षिप्त विवरण (Short Description):** सबसे कम दामों पर ताज़ा किराना, दैनिक घरेलू सामान एवं थोक बोरी ऑर्डर करें!
- **पूर्ण विवरण (Full Description):**
> जेएमडी कार्ट (JMD Cart) में आपका स्वागत है — बिहार का विश्वसनीय हाइपर-लोकल किराना एवं थोक खरीदारी ऐप।
> 
> चाहे आपको अपने घर के लिए राशन मंगाना हो या अपनी खुदरा दुकान के लिए थोक में पूरा कार्टन या बोरी उठानी हो, जेएमडी कार्ट सीधे गोदाम से आपके दरवाजे तक सिर्फ 30 मिनट में डिलीवरी पहुंचाता है!
> 
> ### जेएमडी कार्ट की खासियतें:
> - **सबसे कम थोक भाव:** सीधे डिस्ट्रीब्यूटर रेट पर टियर बी एवं टियर ए की थोक छूट का लाभ उठाएं।
> - **विशाल वेराइटी:** आटा, बासमती चावल, शुद्ध सरसों तेल, रिफाइंड तेल, दालें, मसाले, साबुन, सर्फ एवं पैकेट बंद खाद्य उत्पाद।
> - **द्विभाषी ऐप:** अपनी सुविधा अनुसार एक क्लिक में हिन्दी या अंग्रेजी चुनें।
> - **लचीले पैक ऑप्शंस:** सिंगल पीस, दर्जन पैक या पूरे कार्टन एवं बोरी में खरीदारी करें।
> - **आसान भुगतान विकल्प:** कैश ऑन डिलीवरी (COD), दरवाजे पर UPI स्कैनर, और पंजीकृत व्यापारियों के लिए खाता/क्रेडिट सुविधा।
> - **लाइव ऑर्डर ट्रैकिंग:** ऑर्डर बुक होने से लेकर डिलीवरी तक हर कदम की लाइव ट्रैकिंग एवं डिलीवरी पार्टनर से सीधा संपर्क।
> - **मासिक खरीदारी सूची (Saved Lists):** हर महीने की आवश्यक घरेलू किराना लिस्ट बनाएं और एक क्लिक में सभी सामान कार्ट में जोड़ें।
> - **पक्का जीएसटी बिल:** प्रत्येक ऑर्डर पर प्रमाणित टैक्स इनवॉइस।
> 
> आज ही जेएमडी कार्ट डाउनलोड करें और बचत का अनुभव लें!

---

## 3. Google Play Data Safety Questionnaire Answers
Google Play requires developers to complete the Data Safety declaration:

1. **Does your app collect or share any user data?**
   - **Yes** (Only minimal data necessary for core shopping and delivery functionality).
2. **Is all user data encrypted in transit?**
   - **Yes** (All API communication occurs over TLS/HTTPS).
3. **Do you provide a way for users to request that their data be deleted?**
   - **Yes** (Both within the app via Account → Delete Account, and on the web at `https://jmdcart.com/delete-account`).
4. **Data Types Collected:**
   - **Personal Info:**
     - Name (App functionality, Account management)
     - Phone Number (Account authentication via OTP, order delivery contact)
   - **Financial Info:**
     - Purchase history & order amounts (App functionality, legal tax invoicing)
   - **Device or other IDs:**
     - FCM Device Token (App functionality — push notifications for order delivery updates and stock alerts)
5. **Data Sharing with Third Parties:**
   - **No.** JMD Cart does **NOT** sell, rent, or share customer data with third-party advertising networks, data brokers, or trackers. Zero third-party analytics or ad SDKs are installed in the app.

---

## 4. Content Rating Questionnaire
- Violence / Sexual content / Drugs / Gambling: **No**
- User interaction: **Users can place orders and contact customer care**
- Content Rating Result: **Everyone (PEGI 3 / USK 0 / ESRB Everyone)**

---

## 5. Web Compliance URLs
- **Privacy Policy:** `https://jmdcart.com/privacy`
- **Account Deletion Request:** `https://jmdcart.com/delete-account`
- **Terms of Service:** `https://jmdcart.com/terms`
- **Direct APK Download:** `https://jmdcart.com/app`
