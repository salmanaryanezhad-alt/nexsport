import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookies, getRequestToken } from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = getRequestToken(req);
    if (token) {
      await db.deleteSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "با موفقیت خارج شدید.",
    });
    clearSessionCookies(response);
    return response;
  } catch (err: any) {
    console.error("[Logout Error]", err);
    const response = NextResponse.json({ success: true });
    clearSessionCookies(response);
    return response;
  }
}
