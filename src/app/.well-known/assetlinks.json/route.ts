import { NextResponse } from "next/server";

export async function GET() {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.jmdcart.shop",
        sha256_cert_fingerprints: [
          // Development debug keystore fingerprint
          "14:6D:E9:7F:30:1A:E7:5F:27:00:23:4E:BB:22:96:A8:14:4E:9F:50:52:16:35:E7:DE:B3:AC:12:F6:41:A4:44",
          // Production release keystore fingerprint (to be configured by owner in Play Console)
          "48:E0:16:7D:69:B3:36:1B:54:F6:FE:5E:F6:B5:18:22:94:0A:73:90:54:19:93:33:DE:75:E6:AA:DF:FD:16:4C",
        ],
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
