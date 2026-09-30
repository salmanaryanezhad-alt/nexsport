import type { Metadata } from "next";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { PublicTournamentViewer, PublicTournamentData } from "@/components/public/PublicTournamentViewer";
import { decodeTournamentPayload } from "@/lib/tournamentCodec";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined } | Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  let t = await db.getPublicTournament(id);

  if (!t) {
    const sp = searchParams ? await Promise.resolve(searchParams) : {};
    const d = typeof sp?.d === "string" ? sp.d : Array.isArray(sp?.d) ? sp.d[0] : undefined;
    if (d) {
      const decoded = decodeTournamentPayload(d);
      if (decoded && decoded.id === id) {
        t = {
          id: decoded.id,
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

  const title = t?.title
    ? `${t.title} | برنامه و نتایج مسابقات | NexSport`
    : "مشاهده مسابقات ورزشی | NexSport";

  return {
    title,
    description: "مشاهده برنامه مسابقات، جدول رده‌بندی زنده و مراحل حذفی در سامانه ورزشی NexSport.",
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "none",
        "max-snippet": -1,
      },
    },
  };
}

export default async function PublicTournamentPage({
  params,
  searchParams,
}: {
  params: { id: string } | Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined } | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  let tournamentRecord = await db.getPublicTournament(id);

  // 1. If not found in DB, check query string (?d=...)
  if (!tournamentRecord) {
    const sp = searchParams ? await Promise.resolve(searchParams) : {};
    const d = typeof sp?.d === "string" ? sp.d : Array.isArray(sp?.d) ? sp.d[0] : undefined;
    if (d) {
      const decoded = decodeTournamentPayload(d);
      if (decoded) {
        tournamentRecord = {
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

        // Cache in memory / DB for current instance
        db.saveTournament({
          id: tournamentRecord.id,
          userId: "public",
          title: tournamentRecord.title,
          format: tournamentRecord.format,
          sport: tournamentRecord.sport || undefined,
          teamCount: tournamentRecord.team_count,
          state: tournamentRecord.state,
        }).catch(() => {});
      }
    }
  }

  // 2. Check cookies (shared between tabs on same domain/browser)
  if (!tournamentRecord) {
    try {
      const cookieStore = cookies();
      const cookieVal = cookieStore.get(`nexsport_t_${id}`)?.value;
      if (cookieVal) {
        const decoded = decodeTournamentPayload(cookieVal);
        if (decoded) {
          tournamentRecord = {
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

          db.saveTournament({
            id: tournamentRecord.id,
            userId: "public",
            title: tournamentRecord.title,
            format: tournamentRecord.format,
            sport: tournamentRecord.sport || undefined,
            teamCount: tournamentRecord.team_count,
            state: tournamentRecord.state,
          }).catch(() => {});
        }
      }
    } catch {
      // Cookie reading fallback
    }
  }

  const initialData: PublicTournamentData | null = tournamentRecord
    ? {
        id: tournamentRecord.id,
        title: tournamentRecord.title,
        format: tournamentRecord.format,
        sport: tournamentRecord.sport,
        teamCount: tournamentRecord.team_count,
        state: tournamentRecord.state,
        createdAt: tournamentRecord.created_at,
        updatedAt: tournamentRecord.updated_at,
      }
    : null;

  return <PublicTournamentViewer tournamentId={id} initialTournament={initialData} />;
}
