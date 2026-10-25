import { NextResponse } from "next/server";

interface GeoResult {
  city: string;
  state: string;
  area: string;
  pincode: string;
  road?: string;
  formattedAddress: string;
  coordinates: { lat: number; lng: number };
  source: string;
}

// 1. Coordinates to Address (BigDataCloud + OpenStreetMap Nominatim)
async function reverseGeocodeCoords(lat: number, lng: number): Promise<GeoResult | null> {
  // Try BigDataCloud first (fastest, free, no rate limiting, accurate for Indian cities & districts)
  try {
    const bdcController = new AbortController();
    const bdcTimer = setTimeout(() => bdcController.abort(), 3500);
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: bdcController.signal, headers: { Accept: "application/json" } }
    );
    clearTimeout(bdcTimer);
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const city = bdcData.city || bdcData.locality || bdcData.principalSubdivision || "";
      const state = bdcData.principalSubdivision || "";
      const locality = bdcData.locality || city;
      const pincode = bdcData.postcode || "";
      if (city || locality) {
        return {
          city,
          state,
          area: locality,
          pincode,
          formattedAddress: [locality, city, state, pincode].filter(Boolean).join(", "),
          coordinates: { lat, lng },
          source: "bdc-gps",
        };
      }
    }
  } catch {
    // Continue to Nominatim
  }

  // Try OpenStreetMap Nominatim
  try {
    const nomController = new AbortController();
    const nomTimer = setTimeout(() => nomController.abort(), 3500);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        signal: nomController.signal,
        headers: {
          "User-Agent": "JMDCart-Storefront/2.0 (web-app)",
          Accept: "application/json",
        },
      }
    );
    clearTimeout(nomTimer);
    if (nomRes.ok) {
      const data = await nomRes.json();
      const address = data?.address || {};
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.state_district ||
        address.county ||
        "";
      const state = address.state || "";
      const area =
        address.suburb ||
        address.neighbourhood ||
        address.residential ||
        address.road ||
        city;
      const pincode = address.postcode || "";
      const road = address.road || "";
      if (city || area) {
        return {
          city: city || area,
          state,
          area,
          pincode,
          road,
          formattedAddress: data.display_name || [area, city, state, pincode].filter(Boolean).join(", "),
          coordinates: { lat, lng },
          source: "nominatim-gps",
        };
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

// 2. IP Address to City & State (ip-api.com -> ipapi.co -> freeipapi.com)
async function getIpLocation(clientIp: string): Promise<GeoResult | null> {
  const isLocalIp =
    !clientIp ||
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp.includes("127.0.0.1") ||
    clientIp.startsWith("192.168.") ||
    clientIp.startsWith("10.") ||
    clientIp.startsWith("172.") ||
    clientIp === "localhost";

  // Provider A: ip-api.com
  try {
    const ipUrl = isLocalIp
      ? "http://ip-api.com/json/?fields=status,country,regionName,city,zip,lat,lon"
      : `http://ip-api.com/json/${clientIp}?fields=status,country,regionName,city,zip,lat,lon`;
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 2500);
    const r1 = await fetch(ipUrl, { signal: c1.signal, headers: { Accept: "application/json" } });
    clearTimeout(t1);
    if (r1.ok) {
      const d1 = await r1.json();
      if (d1.status === "success" && d1.city) {
        return {
          city: d1.city,
          state: d1.regionName || "",
          pincode: d1.zip || "",
          area: d1.city,
          formattedAddress: `${d1.city}, ${d1.regionName || ""} - ${d1.zip || ""}`,
          coordinates: { lat: d1.lat || 0, lng: d1.lon || 0 },
          source: "ip-api",
        };
      }
    }
  } catch {}

  // Provider B: ipapi.co (HTTPS, accurate for India)
  try {
    const ipUrl = isLocalIp
      ? "https://ipapi.co/json/"
      : `https://ipapi.co/${clientIp}/json/`;
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 2500);
    const r2 = await fetch(ipUrl, {
      signal: c2.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JMDCart/2.0)", Accept: "application/json" },
    });
    clearTimeout(t2);
    if (r2.ok) {
      const d2 = await r2.json();
      if (d2.city) {
        return {
          city: d2.city,
          state: d2.region || "",
          pincode: d2.postal || "",
          area: d2.city,
          formattedAddress: `${d2.city}, ${d2.region || ""} - ${d2.postal || ""}`,
          coordinates: { lat: d2.latitude || 0, lng: d2.longitude || 0 },
          source: "ipapi-co",
        };
      }
    }
  } catch {}

  // Provider C: freeipapi.com
  try {
    const ipUrl = isLocalIp
      ? "https://freeipapi.com/api/json"
      : `https://freeipapi.com/api/json/${clientIp}`;
    const c3 = new AbortController();
    const t3 = setTimeout(() => c3.abort(), 2500);
    const r3 = await fetch(ipUrl, { signal: c3.signal, headers: { Accept: "application/json" } });
    clearTimeout(t3);
    if (r3.ok) {
      const d3 = await r3.json();
      if (d3.cityName) {
        return {
          city: d3.cityName,
          state: d3.regionName || "",
          pincode: d3.zipCode || "",
          area: d3.cityName,
          formattedAddress: `${d3.cityName}, ${d3.regionName || ""}`,
          coordinates: { lat: d3.latitude || 0, lng: d3.longitude || 0 },
          source: "freeipapi",
        };
      }
    }
  } catch {}

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const mode = searchParams.get("mode");

    // 1. If GPS coordinates were provided, reverse geocode them
    if (lat && lng && mode !== "ip") {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      if (!isNaN(latitude) && !isNaN(longitude)) {
        const geoResult = await reverseGeocodeCoords(latitude, longitude);
        if (geoResult) {
          return NextResponse.json({
            success: true,
            ...geoResult,
          });
        }
      }
    }

    // 2. IP Geolocation (if mode=ip or coordinates lookup failed)
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "";

    const ipResult = await getIpLocation(clientIp);
    if (ipResult) {
      return NextResponse.json({
        success: true,
        ...ipResult,
      });
    }

    // 3. If all external services fail, return explicit failure (no fake Saharsa fallback!)
    return NextResponse.json({
      success: false,
      error: "Unable to detect location. Please select or enter your address.",
      source: "failed",
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: "Location lookup service error.",
      source: "error",
    });
  }
}
