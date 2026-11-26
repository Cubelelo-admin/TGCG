import { NextResponse, type NextRequest } from "next/server";
import { getSessionInMiddleware } from "@/lib/supabase/middleware-client";

// Signed-out visitors go to the login page of the app they asked for: /admin or the
// volunteer app /v. Roles are checked by each page and API route, not here.
const LOGIN_FOR: { prefix: string; login: string }[] = [
  { prefix: "/admin", login: "/admin/login" },
  { prefix: "/v", login: "/v/login" },
];

export async function middleware(request: NextRequest) {
  const { response, user } = await getSessionInMiddleware(request);
  const path = request.nextUrl.pathname;

  const app = LOGIN_FOR.find((a) => path === a.prefix || path.startsWith(`${a.prefix}/`));
  if (app && path !== app.login && !user) {
    const url = request.nextUrl.clone();
    url.pathname = app.login;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/v", "/v/:path*"],
};
