import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encodeTournamentPayload } from "@/lib/tournamentCodec";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const tournamentId = resolvedParams.id;
    if (!tournamentId) {
      return NextResponse.json({ error: "شناسه مسابقه نامعتبر است." }, { status: 400 });
    }

    const body = await req.json();
    const { scores, matchDetails, result, fallbackData } = body || {};

    let tournament = await db.getPublicTournament(tournamentId);

    if (!tournament) {
      // Check if we can recover from cookie
      const cookieVal = req.cookies.get(`nexsport_t_${tournamentId}`)?.value;
      if (cookieVal) {
        const { decodeTournamentPayload } = await import("@/lib/tournamentCodec");
        const decoded = decodeTournamentPayload(cookieVal);
        if (decoded) {
          tournament = {
            id: decoded.id || tournamentId,
            user_id: "public",
            title: decoded.title,
            format: decoded.format,
            sport: decoded.sport || null,
            team_count: decoded.teamCount,
            state: decoded.state,
            created_at: new Date(decoded.createdAt || Date.now()),
            updated_at: new Date(decoded.updatedAt || Date.now()),
          };
        }
      }
    }

    if (!tournament && fallbackData) {
      tournament = {
        id: tournamentId,
        user_id: "public",
        title: fallbackData.title || "مسابقات ورزشی",
        format: fallbackData.format || "league",
        sport: fallbackData.sport || null,
        team_count: Number(fallbackData.teamCount) || 4,
        state: fallbackData.state || {},
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    if (!tournament) {
      return NextResponse.json(
        { error: "مسابقه جهت به‌روزرسانی نتایج یافت نشد." },
        { status: 404 }
      );
    }

    const updatedState = {
      ...(tournament.state || {}),
      scores: scores !== undefined ? scores : tournament.state?.scores,
      matchDetails: matchDetails !== undefined ? matchDetails : tournament.state?.matchDetails,
      result: result !== undefined ? result : tournament.state?.result,
    };

    const saved = await db.saveTournament({
      id: tournament.id,
      userId: tournament.user_id,
      title: tournament.title,
      format: tournament.format,
      sport: tournament.sport || undefined,
      teamCount: tournament.team_count,
      state: updatedState,
    });

    const res = NextResponse.json({
      success: true,
      message: "نتایج مسابقه با موفقیت همگام‌سازی شد.",
      tournament: saved,
      updatedAt: saved.updated_at,
    });

    // Update the cookie with latest state
    try {
      const token = encodeTournamentPayload({
        id: saved.id,
        title: saved.title,
        format: saved.format,
        sport: saved.sport,
        teamCount: saved.team_count,
        state: saved.state,
        createdAt: saved.created_at,
        updatedAt: saved.updated_at,
      });
      if (token) {
        res.cookies.set(`nexsport_t_${saved.id}`, token, {
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: "lax",
        });
      }
    } catch {}

    return res;
  } catch (err: any) {
    console.error("[Tournament Sync Error]", err);
    return NextResponse.json(
      { error: "خطا در همگام‌سازی نتایج مسابقه." },
      { status: 500 }
    );
  }
}
