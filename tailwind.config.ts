import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chalk: "#F7F5EE",
        pitch: {
          DEFAULT: "#1B4332",
          dark: "#122E22",
          light: "#2D6A4F",
        },
        gold: {
          DEFAULT: "#C9A227",
          dark: "#A5831C",
          light: "#E4C866",
        },
        ink: "#16211C",
        line: "#DAD5C6",
        brick: "#B3432B",
      },
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "sans-serif"],
      },
      backgroundImage: {
        "pitch-lines": "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.035) 39px, rgba(255,255,255,0.035) 40px)",
      },
    },
  },
  plugins: [],
};

export default config;
