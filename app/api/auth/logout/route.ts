import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await db.deleteSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "با موفقیت خارج شدید.",
    });

    response.cookies.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));

    return response;
  } catch (err: any) {
    console.error("[Logout Error]", err);
    return NextResponse.json({ success: true });
  }
}
