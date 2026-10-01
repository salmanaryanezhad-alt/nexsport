import type { Metadata } from "next";

const isServerExport = process.env.NEXT_EXPORT === "true";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport.ir";

export const metadata: Metadata = {
  title: "برنامه‌ریز و قرعه‌کشی آنلاین مسابقات ورزشی",
  description:
    "برنامه‌ریزی رایگان مسابقات لیگ، گروهی و حذفی در NexSport. قرعه‌کشی آنلاین، جدول رده‌بندی زنده، و خروجی چاپ.",
  alternates: {
    canonical: `${siteUrl}/planner`,
  },
  robots: isServerExport
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-video-preview": -1,
          "max-snippet": -1,
        },
      }
    : {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
};

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
