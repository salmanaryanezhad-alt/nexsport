import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const tournamentId = req.nextUrl.searchParams.get("tournamentId");
    if (tournamentId) {
      const following = await db.isFollowingTournament(auth.user.id, tournamentId);
      return NextResponse.json({ following });
    }
    const ids = await db.listFollowedTournaments(auth.user.id);
    return NextResponse.json({ tournamentIds: ids });
  } catch (err) {
    console.error("[Follows GET]", err);
    return NextResponse.json({ error: "خطا در دریافت دنبال‌کردن‌ها." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    const tournamentId = String(body.tournamentId || "").trim();
    if (!tournamentId) return NextResponse.json({ error: "شناسه مسابقه لازم است." }, { status: 400 });
    const t = await db.getPublicTournament(tournamentId);
    if (!t) return NextResponse.json({ error: "مسابقه یافت نشد." }, { status: 404 });
    const paid = Boolean(t.state?.payment?.isPaid) || auth.isAdmin;
    if (!paid) return NextResponse.json({ error: "فقط مسابقات با لینک تماشاگر فعال قابل دنبال‌کردن هستند." }, { status: 400 });
    const res = await db.followTournament(auth.user.id, tournamentId);
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ success: true, following: true });
  } catch (err) {
    console.error("[Follows POST]", err);
    return NextResponse.json({ error: "خطا در دنبال‌کردن مسابقه." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await req.json().catch(() => ({}));
    const tournamentId = String(body.tournamentId || req.nextUrl.searchParams.get("tournamentId") || "").trim();
    if (!tournamentId) return NextResponse.json({ error: "شناسه مسابقه لازم است." }, { status: 400 });
    await db.unfollowTournament(auth.user.id, tournamentId);
    return NextResponse.json({ success: true, following: false });
  } catch (err) {
    console.error("[Follows DELETE]", err);
    return NextResponse.json({ error: "خطا در لغو دنبال‌کردن." }, { status: 500 });
  }
}
