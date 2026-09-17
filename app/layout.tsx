import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1B4332",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport-ten.vercel.app"),
  title: {
    default: "NexSport | برنامه‌ریز و قرعه‌کشی آنلاین مسابقات ورزشی",
    template: "%s | NexSport",
  },
  description:
    "سامانه آنلاین و رایگان قرعه‌کشی و برنامه‌ریزی مسابقات فوتبال، فوتسال، والیبال و تورنمنت‌های ورزشی. تولید برنامه لیگ، گروهی و حذفی بدون بازی تکراری همراه با جدول رده‌بندی زنده و خروجی اکسل و PDF.",
  keywords: [
    "برنامه ریز مسابقات",
    "قرعه کشی مسابقات",
    "قرعه کشی آنلاین فوتبال",
    "جدول لیگ فوتبال",
    "جدول رده بندی فوتبال",
    "براکت مسابقات حذفی",
    "ساخت جدول مسابقات",
    "نرم افزار قرعه کشی ورزشی",
    "قرعه کشی فوتسال",
    "قرعه کشی جام رمضان",
    "برنامه مسابقات ورزشی",
    "اکسل جدول مسابقات",
    "سیدبندی مسابقات",
    "NexSport",
    "تورنمنت فوتبال",
    "tournament bracket generator",
    "round robin schedule generator",
  ],
  authors: [{ name: "NexSport Team" }],
  creator: "NexSport",
  publisher: "NexSport",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "NexSport | برنامه‌ریز و قرعه‌کشی آنلاین مسابقات ورزشی",
    description:
      "تولید خودکار و استاندارد برنامه مسابقات لیگ، گروهی و حذفی بدون بازی تکراری، با ثبت نتایج زنده، رده‌بندی و خروجی اکسل و PDF.",
    url: "https://nexsport-ten.vercel.app",
    siteName: "NexSport",
    locale: "fa_IR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NexSport | برنامه‌ریز آنلاین مسابقات ورزشی",
    description:
      "سامانه هوشمند و رایگان قرعه‌کشی، جدول لیگ و براکت حذفی مسابقات ورزشی.",
  },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="googlebot" content="noindex, nofollow, noarchive" />
      </head>
      <body className="min-h-screen font-sans antialiased bg-chalk text-ink selection:bg-gold selection:text-ink">
        {children}
      </body>
    </html>
  );
}
