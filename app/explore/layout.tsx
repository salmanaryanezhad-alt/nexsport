import type { Metadata } from "next";

const isServerExport = process.env.NEXT_EXPORT === "true";

export const metadata: Metadata = {
  title: "جست‌وجوی جامعه ورزشی",
  description: "جست‌وجوی مسابقات، تیم‌ها، باشگاه‌ها، بازیکنان و خدمات ورزشی در NexSport.",
  robots: isServerExport
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
