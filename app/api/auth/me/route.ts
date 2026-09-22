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
      return NextResponse.json({ user: null });
    }

    const user = await db.findUserById(session.user_id);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        is_verified: user.is_verified,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[Me Error]", err);
    return NextResponse.json({ user: null });
  }
}
