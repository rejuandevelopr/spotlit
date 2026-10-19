import { NextResponse, type NextRequest } from "next/server";

// Cheap edge check: no session cookie means sign in first. Server layouts verify the cookie.
export function middleware(req: NextRequest) {
  if (!req.cookies.get("__session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
