import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireClubEditor } from "@/lib/clubs/access";
import { sanitizeCoachInput } from "@/lib/clubs/validate";

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
    const parsed = sanitizeCoachInput(await req.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const coach = await db.addClubCoach(id, parsed.data);
    return NextResponse.json({ success: true, coach });
  } catch (err) {
    console.error("[Club coaches POST]", err);
    return NextResponse.json({ error: "خطا در ثبت مربی." }, { status: 500 });
  }
}

export async function PATCH(
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
    const coachId = String(body.id || "").trim();
    if (!coachId) return NextResponse.json({ error: "مربی مشخص نشده است." }, { status: 400 });
    const parsed = sanitizeCoachInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const coach = await db.updateClubCoach(coachId, parsed.data);
    if (!coach || coach.club_id !== id) return NextResponse.json({ error: "مربی یافت نشد." }, { status: 404 });
    return NextResponse.json({ success: true, coach });
  } catch (err) {
    console.error("[Club coaches PATCH]", err);
    return NextResponse.json({ error: "خطا در ویرایش مربی." }, { status: 500 });
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
    const coachId = String(req.nextUrl.searchParams.get("id") || "").trim();
    if (!coachId) return NextResponse.json({ error: "مربی مشخص نشده است." }, { status: 400 });
    await db.deleteClubCoach(coachId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Club coaches DELETE]", err);
    return NextResponse.json({ error: "خطا در حذف مربی." }, { status: 500 });
  }
}
