import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پنل برگزارکننده",
  description: "داشبورد مدیریت مسابقات، تیم‌ها، ثبت‌نام‌ها و گزارش‌ها.",
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

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
