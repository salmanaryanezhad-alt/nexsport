import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { toTournamentCard } from "@/lib/organizer/summary";
import { hasUnlimitedPlanning } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }

    const userId = auth.user.id;
    const [tournaments, library, registrations, quota] = await Promise.all([
      db.listTournamentsFull(userId),
      db.countUserLibrary(userId),
      db.listRegistrationsByUser(userId),
      db.getUserQuota(userId),
    ]);

    const cards = tournaments.map(toTournamentCard);
    const pending = registrations.filter((r) => r.status === "pending").length;
    const approved = registrations.filter((r) => r.status === "approved").length;
    const rejected = registrations.filter((r) => r.status === "rejected").length;
    const matchesTotal = cards.reduce((s, t) => s + t.matchesTotal, 0);
    const matchesPlayed = cards.reduce((s, t) => s + t.matchesPlayed, 0);
    const unlimited = quota.unlimitedPlanning || hasUnlimitedPlanning(auth.user);

    return NextResponse.json({
      profile: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        mobile: auth.user.mobile,
        role: auth.user.role,
        createdAt: auth.user.created_at instanceof Date ? auth.user.created_at.toISOString() : auth.user.created_at,
      },
      quota: {
        planningCredits: unlimited ? 999999 : quota.planningCredits,
        isVip: quota.isVip,
        isClubPro: quota.isClubPro || unlimited,
        unlimitedPlanning: unlimited,
        vipExpiresAt: quota.vipExpiresAt ? quota.vipExpiresAt.toISOString() : null,
        clubProExpiresAt: quota.clubProExpiresAt ? quota.clubProExpiresAt.toISOString() : null,
        freeLinkAvailable: quota.freeLinkAvailable,
      },
      stats: {
        tournamentCount: cards.length,
        teamCount: library.teams,
        playerCount: library.players,
        pendingRegistrations: pending,
        approvedRegistrations: approved,
        rejectedRegistrations: rejected,
        spectatorLinks: cards.filter((t) => t.spectatorPaid).length,
        registrationLinks: cards.filter((t) => t.registrationPaid).length,
        matchesTotal,
        matchesPlayed,
      },
      tournaments: cards,
      registrations: registrations.map((r) => ({
        id: r.id,
        tournament_id: r.tournament_id,
        tournament_title: r.tournament_title,
        team_name: r.team_name,
        short_name: r.short_name,
        city: r.city,
        coach: r.coach,
        contact_name: r.contact_name,
        mobile: r.mobile,
        notes: r.notes,
        status: r.status,
        reject_reason: r.reject_reason,
        roster: r.roster,
        created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
      })),
    });
  } catch (err) {
    console.error("[Organizer overview]", err);
    return NextResponse.json({ error: "خطا در دریافت پنل برگزارکننده." }, { status: 500 });
  }
}
