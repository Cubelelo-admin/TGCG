import { NextResponse, type NextRequest } from "next/server";
import { getSessionInMiddleware } from "@/lib/supabase/middleware-client";

export async function middleware(request: NextRequest) {
  const { response, user } = await getSessionInMiddleware(request);

  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = request.nextUrl.pathname === "/admin/login";

  if (isAdminRoute && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
