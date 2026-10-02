import type { Metadata } from "next";

const isServerExport = process.env.NEXT_EXPORT === "true";

export const metadata: Metadata = {
  title: "خدمات ورزشی",
  description: "تبلیغ مسابقات، معرفی باشگاه، آموزش، مربی، مشاور و خدمات مرتبط در NexSport.",
  robots: isServerExport
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
