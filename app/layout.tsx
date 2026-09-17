import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexSport | برنامه‌ریز رایگان مسابقات",
  description:
    "بدون نیاز به اکسل یا محاسبه دستی، برنامه لیگ، رفت‌وبرگشت، گروهی یا حذفی مسابقه‌تان را در چند دقیقه بسازید.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
