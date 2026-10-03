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
        // تست تم آبی — سبز قبلی در theme-green.backup.ts
        pitch: {
          DEFAULT: "#1B4F8A",
          dark: "#0B2744",
          light: "#2563A8",
          emerald: "#3B82F6",
          mint: "#60A5FA",
        },
        emerald: {
          50: "#F0F7FF",
          100: "#E0EFFF",
          200: "#B9D7FE",
          300: "#7CB6FC",
          400: "#3B92F6",
          500: "#1D74E0",
          600: "#1560C4",
          700: "#164B9A",
          800: "#16407C",
          900: "#153663",
          950: "#0C2344",
        },
        teal: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
          950: "#082F49",
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
        "glow-pitch": "0 0 25px -4px rgba(37, 99, 235, 0.32)",
        "glow-gold": "0 0 25px -4px rgba(245, 158, 11, 0.3)",
      },
      backgroundImage: {
        "pitch-lines": "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.035) 39px, rgba(255,255,255,0.035) 40px)",
        "hero-glow": "radial-gradient(circle at 50% -20%, rgba(59, 130, 246, 0.28), transparent 70%)",
        "sport-gradient": "linear-gradient(135deg, #1B4F8A 0%, #0B2744 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
