import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.json({ error: "نشست منقضی شده است." }, { status: 401 });
    }

    const tournaments = await db.listTournaments(session.user_id);
    return NextResponse.json({ tournaments });
  } catch (err: any) {
    console.error("[List Tournaments Error]", err);
    return NextResponse.json({ error: "خطا در دریافت مسابقات." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("nexsport_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "برای ذخیره ابری مسابقه، ابتدا وارد حساب کاربری خود شوید." }, { status: 401 });
    }

    const session = await db.findSession(token);
    if (!session) {
      return NextResponse.json({ error: "نشست منقضی شده است. مجدداً وارد شوید." }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, format, sport, teamCount, state } = body || {};

    if (!title || !format || !state) {
      return NextResponse.json({ error: "اطلاعات مسابقه ناقص است." }, { status: 400 });
    }

    const saved = await db.saveTournament({
      id: id || undefined,
      userId: session.user_id,
      title: String(title),
      format: String(format),
      sport: sport ? String(sport) : undefined,
      teamCount: Number(teamCount) || 0,
      state,
    });

    return NextResponse.json({
      success: true,
      message: "مسابقه با موفقیت در حساب کاربری شما ذخیره شد.",
      tournament: saved,
    });
  } catch (err: any) {
    console.error("[Save Tournament Error]", err);
    return NextResponse.json({ error: "خطایی در ذخیره مسابقه رخ داد." }, { status: 500 });
  }
}
