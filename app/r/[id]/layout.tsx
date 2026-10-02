import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ثبت‌نام مسابقه",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RegistrationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
