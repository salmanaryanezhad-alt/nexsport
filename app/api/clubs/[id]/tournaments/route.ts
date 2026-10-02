import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireClubEditor } from "@/lib/clubs/access";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const tournamentId = String(body.tournamentId || "").trim();
    if (!tournamentId) return NextResponse.json({ error: "مسابقه انتخاب نشده است." }, { status: 400 });
    const t = await db.getTournament(tournamentId, auth.user.id);
    if (!t && !auth.isAdmin) {
      return NextResponse.json({ error: "فقط مسابقات خودتان را می‌توانید به باشگاه وصل کنید." }, { status: 403 });
    }
    if (!t && auth.isAdmin) {
      const any = await db.getPublicTournament(tournamentId);
      if (!any) return NextResponse.json({ error: "مسابقه یافت نشد." }, { status: 404 });
    }
    const attached = await db.attachClubTournament(id, tournamentId);
    if ("error" in attached) return NextResponse.json({ error: attached.error }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club tournaments POST]", err);
    return NextResponse.json({ error: "خطا در اتصال مسابقه." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireClubEditor(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const tournamentId = String(req.nextUrl.searchParams.get("tournamentId") || "").trim();
    if (!tournamentId) return NextResponse.json({ error: "مسابقه مشخص نشده است." }, { status: 400 });
    await db.detachClubTournament(id, tournamentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club tournaments DELETE]", err);
    return NextResponse.json({ error: "خطا در جدا کردن مسابقه." }, { status: 500 });
  }
}
