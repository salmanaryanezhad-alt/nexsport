import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeClubInput } from "@/lib/clubs/validate";
import { clubPublicSnapshot } from "@/lib/clubs/snapshot";
import { optionalClubAuth, requireClubEditor } from "@/lib/clubs/access";
import { canEditClub, clubRoleLabel } from "@/lib/clubs/roles";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const snap = await clubPublicSnapshot(id);
    if (!snap) return NextResponse.json({ error: "باشگاه یافت نشد." }, { status: 404 });
    const { user, isAdmin } = await optionalClubAuth(req);
    const membership = user ? await db.getClubMembership(id, user.id) : null;
    const canEdit = canEditClub(membership?.role, isAdmin) && membership?.status !== "pending";
    const insider = Boolean(isAdmin || (membership && membership.status === "active"));
    const pagePaid = Boolean(snap.club.pagePaid);
    const showFull = insider || pagePaid;
    const teaser = {
      club: {
        id: snap.club.id,
        name: snap.club.name,
        short_name: snap.club.short_name,
        sport: snap.club.sport,
        city: snap.club.city,
        founded_year: snap.club.founded_year,
        venue: snap.club.venue,
        pagePaid: false,
      },
      teams: [],
      players: [],
      coaches: [],
      tournaments: [],
      locked: true,
      pagePaid: false,
      canEdit,
      myRole: membership?.status === "active" ? membership.role : null,
      myStatus: membership?.status || null,
      roleLabel: membership?.role ? clubRoleLabel(membership.role) : null,
    };
    if (!showFull) return NextResponse.json(teaser);
    return NextResponse.json({
      ...snap,
      locked: false,
      pagePaid,
      myRole: membership?.status === "active" ? membership.role : null,
      myStatus: membership?.status || null,
      canEdit,
      roleLabel: membership?.role ? clubRoleLabel(membership.role) : null,
    });
  } catch (err) {
    console.error("[Club GET]", err);
    return NextResponse.json({ error: "خطا در دریافت باشگاه." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const parsed = sanitizeClubInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const club = await db.updateClub(id, parsed.data);
    return NextResponse.json({ success: true, club });
  } catch (err) {
    console.error("[Club PATCH]", err);
    return NextResponse.json({ error: "خطا در ذخیره باشگاه." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    if (!auth.isAdmin && auth.club.owner_id !== auth.user.id) {
      return NextResponse.json({ error: "فقط مالک باشگاه می‌تواند آن را حذف کند." }, { status: 403 });
    }
    await db.deleteClub(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club DELETE]", err);
    return NextResponse.json({ error: "خطا در حذف باشگاه." }, { status: 500 });
  }
}
