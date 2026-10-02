import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicPlayerView, publicTeamView } from "@/lib/community/validate";

export const dynamic = "force-dynamic";

function featuredSet(promos: { target_id: string; expires_at: Date }[]) {
  const map = new Map<string, string>();
  for (const p of promos) map.set(p.target_id, p.expires_at.toISOString());
  return map;
}

function sortFeatured<T extends { id: string }>(items: T[], map: Map<string, string>) {
  return [...items].sort((a, b) => Number(map.has(b.id)) - Number(map.has(a.id)));
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = String(sp.get("q") || "").trim().slice(0, 80);
    const type = String(sp.get("type") || "all");
    const limit = 24;

    const [tournaments, teams, clubs, players, services, teamPins, listingPins, tBoosts] = await Promise.all([
      type === "all" || type === "tournaments" ? db.listPublicTournaments(q, 80) : Promise.resolve([]),
      type === "all" || type === "teams" ? db.listPublicTeams(q, 80) : Promise.resolve([]),
      type === "all" || type === "clubs" ? db.listPublicClubs(q, limit) : Promise.resolve([]),
      type === "all" || type === "players" ? db.searchPublicPlayers(q, limit) : Promise.resolve([]),
      type === "all" || type === "services" ? db.listServiceListings({ query: q, limit: 80 }) : Promise.resolve([]),
      db.listActiveCommunityPromos("team_pin"),
      db.listActiveCommunityPromos("listing_pin"),
      db.listActiveCommunityPromos("tournament_boost"),
    ]);

    const teamFeat = featuredSet(teamPins);
    const listFeat = featuredSet(listingPins);
    const tFeat = featuredSet(tBoosts);

    return NextResponse.json({
      success: true,
      q,
      type,
      tournaments: sortFeatured(tournaments, tFeat)
        .slice(0, limit)
        .map((t) => ({ ...t, featuredUntil: tFeat.get(t.id) || null })),
      teams: sortFeatured(teams.map(publicTeamView), teamFeat)
        .slice(0, limit)
        .map((t) => ({ ...t, featuredUntil: teamFeat.get(t.id) || null })),
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
      services: sortFeatured(
        services.map((s) => ({
          id: s.id,
          category: s.category,
          title: s.title,
          body: s.body.slice(0, 180),
          city: s.city,
          sport: s.sport,
          owner_name: s.owner_name || "",
          updated_at: s.updated_at,
        })),
        listFeat
      )
        .slice(0, limit)
        .map((s) => ({ ...s, featuredUntil: listFeat.get(s.id) || null })),
    });
  } catch (err) {
    console.error("[Community Search]", err);
    return NextResponse.json({ error: "خطا در جست‌وجو." }, { status: 500 });
  }
}
