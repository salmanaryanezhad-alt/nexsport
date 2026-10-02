import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "باشگاه",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
