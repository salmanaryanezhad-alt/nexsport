import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveSessionUser } from "@/lib/auth/sessionGuard";
import {
  refreshSignedSessionToken,
  applySessionCookies,
  clearSessionCookies,
  getRequestToken,
  parseSessionToken,
  snapshotFromPayload,
  SESSION_HOURS,
} from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = getRequestToken(req);

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const session = await db.findSession(token);
    if (!session) {
      const parsed = parseSessionToken(token);
      if (parsed) {
        const snap = snapshotFromPayload(parsed);
        const response = NextResponse.json({ user: snap, token });
        applySessionCookies(response, token);
        return response;
      }
      const response = NextResponse.json({ user: null, expired: true });
      clearSessionCookies(response);
      return response;
    }

    const user = await resolveSessionUser(session);
    if (!user) {
      const response = NextResponse.json({
        user: {
          id: session.user_id,
          name: session.user_snapshot?.name || "",
          email: session.user_snapshot?.email || "",
          mobile: session.user_snapshot?.mobile || "",
          is_verified: session.user_snapshot?.is_verified ?? true,
          role: session.user_snapshot?.role || "user",
        },
        token,
      });
      applySessionCookies(response, token);
      return response;
    }

    const refreshed = refreshSignedSessionToken(token, SESSION_HOURS) || token;
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        is_verified: user.is_verified,
        role: user.role,
      },
      token: refreshed,
    });
    applySessionCookies(response, refreshed);
    return response;
  } catch (err: any) {
    console.error("[Me Error]", err);
    return NextResponse.json({ user: null, error: true }, { status: 500 });
  }
}
