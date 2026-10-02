import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizeClubInput } from "@/lib/clubs/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if (!("user" in auth) || !auth.user) {
      return NextResponse.json({ error: (auth as any).error, expired: (auth as any).expired }, { status: (auth as any).status || 401 });
    }
    const [clubs, invites] = await Promise.all([
      db.listClubsForUser(auth.user.id),
      db.listClubInvites(auth.user.id),
    ]);
    return NextResponse.json({
      clubs: clubs.map(serializeClub),
      invites: invites.map(serializeClub),
    });
  } catch (err) {
    console.error("[Clubs GET]", err);
    return NextResponse.json({ error: "خطا در دریافت باشگاه‌ها." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if (!("user" in auth) || !auth.user) {
      return NextResponse.json({ error: (auth as any).error, expired: (auth as any).expired }, { status: (auth as any).status || 401 });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = sanitizeClubInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const club = await db.createClub(auth.user.id, parsed.data);
    return NextResponse.json({ success: true, club: serializeClub(club) });
  } catch (err) {
    console.error("[Clubs POST]", err);
    return NextResponse.json({ error: "خطا در ایجاد باشگاه." }, { status: 500 });
  }
}

function serializeClub(c: any) {
  return {
    id: c.id,
    owner_id: c.owner_id,
    name: c.name,
    short_name: c.short_name,
    sport: c.sport,
    city: c.city,
    founded_year: c.founded_year,
    venue: c.venue,
    description: c.description,
    contact_name: c.contact_name,
    mobile: c.mobile,
    my_role: c.my_role,
    my_status: c.my_status,
    createdAt: c.created_at instanceof Date ? c.created_at.toISOString() : c.created_at,
    updatedAt: c.updated_at instanceof Date ? c.updated_at.toISOString() : c.updated_at,
  };
}
