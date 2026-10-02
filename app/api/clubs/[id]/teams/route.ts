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
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({}));
    const teamId = String(body.teamId || "").trim();
    if (!teamId) return NextResponse.json({ error: "تیم انتخاب نشده است." }, { status: 400 });
    const team = await db.getTeam(teamId);
    if (!team) return NextResponse.json({ error: "تیم یافت نشد." }, { status: 404 });
    if (team.user_id !== auth.user.id && !auth.isAdmin) {
      return NextResponse.json({ error: "فقط تیم‌های کتابخانه خودتان را می‌توانید به باشگاه وصل کنید." }, { status: 403 });
    }
    const attached = await db.attachClubTeam(id, teamId);
    if ("error" in attached) return NextResponse.json({ error: attached.error }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club teams POST]", err);
    return NextResponse.json({ error: "خطا در اتصال تیم." }, { status: 500 });
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
    const teamId = String(req.nextUrl.searchParams.get("teamId") || "").trim();
    if (!teamId) return NextResponse.json({ error: "تیم مشخص نشده است." }, { status: 400 });
    await db.detachClubTeam(id, teamId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club teams DELETE]", err);
    return NextResponse.json({ error: "خطا در جدا کردن تیم." }, { status: 500 });
  }
}
