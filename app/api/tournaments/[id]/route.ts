import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.json({ error: "نشست منقضی شده است." }, { status: 401 });
    }

    const tournament = await db.getTournament(id, session.user_id);
    if (!tournament) {
      return NextResponse.json({ error: "مسابقه یافت نشد." }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (err: any) {
    console.error("[Get Tournament Error]", err);
    return NextResponse.json({ error: "خطا در بارگذاری مسابقه." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;

    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.json({ error: "نشست منقضی شده است." }, { status: 401 });
    }

    const deleted = await db.deleteTournament(id, session.user_id);
    if (!deleted) {
      return NextResponse.json({ error: "مسابقه یافت نشد یا حذف نشد." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "مسابقه با موفقیت حذف گردید." });
  } catch (err: any) {
    console.error("[Delete Tournament Error]", err);
    return NextResponse.json({ error: "خطا در حذف مسابقه." }, { status: 500 });
  }
}
