import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1B4332",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport.ir"),
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "NexSport | برنامه‌ریز و قرعه‌کشی آنلاین مسابقات ورزشی",
    description:
      "تولید خودکار و استاندارد برنامه مسابقات لیگ، گروهی و حذفی بدون بازی تکراری، با ثبت نتایج زنده، رده‌بندی و خروجی اکسل و PDF.",
    url: "https://nexsport.ir",
    siteName: "NexSport",
    locale: "fa_IR",
    type: "website",
    images: [
      {
        url: "https://nexsport.ir/og-image.png",
        width: 1200,
        height: 630,
        alt: "لوگوی رسمی و سامانه مسابقات ورزشی NexSport",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NexSport | برنامه‌ریز آنلاین مسابقات ورزشی",
    description:
      "سامانه هوشمند و رایگان قرعه‌کشی، جدول لیگ و براکت حذفی مسابقات ورزشی.",
    images: ["https://nexsport.ir/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://nexsport.ir",
  },
};

import { AuthProvider } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/auth/ProfileModal";
import { UsersModal } from "@/components/admin/UsersModal";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link
          rel="preload"
          href="/fonts/vazirmatn/Vazirmatn[wght].woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen font-sans antialiased bg-chalk text-ink selection:bg-gold selection:text-ink">
        <AuthProvider>
          {children}
          <AuthModal />
          <ProfileModal />
          <UsersModal />
        </AuthProvider>
      </body>
    </html>
  );
}
