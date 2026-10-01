import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizeTeamInput } from "@/lib/teams/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const teams = await db.listTeams(auth.user.id);
    return NextResponse.json({ teams });
  } catch (err) {
    console.error("[Teams GET]", err);
    return NextResponse.json({ error: "خطا در دریافت فهرست تیم‌ها." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const body = await req.json();
    const parsed = sanitizeTeamInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const team = await db.createTeam(auth.user.id, parsed.data);
    return NextResponse.json({ success: true, team });
  } catch (err) {
    console.error("[Teams POST]", err);
    return NextResponse.json({ error: "خطا در ایجاد تیم." }, { status: 500 });
  }
}
