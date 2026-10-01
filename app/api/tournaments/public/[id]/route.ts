import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decodeTournamentPayload } from "@/lib/tournamentCodec";
import { resolveSessionUser } from "@/lib/auth/sessionGuard";
import { isSuperAdminEmail } from "@/lib/auth/utils";
import { getRequestToken } from "@/lib/auth/sessionToken";

export const dynamic = "force-dynamic";

async function resolveViewerAccess(req: NextRequest, ownerUserId?: string | null) {
  try {
    const token = getRequestToken(req);
    if (!token) return { isAdmin: false, isOwner: false };
    const session = await db.findSession(token);
    if (!session) return { isAdmin: false, isOwner: false };
    const user = await resolveSessionUser(session);
    if (!user) return { isAdmin: false, isOwner: false };
    const isAdmin = isSuperAdminEmail(user.email) || user.role === "admin";
    const isOwner = Boolean(ownerUserId && user.id === ownerUserId);
    return { isAdmin, isOwner };
  } catch {
    return { isAdmin: false, isOwner: false };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: "شناسه مسابقه نامعتبر است." }, { status: 400 });
    }

    let tournament = await db.getPublicTournament(id);

    // If not in DB, check query string (?d=...) or cookies
    if (!tournament) {
      const paramD = req.nextUrl.searchParams.get("d");
      const cookieD = req.cookies.get(`nexsport_t_${id}`)?.value;
      const rawToken = paramD || cookieD;

      if (rawToken) {
        const decoded = decodeTournamentPayload(rawToken);
        if (decoded) {
          tournament = {
            id: decoded.id || id,
            user_id: "public",
            title: decoded.title,
            format: decoded.format,
            sport: decoded.sport || null,
            team_count: decoded.teamCount,
            state: decoded.state,
            created_at: new Date(decoded.createdAt || Date.now()),
            updated_at: new Date(decoded.updatedAt || Date.now()),
          };

          // Cache in memory / DB
          db.saveTournament({
            id: tournament.id,
            userId: "public",
            title: tournament.title,
            format: tournament.format,
            sport: tournament.sport || undefined,
            teamCount: tournament.team_count,
            state: tournament.state,
          }).catch(() => {});
        }
      }
    }

    if (!tournament) {
      return NextResponse.json(
        { error: "مسابقه یافت نشد یا ممکن است توسط برگزارکننده حذف شده باشد." },
        { status: 404 }
      );
    }

    const isPaid = Boolean(tournament.state?.payment?.isPaid);
    const access = await resolveViewerAccess(req, tournament.user_id);
    if (!isPaid && !access.isAdmin && !access.isOwner) {
      return NextResponse.json(
        {
          error: "لینک اختصاصی این مسابقه هنوز پرداخت و فعال‌سازی نشده است. برگزارکننده محترم مسابقه می‌تواند نسبت به پرداخت و فعال‌سازی آن در پنل کاربری اقدام نماید.",
          notActivated: true,
          tournamentTitle: tournament.title,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        format: tournament.format,
        sport: tournament.sport,
        teamCount: tournament.team_count,
        state: tournament.state,
        createdAt: tournament.created_at,
        updatedAt: tournament.updated_at,
      },
      preview: !isPaid,
      adminPreview: !isPaid && access.isAdmin,
    });
  } catch (err: any) {
    console.error("[Get Public Tournament Error]", err);
    return NextResponse.json({ error: "خطا در دریافت اطلاعات مسابقه." }, { status: 500 });
  }
}
