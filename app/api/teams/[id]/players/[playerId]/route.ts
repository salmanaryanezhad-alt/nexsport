import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizePlayerInput } from "@/lib/teams/validate";

export const dynamic = "force-dynamic";

async function requireTeamOwner(req: NextRequest, teamId: string) {
  const auth = await verifySessionRequest(req);
  if ("error" in auth) return auth;
  const team = await db.getTeam(teamId);
  if (!team) return { error: "تیم یافت نشد.", status: 404 as const };
  if (team.user_id !== auth.user.id && !auth.isAdmin) {
    return { error: "دسترسی به این تیم مجاز نیست.", status: 403 as const };
  }
  return { user: auth.user, team };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } | Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await Promise.resolve(params);
    const auth = await requireTeamOwner(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const player = await db.getPlayer(playerId);
    if (!player || player.team_id !== id) return NextResponse.json({ error: "بازیکن یافت نشد." }, { status: 404 });
    const body = await req.json();
    const parsed = sanitizePlayerInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const result = await db.updatePlayer(playerId, parsed.data);
    if (!result) return NextResponse.json({ error: "بازیکن یافت نشد." }, { status: 404 });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ success: true, player: result });
  } catch (err) {
    console.error("[Player PATCH]", err);
    return NextResponse.json({ error: "خطا در ویرایش بازیکن." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } | Promise<{ id: string; playerId: string }> }
) {
  try {
    const { id, playerId } = await Promise.resolve(params);
    const auth = await requireTeamOwner(req, id);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: (auth as any).expired }, { status: auth.status });
    }
    const player = await db.getPlayer(playerId);
    if (!player || player.team_id !== id) return NextResponse.json({ error: "بازیکن یافت نشد." }, { status: 404 });
    await db.deletePlayer(playerId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Player DELETE]", err);
    return NextResponse.json({ error: "خطا در حذف بازیکن." }, { status: 500 });
  }
}
