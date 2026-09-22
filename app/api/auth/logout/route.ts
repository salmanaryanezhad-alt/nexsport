import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (token) {
      await db.deleteSession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "با موفقیت خارج شدید.",
    });

    response.cookies.set("nexsport_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error("[Logout Error]", err);
    return NextResponse.json({ success: true });
  }
}
