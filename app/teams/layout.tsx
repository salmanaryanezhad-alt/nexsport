import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "تیم‌های من",
  description: "مدیریت تیم‌ها و فهرست بازیکنان در سامانه NexSport.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
