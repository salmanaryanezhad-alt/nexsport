export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface SendEmailResult {
  success: boolean;
  isRealDelivery: boolean;
  demoCode?: string;
  error?: string;
}

export async function sendVerificationEmail(
  toEmail: string,
  userName: string,
  code: string,
  type: "verify" | "reset" = "verify"
): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const subject =
    type === "reset"
      ? "کد بازیابی رمز عبور نکس‌اسپورت (NexSport)"
      : "کد تایید حساب کاربری نکس‌اسپورت (NexSport)";
  const description =
    type === "reset"
      ? "کد تایید شما برای بازیابی رمز عبور به شرح زیر است:"
      : "کد تایید شما برای ورود و فعال‌سازی حساب کاربری به شرح زیر است:";

  if (resendApiKey) {
    try {
      const fromEmail = process.env.EMAIL_FROM || "NexSport <noreply@nexsport.ir>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: toEmail,
          subject,
          html: `
            <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #DAD5C6; border-radius: 12px; background-color: #F7F5EE; color: #16211C;">
              <h2 style="color: #1B4332; margin-bottom: 16px;">سامانه ورزشی نکس‌اسپورت (NexSport)</h2>
              <p style="font-size: 14px; line-height: 1.6;">سلام <strong>${userName}</strong> عزیز،</p>
              <p style="font-size: 14px; line-height: 1.6;">${description}</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 28px; font-weight: bold; letter-spacing: 6px; padding: 12px 24px; background-color: #1B4332; color: #FFFFFF; border-radius: 8px;">
                  ${code}
                </span>
              </div>
              <p style="font-size: 12px; color: #666;">این کد تا ۱۵ دقیقه معتبر است. اگر شما این درخواست را نداده‌اید، این پیام را نادیده بگیرید.</p>
              <hr style="border: none; border-top: 1px solid #DAD5C6; margin: 20px 0;" />
              <p style="font-size: 11px; color: #888; text-align: center;">https://nexsport.ir</p>
            </div>
          `,
        }),
      });

      if (res.ok) {
        return { success: true, isRealDelivery: true };
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn("[NexSport Email] Resend API error:", errorData);
      }
    } catch (err) {
      console.warn("[NexSport Email] Failed to send via Resend:", err);
    }
  }

  // Fallback demo/development mode:
  console.log(`\n========================================`);
  console.log(`[NexSport Email Demo] Verification Code`);
  console.log(`To: ${toEmail} (${userName})`);
  console.log(`CODE: >>> ${code} <<<`);
  console.log(`========================================\n`);

  return {
    success: true,
    isRealDelivery: false,
    demoCode: code,
  };
}
