import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeRegistrationInput } from "@/lib/registrations/validate";
import { readRegistrationSettings, registrationPaymentPaid } from "@/lib/registrations/settings";

export const dynamic = "force-dynamic";

async function publicSnapshot(id: string) {
  const tournament = await db.getPublicTournament(id);
  if (!tournament) return { error: "مسابقه یافت نشد.", status: 404 as const };
  const paid = registrationPaymentPaid(tournament.state);
  if (!paid) {
    return {
      error: "لینک ثبت‌نام این مسابقه هنوز فعال نشده است.",
      status: 402 as const,
      notActivated: true,
      tournamentTitle: tournament.title,
    };
  }
  const settings = readRegistrationSettings(tournament.state, tournament.team_count);
  const list = await db.listRegistrations(id);
  const approved = list.filter((r) => r.status === "approved").length;
  const remaining = Math.max(0, settings.capacity - approved);
  return {
    tournament: {
      id: tournament.id,
      title: tournament.title,
      format: tournament.format,
      sport: tournament.sport,
      teamCount: tournament.team_count,
    },
    isOpen: settings.isOpen && remaining > 0,
    isClosed: !settings.isOpen,
    isFull: remaining <= 0,
    capacity: settings.capacity,
    approved,
    remaining,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const snap = await publicSnapshot(id);
    if ("error" in snap && snap.status) {
      return NextResponse.json(
        { error: snap.error, notActivated: (snap as any).notActivated, tournamentTitle: (snap as any).tournamentTitle },
        { status: snap.status }
      );
    }
    return NextResponse.json(snap);
  } catch (err) {
    console.error("[Registration public GET]", err);
    return NextResponse.json({ error: "خطا در دریافت اطلاعات ثبت‌نام." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const snap = await publicSnapshot(id);
    if ("error" in snap && snap.status) {
      return NextResponse.json({ error: snap.error }, { status: snap.status });
    }
    if ((snap as any).isClosed) {
      return NextResponse.json({ error: "ثبت‌نام این مسابقه بسته شده است." }, { status: 403 });
    }
    if ((snap as any).isFull) {
      return NextResponse.json({ error: "ظرفیت مسابقه تکمیل شده است." }, { status: 409 });
    }
    const body = await req.json();
    const parsed = sanitizeRegistrationInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const created = await db.createRegistration(id, {
      team_name: parsed.data.team_name,
      short_name: parsed.data.short_name,
      city: parsed.data.city,
      coach: parsed.data.coach,
      contact_name: parsed.data.contact_name,
      mobile: parsed.data.mobile,
      notes: parsed.data.notes,
      library_team_id: parsed.data.library_team_id,
      roster: parsed.data.players,
    });
    if ("error" in created) return NextResponse.json({ error: created.error }, { status: 409 });
    return NextResponse.json({
      success: true,
      registration: {
        id: created.id,
        team_name: created.team_name,
        status: created.status,
      },
      message: "ثبت‌نام شما ارسال شد و پس از تأیید برگزارکننده نهایی می‌شود.",
    });
  } catch (err) {
    console.error("[Registration public POST]", err);
    return NextResponse.json({ error: "خطا در ثبت درخواست." }, { status: 500 });
  }
}
