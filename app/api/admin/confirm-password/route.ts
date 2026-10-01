import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth/adminGuard";
import { verifyPassword } from "@/lib/auth/password";
import { hasPersianLetters } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRequest(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const password = String(body?.password || "");

    if (!password) {
      return NextResponse.json({ error: "رمز عبور را وارد نمایید." }, { status: 400 });
    }

    if (hasPersianLetters(password)) {
      return NextResponse.json(
        { error: "صفحه کلید را به انگلیسی تغییر دهید" },
        { status: 400 }
      );
    }

    const matches = verifyPassword(password, auth.user.password_hash);
    if (!matches) {
      return NextResponse.json(
        { error: "رمز عبور وارد شده صحیح نیست." },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Admin Confirm Password Error]", err);
    return NextResponse.json({ error: "خطا در بررسی رمز عبور." }, { status: 500 });
  }
}
