import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSessionUser } from "@/lib/auth/sessionGuard";
import {
  refreshSignedSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_HOURS,
} from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const session = await db.findSession(token);
    if (!session) {
      const response = NextResponse.json({ user: null, expired: true });
      response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
      return response;
    }

    const user = await resolveSessionUser(session);
    if (!user) {
      const response = NextResponse.json({ user: null, expired: true });
      response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
      return response;
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        is_verified: user.is_verified,
        role: user.role,
      },
    });

    const refreshed = refreshSignedSessionToken(token, SESSION_HOURS) || token;
    response.cookies.set(SESSION_COOKIE_NAME, refreshed, sessionCookieOptions());

    return response;
  } catch (err: any) {
    console.error("[Me Error]", err);
    return NextResponse.json({ user: null, error: true }, { status: 500 });
  }
}
