import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chalk: {
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
          muted: "#F1F5F9",
        },
        pitch: {
          DEFAULT: "#0F5132",
          dark: "#062E1E",
          light: "#166534",
          emerald: "#10B981",
          mint: "#34D399",
        },
        gold: {
          DEFAULT: "#D97706",
          dark: "#B45309",
          light: "#FBBF24",
          amber: "#F59E0B",
        },
        ink: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          soft: "#64748B",
        },
        line: {
          DEFAULT: "#E2E8F0",
          dark: "#CBD5E1",
        },
        brick: {
          DEFAULT: "#E11D48",
          light: "#FB7185",
        },
      },
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        "card": "0 2px 10px -2px rgba(15, 23, 42, 0.06), 0 1px 4px -1px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 14px 28px -6px rgba(15, 23, 42, 0.1), 0 4px 10px -2px rgba(15, 23, 42, 0.06)",
        "glow-pitch": "0 0 25px -4px rgba(16, 185, 129, 0.3)",
        "glow-gold": "0 0 25px -4px rgba(245, 158, 11, 0.3)",
      },
      backgroundImage: {
        "pitch-lines": "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.035) 39px, rgba(255,255,255,0.035) 40px)",
        "hero-glow": "radial-gradient(circle at 50% -20%, rgba(16, 185, 129, 0.25), transparent 70%)",
        "sport-gradient": "linear-gradient(135deg, #0F5132 0%, #062E1E 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
