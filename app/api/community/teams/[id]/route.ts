import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicPlayerView, publicTeamView } from "@/lib/community/validate";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const team = await db.getTeam(id);
    if (!team) return NextResponse.json({ error: "تیم یافت نشد." }, { status: 404 });
    const visible = await db.isTeamPubliclyVisible(id);
    if (!visible) {
      return NextResponse.json({ error: "صفحه عمومی این تیم منتشر نشده است." }, { status: 404 });
    }
    const players = await db.listPlayers(id);
    const clubIds = await db.listClubIdsForTeam(id);
    const clubs = [];
    for (const cid of clubIds) {
      const club = await db.getClub(cid);
      if (club?.page_paid) {
        clubs.push({ id: club.id, name: club.name, city: club.city, sport: club.sport });
      }
    }
    const tournaments = (await db.listPublicTournaments(team.name, 12)).filter((t) =>
      t.title.includes(team.name)
    );
    return NextResponse.json({
      team: publicTeamView(team),
      players: players.map(publicPlayerView),
      clubs,
      tournaments,
    });
  } catch (err) {
    console.error("[Public Team]", err);
    return NextResponse.json({ error: "خطا در دریافت تیم." }, { status: 500 });
  }
}
