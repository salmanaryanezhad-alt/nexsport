import { NextRequest, NextResponse } from "next/server";
import { db, RegistrationStatus } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { readRegistrationSettings, registrationPaymentPaid } from "@/lib/registrations/settings";

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
      if (any) return { ok: true as const, user: auth.user, tournament: any };
    }
    return { ok: false as const, error: "مسابقه یافت نشد.", status: 404 as const };
  }
  return { ok: true as const, user: auth.user, tournament };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; rid: string } | Promise<{ id: string; rid: string }> }
) {
  try {
    const { id, rid } = await Promise.resolve(params);
    const auth = await requireOwner(req, id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    if (!registrationPaymentPaid(auth.tournament.state)) {
      return NextResponse.json({ error: "لینک ثبت‌نام فعال نیست." }, { status: 402 });
    }
    const rec = await db.getRegistration(rid);
    if (!rec || rec.tournament_id !== id) {
      return NextResponse.json({ error: "ثبت‌نام یافت نشد." }, { status: 404 });
    }
    const body = await req.json();
    const status = String(body.status || "") as RegistrationStatus;
    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      return NextResponse.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
    }
    if (status === "approved") {
      const settings = readRegistrationSettings(auth.tournament.state, auth.tournament.team_count);
      const list = await db.listRegistrations(id);
      const approved = list.filter((r) => r.status === "approved" && r.id !== rid).length;
      if (approved >= settings.capacity) {
        return NextResponse.json({ error: "ظرفیت مسابقه تکمیل است؛ ابتدا ظرفیت را افزایش دهید یا تیمی را رد کنید." }, { status: 409 });
      }
    }
    const updated = await db.updateRegistrationStatus(rid, status, body.reject_reason);
    if (!updated || "error" in updated) {
      return NextResponse.json({ error: (updated as any)?.error || "خطا در تغییر وضعیت." }, { status: 400 });
    }
    return NextResponse.json({ success: true, registration: updated });
  } catch (err) {
    console.error("[Registration status PATCH]", err);
    return NextResponse.json({ error: "خطا در تغییر وضعیت ثبت‌نام." }, { status: 500 });
  }
}
