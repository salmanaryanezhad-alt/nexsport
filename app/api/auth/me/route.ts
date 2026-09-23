import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const session = await db.findSession(token);
    if (!session) {
      const response = NextResponse.json({ user: null, expired: true });
      response.cookies.set("nexsport_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const user = await db.findUserById(session.user_id);
    if (!user) {
      const response = NextResponse.json({ user: null, expired: true });
      response.cookies.set("nexsport_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
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

    // Refresh rolling cookie for 48 hours from this activity
    response.cookies.set("nexsport_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 48 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    console.error("[Me Error]", err);
    return NextResponse.json({ user: null });
  }
}
