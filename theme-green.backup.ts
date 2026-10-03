/**
 * پشتیبان تم سبز قبلی — اگر خواستی برگردونیم، رنگ‌های pitch/emerald/teal
 * و هگزهای هیرو را از اینجا به tailwind.config.ts و app/page.tsx برمی‌گردانیم.
 *
 * pitch: DEFAULT #0F5132 / dark #062E1E / light #166534 / emerald #10B981 / mint #34D399
 * hero: from-[#06281C] via-[#0B3B24] to-[#041F16]
 * CTA: from-[#06281C] via-[#0F5132] to-[#041F16]
 * themeColor / لوگو / ایمیل: #1B4332
 * body glow: rgba(16, 185, 129, 0.06)
 */
export const GREEN_THEME_BACKUP = {
  pitch: {
    DEFAULT: "#0F5132",
    dark: "#062E1E",
    light: "#166534",
    emerald: "#10B981",
    mint: "#34D399",
  },
  glowPitch: "0 0 25px -4px rgba(16, 185, 129, 0.3)",
  sportGradient: "linear-gradient(135deg, #0F5132 0%, #062E1E 100%)",
  heroGlow: "radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.25), transparent 70%)",
  themeColor: "#1B4332",
} as const;
