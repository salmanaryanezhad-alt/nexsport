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
    const player = await db.getPlayer(id);
    if (!player) return NextResponse.json({ error: "بازیکن یافت نشد." }, { status: 404 });
    const visible = await db.isTeamPubliclyVisible(player.team_id);
    if (!visible) {
      return NextResponse.json({ error: "صفحه عمومی این بازیکن در دسترس نیست." }, { status: 404 });
    }
    const team = await db.getTeam(player.team_id);
    return NextResponse.json({
      player: publicPlayerView(player),
      team: team ? publicTeamView(team) : null,
    });
  } catch (err) {
    console.error("[Public Player]", err);
    return NextResponse.json({ error: "خطا در دریافت بازیکن." }, { status: 500 });
  }
}
