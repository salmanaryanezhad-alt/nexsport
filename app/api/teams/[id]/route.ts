import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySessionRequest } from "@/lib/auth/sessionGuard";
import { sanitizeTeamInput } from "@/lib/teams/validate";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const team = await db.getTeam(id);
    if (!team) return NextResponse.json({ error: "تیم یافت نشد." }, { status: 404 });
    if (team.user_id !== auth.user.id && !auth.isAdmin) {
      return NextResponse.json({ error: "دسترسی به این تیم مجاز نیست." }, { status: 403 });
    }
    const players = await db.listPlayers(id);
    const tournaments = await db.listLinkedTournaments(team.user_id, team.id, team.name);
    return NextResponse.json({ team, players, tournaments });
  } catch (err) {
    console.error("[Team GET]", err);
    return NextResponse.json({ error: "خطا در دریافت تیم." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const team = await db.getTeam(id);
    if (!team) return NextResponse.json({ error: "تیم یافت نشد." }, { status: 404 });
    if (team.user_id !== auth.user.id && !auth.isAdmin) {
      return NextResponse.json({ error: "دسترسی به این تیم مجاز نیست." }, { status: 403 });
    }
    const body = await req.json();
    if (typeof body?.is_public === "boolean" && Object.keys(body).filter((k) => body[k] !== undefined).length === 1) {
      const updated = await db.setTeamPublic(id, body.is_public);
      return NextResponse.json({ success: true, team: updated });
    }
    const parsed = sanitizeTeamInput(body || {});
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = await db.updateTeam(id, parsed.data);
    return NextResponse.json({ success: true, team: updated });
  } catch (err) {
    console.error("[Team PATCH]", err);
    return NextResponse.json({ error: "خطا در ویرایش تیم." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const auth = await verifySessionRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error, expired: auth.expired }, { status: auth.status });
    }
    const team = await db.getTeam(id);
    if (!team) return NextResponse.json({ error: "تیم یافت نشد." }, { status: 404 });
    if (team.user_id !== auth.user.id && !auth.isAdmin) {
      return NextResponse.json({ error: "دسترسی به این تیم مجاز نیست." }, { status: 403 });
    }
    await db.deleteTeam(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Team DELETE]", err);
    return NextResponse.json({ error: "خطا در حذف تیم." }, { status: 500 });
  }
}
