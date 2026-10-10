import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("message", "logged_out");

  const response = NextResponse.redirect(loginUrl);

  // Expire and clear all auth session tokens immediately
  for (const cookie of allCookies) {
    if (cookie.name.includes("auth") || cookie.name.includes("session")) {
      response.cookies.delete(cookie.name);
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }

  return response;
}
