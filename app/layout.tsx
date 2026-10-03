import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1B4F8A",
  width: "device-width",
  initialScale: 1,
};

const isServerExport = process.env.NEXT_EXPORT === "true";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nexsport.ir"),
  title: {
    default: "NexSport | برنامه‌ریز مسابقات، تیم، باشگاه و جامعه ورزشی",
    template: "%s | NexSport",
  },
  description:
    "برنامه لیگ و حذفی بسازید، نتیجه را زنده ثبت کنید، لینک تماشاگر و ثبت‌نام رایگان بدهید. تیم و باشگاه مدیریت کنید؛ جامعه و خدمات ورزشی را پیدا کنید.",
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
    title: "NexSport | برنامه‌ریز مسابقات، تیم، باشگاه و جامعه ورزشی",
    description:
      "برنامه مسابقه، صفحه تماشاگر، ثبت‌نام رایگان، کتابخانه تیم، باشگاه، جامعه و خدمات ورزشی در یک سامانه.",
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
    title: "NexSport | برنامه‌ریز مسابقات و جامعه ورزشی",
    description: "از قرعه‌کشی تا تیم، باشگاه، صفحه تماشاگر و خدمات ورزشی.",
    images: ["https://nexsport.ir/og-image.png"],
  },
  robots: isServerExport
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-video-preview": -1,
          "max-snippet": -1,
        },
      }
    : {
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

import { AuthProvider } from "@/components/auth/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { ProfileModal } from "@/components/auth/ProfileModal";
import { UsersModal } from "@/components/admin/UsersModal";
import { AdminTournamentsModal } from "@/components/admin/AdminTournamentsModal";
import { AdminTeamsModal } from "@/components/admin/AdminTeamsModal";
import { AdminDiscountsModal } from "@/components/admin/AdminDiscountsModal";
import { AdminPricingModal } from "@/components/admin/AdminPricingModal";
import { AdminPasswordGate } from "@/components/admin/AdminPasswordGate";
import { AdminTicketsModal } from "@/components/admin/AdminTicketsModal";
import { TicketsModal } from "@/components/support/TicketsModal";

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
        {isServerExport ? (
          <>
            <meta name="robots" content="index, follow" />
            <meta
              name="googlebot"
              content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
            />
          </>
        ) : (
          <>
            <meta name="robots" content="noindex, nofollow, noarchive" />
            <meta name="googlebot" content="noindex, nofollow, noarchive" />
          </>
        )}
      </head>
      <body className="min-h-screen font-sans antialiased bg-chalk text-ink selection:bg-gold selection:text-ink">
        <AuthProvider>
          {children}
          <AuthModal />
          <ProfileModal />
          <UsersModal />
          <AdminTournamentsModal />
          <AdminTeamsModal />
          <AdminDiscountsModal />
          <AdminPricingModal />
          <AdminPasswordGate />
          <AdminTicketsModal />
          <TicketsModal />
        </AuthProvider>
      </body>
    </html>
  );
}
