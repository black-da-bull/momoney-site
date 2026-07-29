import { NextRequest, NextResponse } from "next/server";

// Dev auth fallback until the Entra ID app registration exists (infra-spec §4).
// If CONSOLE_PASSWORD is unset, the console runs open (localhost dev).
// Every response carries noindex regardless (also set in next.config headers).

export function middleware(req: NextRequest) {
  const user = process.env.CONSOLE_USER || "mo";
  const password = process.env.CONSOLE_PASSWORD;

  if (password) {
    const header = req.headers.get("authorization") || "";
    const expected = "Basic " + btoa(`${user}:${password}`);
    if (header !== expected) {
      return new NextResponse("Console access", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Maestro Console"',
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
