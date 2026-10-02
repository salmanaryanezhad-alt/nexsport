import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const kind = String(req.nextUrl.searchParams.get("kind") || "");
    const targetId = String(req.nextUrl.searchParams.get("targetId") || "");
    if (!kind || !targetId) return NextResponse.json({ featuredUntil: null });
    const pin = await db.getActiveCommunityPromo(kind, targetId);
    return NextResponse.json({ featuredUntil: pin?.expires_at?.toISOString() || null });
  } catch {
    return NextResponse.json({ featuredUntil: null });
  }
}
