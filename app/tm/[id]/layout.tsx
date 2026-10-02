import type { Metadata } from "next";

const isServerExport = process.env.NEXT_EXPORT === "true";

export const metadata: Metadata = {
  title: "صفحه تیم",
  robots: isServerExport
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function PublicTeamLayout({ children }: { children: React.ReactNode }) {
  return children;
}
