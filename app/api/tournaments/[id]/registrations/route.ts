import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { readRegistrationSettings, registrationPaymentPaid, withRegistrationPaid } from "@/lib/registrations/settings";

export const dynamic = "force-dynamic";

async function requireOwner(req: NextRequest, tournamentId: string) {
  const auth = await verifySessionRequest(req);
  if (!("user" in auth) || !auth.user) {
    return { ok: false as const, error: (auth as any).error || "ابتدا وارد حساب کاربری شوید.", status: (auth as any).status || 401, expired: (auth as any).expired };
  }
  const tournament = await db.getTournament(tournamentId, auth.user.id);
  if (!tournament) {
    if (auth.isAdmin) {
      const any = await db.getPublicTournament(tournamentId);
      if (any) return { ok: true as const, user: auth.user, isAdmin: true, tournament: any };
    }
    return { ok: false as const, error: "مسابقه یافت نشد.", status: 404 as const };
  }
  return { ok: true as const, user: auth.user, isAdmin: auth.isAdmin, tournament };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireOwner(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const settings = readRegistrationSettings(auth.tournament.state, auth.tournament.team_count);
    const registrations = await db.listRegistrations(id);
    const approved = registrations.filter((r) => r.status === "approved").length;
    return NextResponse.json({
      isPaid: registrationPaymentPaid(auth.tournament.state),
      settings,
      approved,
      remaining: Math.max(0, settings.capacity - approved),
      registrations,
      tournament: {
        id: auth.tournament.id,
        title: auth.tournament.title,
        teamCount: auth.tournament.team_count,
      },
    });
  } catch (err) {
    console.error("[Registrations GET]", err);
    return NextResponse.json({ error: "خطا در دریافت ثبت‌نام‌ها." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await requireOwner(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    if (!registrationPaymentPaid(auth.tournament.state)) {
      return NextResponse.json({ error: "ابتدا لینک ثبت‌نام را فعال کنید." }, { status: 402 });
    }
    const body = await req.json();
    const current = readRegistrationSettings(auth.tournament.state, auth.tournament.team_count);
    let isOpen = current.isOpen;
    let capacity = current.capacity;
    if (typeof body.isOpen === "boolean") isOpen = body.isOpen;
    if (body.capacity != null) {
      const n = Math.round(Number(body.capacity));
      if (!Number.isFinite(n) || n < 2 || n > 128) {
        return NextResponse.json({ error: "ظرفیت باید بین ۲ تا ۱۲۸ تیم باشد." }, { status: 400 });
      }
      const list = await db.listRegistrations(id);
      const approved = list.filter((r) => r.status === "approved").length;
      if (n < approved) {
        return NextResponse.json({ error: "ظرفیت نمی‌تواند کمتر از تعداد تیم‌های تأییدشده باشد." }, { status: 400 });
      }
      capacity = n;
    }
    const paymentInfo = auth.tournament.state?.registrationPayment;
    const updatedState = {
      ...withRegistrationPaid(auth.tournament.state, paymentInfo, auth.tournament.team_count),
      registration: { isOpen, capacity },
    };
    await db.saveTournament({
      id: auth.tournament.id,
      userId: auth.tournament.user_id,
      title: auth.tournament.title,
      format: auth.tournament.format,
      sport: auth.tournament.sport || undefined,
      teamCount: auth.tournament.team_count,
      state: updatedState,
    });
    return NextResponse.json({ success: true, settings: { isOpen, capacity } });
  } catch (err) {
    console.error("[Registrations PATCH]", err);
    return NextResponse.json({ error: "خطا در ذخیره تنظیمات ثبت‌نام." }, { status: 500 });
  }
}
