import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicPlayerView, publicTeamView } from "@/lib/community/validate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = String(sp.get("q") || "").trim().slice(0, 80);
    const type = String(sp.get("type") || "all");
    const limit = 24;

    const [tournaments, teams, clubs, players, services] = await Promise.all([
      type === "all" || type === "tournaments" ? db.listPublicTournaments(q, limit) : Promise.resolve([]),
      type === "all" || type === "teams" ? db.listPublicTeams(q, limit) : Promise.resolve([]),
      type === "all" || type === "clubs" ? db.listPublicClubs(q, limit) : Promise.resolve([]),
      type === "all" || type === "players" ? db.searchPublicPlayers(q, limit) : Promise.resolve([]),
      type === "all" || type === "services"
        ? db.listServiceListings({ query: q, limit })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      q,
      type,
      tournaments,
      teams: teams.map(publicTeamView),
      clubs: clubs.map((c) => ({
        id: c.id,
        name: c.name,
        short_name: c.short_name,
        sport: c.sport,
        city: c.city,
        venue: c.venue,
        description: c.description,
      })),
      players: players.map(publicPlayerView).map((p, i) => ({
        ...p,
        team_name: (players[i] as any).team_name || "",
      })),
      services: services.map((s) => ({
        id: s.id,
        category: s.category,
        title: s.title,
        body: s.body.slice(0, 180),
        city: s.city,
        sport: s.sport,
        owner_name: s.owner_name || "",
        updated_at: s.updated_at,
      })),
    });
  } catch (err) {
    console.error("[Community Search]", err);
    return NextResponse.json({ error: "خطا در جست‌وجو." }, { status: 500 });
  }
}
