import Link from "next/link";
import React from "react";
import { NexSportIcon } from "@/components/NexSportLogo";
import { AuthHeaderNav } from "@/components/auth/AuthHeaderNav";

function BracketSvgIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h5v5H3" />
      <path d="M3 14h5v5H3" />
      <path d="M8 7.5h6v9H8" />
      <path d="M14 12h7" />
      <circle cx="21" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

const FORMATS = [
  {
    id: "league",
    title: "لیگ دوره‌ای (تک‌دور)",
    icon: "⚽",
    tag: "پرطرفدار",
    borderTop: "border-t-4 border-emerald-500",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    desc: "هر تیم دقیقاً یک‌بار با سایر تیم‌ها بازی می‌کند. مبتنی بر الگوریتم استاندارد برگر که از نظر ریاضی تضمین می‌کند هیچ بازی تکراری ایجاد نشود.",
    bullets: ["بدون مسابقه تکراری", "توازن میزبانی و میهمانی", "محاسبه خودکار استراحت (Bye) برای تیم‌های فرد"],
  },
  {
    id: "double-league",
    title: "لیگ رفت و برگشت",
    icon: "🔄",
    tag: "استاندارد حرفه‌ای",
    borderTop: "border-t-4 border-amber-500",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    desc: "هر دو تیم دو بار، یک‌بار در زمین خود و یک‌بار در زمین حریف به مصاف هم می‌روند. نیم‌فصل اول و دوم به طور منظم تفکیک می‌شوند.",
    bullets: ["تفکیک بازی‌های رفت و برگشت", "تضمین دو بازی برای هر زوج", "تولید تقویم منظم هفتگی"],
  },
  {
    id: "groups",
    title: "مرحله گروهی",
    icon: "👥",
    tag: "سیدبندی اختیاری",
    borderTop: "border-t-4 border-blue-500",
    badgeColor: "bg-blue-50 text-blue-800 border-blue-200",
    desc: "تقسیم تیم‌ها به ۲ تا ۳۲ گروه به صورت کاملاً تصادفی یا با تعیین سرگروه‌ها و تیم‌های شاخص دلخواه شما.",
    bullets: ["سیدبندی کاملاً اختیاری", "تعداد سرگروه کمتر یا مساوی تعداد گروه", "توازن خودکار تعداد تیم‌ها در گروه‌ها"],
  },
  {
    id: "groups-knockout",
    title: "گروهی + براکت حذفی",
    icon: "🏆",
    tag: "جام‌های رسمی",
    borderTop: "border-t-4 border-purple-500",
    badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
    desc: "مسابقات با مرحله گروهی آغاز شده و تیم‌های اول و دوم با سیستم ضربدری کلاسیک (مثل جام جهانی) وارد براکت حذفی می‌شوند.",
    bullets: ["عدم برخورد تیم‌های هم‌گروه تا فینال", "جدول ضربدری صعودکنندگان", "براکت حذفی شکیل تا تعیین قهرمان"],
  },
  {
    id: "knockout",
    title: "براکت تک‌حذفی",
    icon: <BracketSvgIcon className="w-5 h-5 text-rose-600" />,
    tag: "جام حذفی",
    borderTop: "border-t-4 border-rose-500",
    badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
    desc: "براکت تک‌حذفی استاندارد با مدیریت خودکار تعداد تیم‌های نامتوازن (پشتیبانی کامل از قرعه‌های استراحت / Bye).",
    bullets: ["سیدبندی ۱ تا ۴ در ۴ بخش جداگانه", "صعود مستقیم تیم‌های برتر با Bye", "صعود خودکار برنده با ثبت نتیجه"],
  },
  {
    id: "double-knockout",
    title: "جدول دو حذفی (Double Elimination)",
    icon: "🛡️",
    tag: "ویژه مسابقات و المپیادها",
    borderTop: "border-t-4 border-teal-500",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
    desc: "هیچ تیمی با یک شکست حذف نمی‌شود! بازنده‌ها به جدول شانس مجدد (Losers Bracket) می‌روند و فینال بین قهرمانان دو جدول برگزار می‌شود.",
    bullets: ["جدول دوگانه برندگان و شانس مجدد", "تعیین دقیق مقام‌های اول تا سوم", "امکان فینال مجدد (Bracket Reset)"],
  },
];

const PILLARS = [
  {
    href: "/planner",
    icon: "⚡",
    title: "برنامه‌ریز مسابقات",
    desc: "شش فرمت استاندارد، قرعه‌کشی، ثبت زنده نتیجه، رده‌بندی و چاپ. مهمان هم می‌تواند شروع کند.",
  },
  {
    href: "/planner",
    icon: "👁️",
    title: "صفحه زنده تماشاگر",
    desc: "لینک اختصاصی کوتاه برای تیم‌ها و تماشاگران؛ فقط مشاهده برنامه، جدول و براکت تا فینال.",
  },
  {
    href: "/planner",
    icon: "📝",
    title: "ثبت‌نام آنلاین تیم‌ها",
    desc: "لینک ثبت‌نام رایگان بسازید؛ تیم‌ها فرم می‌فرستند و شما تأیید یا رد می‌کنید.",
  },
  {
    href: "/teams",
    icon: "👕",
    title: "کتابخانه تیم و بازیکن",
    desc: "فهرست تیم، پیراهن یکتا، کد ملی اختیاری، و استفاده دوباره در برنامه‌ریز بدون بازنویسی نام‌ها.",
  },
  {
    href: "/panel?tab=clubs",
    icon: "🏟️",
    title: "باشگاه",
    desc: "باشگاه بسازید، تیم و مربی وصل کنید، عضو دعوت کنید و صفحه عمومی باشگاه را منتشر کنید.",
  },
  {
    href: "/panel",
    icon: "📊",
    title: "پنل برگزارکننده",
    desc: "مسابقات ذخیره‌شده، ثبت‌نام‌ها، باشگاه‌ها و گزارش خلاصه در یک داشبورد.",
  },
  {
    href: "/explore",
    icon: "🔍",
    title: "جامعه ورزشی",
    desc: "جست‌وجوی مسابقات، تیم‌ها، باشگاه‌ها و بازیکنان عمومی. دنبال کنید تا اعلان نتیجه بگیرید.",
  },
  {
    href: "/services",
    icon: "🛠️",
    title: "خدمات NexSport",
    desc: "تبلیغ مسابقه، معرفی باشگاه، آموزش، مربی، مشاور و خدمات مرتبط. اولین آگهی رایگان است.",
  },
];

const FEATURES = [
  {
    icon: "📐",
    title: "الگوریتم دایره‌ای استاندارد",
    desc: "روش برگر تضمین می‌کند بازی تکراری ساخته نشود و میزبانی متعادل بماند.",
    accent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    icon: "🎲",
    title: "سیدبندی کاملاً اختیاری",
    desc: "قرعه تصادفی، چند سرگروه، یا سید کامل — هیچ‌کدام اجباری نیست.",
    accent: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    icon: <BracketSvgIcon className="w-7 h-7 text-blue-600" />,
    title: "براکت حذفی با Bye هوشمند",
    desc: "تعداد نامتوازن تیم‌ها را سیستم با استراحت عادلانه دور اول مدیریت می‌کند.",
    accent: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    icon: "📊",
    title: "نتیجه زنده و رده‌بندی لحظه‌ای",
    desc: "گل را وارد کنید؛ امتیاز، تفاضل و صعود در براکت همان لحظه به‌روز می‌شود.",
    accent: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    icon: "🔗",
    title: "لینک اختصاصی تماشاگر",
    desc: "صفحه فقط‌مشاهده برای داور، بازیکن و هوادار؛ ثبت نتیجه فقط دست برگزارکننده است.",
    accent: "bg-teal-50 text-teal-800 border-teal-200",
  },
  {
    icon: "📝",
    title: "ثبت‌نام رایگان تیم‌ها",
    desc: "لینک ثبت‌نام بدون تعرفه؛ ظرفیت، تأیید و رد از پنل برگزارکننده.",
    accent: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    icon: "👕",
    title: "تیم ذخیره‌شده در برنامه‌ریز",
    desc: "نام تایپ‌شده بازنویسی نمی‌شود؛ فقط خانه‌های خالی از کتابخانه پر می‌شوند.",
    accent: "bg-lime-50 text-lime-800 border-lime-200",
  },
  {
    icon: "📅",
    title: "تقویم شمسی",
    desc: "تاریخ‌ها در فرم‌ها و اعلان‌ها شمسی است؛ مناسب برگزارکننده ایرانی.",
    accent: "bg-orange-50 text-orange-800 border-orange-200",
  },
  {
    icon: "🖨️",
    title: "چاپ تمیز و خوانا",
    desc: "نسخه چاپی از صفحه اول شروع می‌شود؛ دکمه‌های اضافه در چاپ دیده نمی‌شوند.",
    accent: "bg-rose-50 text-rose-800 border-rose-200",
  },
  {
    icon: "🔔",
    title: "دنبال‌کردن و اعلان نتیجه",
    desc: "تماشاگر مسابقه را دنبال می‌کند؛ با هر به‌روزرسانی نتیجه، زنگوله خبر می‌دهد.",
    accent: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  {
    icon: "🏟️",
    title: "باشگاه و صفحه عمومی",
    desc: "ایجاد باشگاه رایگان است. صفحه عمومی، تیم‌ها و مربیان را به جامعه نشان می‌دهد.",
    accent: "bg-emerald-50 text-emerald-900 border-emerald-200",
  },
  {
    icon: "💬",
    title: "پشتیبانی با تیکت",
    desc: "از داخل حساب تیکت بزنید؛ پاسخ مدیر در همان گفتگو و با نشان خوانده‌نشده می‌آید.",
    accent: "bg-slate-100 text-slate-800 border-slate-200",
  },
];

const FAQS = [
  {
    q: "آیا برای ساخت برنامه مسابقه باید ثبت‌نام کنم؟",
    a: "خیر. مهمان می‌تواند برنامه بسازد، نتیجه ثبت کند و چاپ بگیرد. با حساب کاربری، مسابقه در ابر ذخیره می‌شود، کتابخانه تیم می‌سازید، باشگاه می‌زنید و از هر دستگاه برمی‌گردید.",
  },
  {
    q: "لینک تماشاگر با لینک ثبت‌نام چه فرقی دارد؟",
    a: "لینک تماشاگر صفحه زنده جدول و براکت است و فقط مشاهده می‌شود. لینک ثبت‌نام برای ارسال تیم به مسابقه است و همیشه رایگان است.",
  },
  {
    q: "تیم و بازیکن را کجا نگه می‌دارم؟",
    a: "در «تیم‌های من» فهرست تیم و بازیکن می‌سازید. شماره پیراهن در هر تیم یکتا است و کد ملی اختیاری است. همان تیم‌ها را در برنامه‌ریز و ثبت‌نام آنلاین صدا می‌کنید.",
  },
  {
    q: "باشگاه با حساب برگزارکننده فرق دارد؟",
    a: "بله. باشگاه برای مدیریت تیم، مربی و صفحه عمومی است و ساختنش رایگان است. پنل برگزارکننده برای مسابقات، ثبت‌نام و گزارش است.",
  },
  {
    q: "جامعه و خدمات برای کیست؟",
    a: "جست‌وجو، دنبال‌کردن مسابقه و دیدن صفحات عمومی تیم و بازیکن رایگان است. در خدمات می‌توانید آگهی مربی، آموزش یا تبلیغ مسابقه ثبت کنید؛ اولین آگهی فعال رایگان است.",
  },
  {
    q: "اگر تعداد تیم‌ها فرد باشد استراحت چه می‌شود؟",
    a: "الگوریتم برگر در هر هفته به یکی از تیم‌ها استراحت می‌دهد تا در پایان دور، تعداد بازی همه برابر باشد.",
  },
  {
    q: "خروجی چاپ و ذخیره چطور است؟",
    a: "پس از تولید برنامه می‌توانید نسخه چاپی تمیز بگیرید. مسابقه ذخیره‌شده از پنل یا برنامه‌ریز دوباره باز می‌شود.",
  },
];

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://nexsport.ir/#organization",
        name: "NexSport",
        url: "https://nexsport.ir",
        logo: {
          "@type": "ImageObject",
          url: "https://nexsport.ir/logo.png",
          width: 512,
          height: 512,
        },
        image: "https://nexsport.ir/og-image.png",
        description: "پلتفرم برنامه‌ریزی مسابقات، تیم، باشگاه و جامعه ورزشی",
      },
      {
        "@type": "WebSite",
        "@id": "https://nexsport.ir/#website",
        url: "https://nexsport.ir",
        name: "NexSport",
        description: "برنامه‌ریز مسابقات، کتابخانه تیم، باشگاه، جامعه و خدمات ورزشی",
        inLanguage: "fa-IR",
        publisher: { "@id": "https://nexsport.ir/#organization" },
      },
      {
        "@type": "SoftwareApplication",
        name: "NexSport",
        operatingSystem: "Web",
        applicationCategory: "SportsApplication",
        image: "https://nexsport.ir/og-image.png",
        offers: { "@type": "Offer", price: "0", priceCurrency: "IRR" },
        description:
          "ابزار آنلاین قرعه‌کشی و برگزاری مسابقات به‌همراه تیم، باشگاه، ثبت‌نام، صفحه تماشاگر، جامعه و خدمات ورزشی.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-pitch hover:opacity-95 transition-opacity shrink-0">
            <div className="relative flex items-center justify-center">
              <NexSportIcon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-sm" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-tight">
                Nex<span className="text-emerald-700">Sport</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider">پلتفرم هوشمند ورزش</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
            <Link href="/explore" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              جامعه
            </Link>
            <Link href="/services" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              خدمات
            </Link>
            <Link href="/teams" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              تیم‌ها
            </Link>
            <Link href="/panel" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              پنل
            </Link>
            <a href="#formats" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              فرمت‌ها
            </a>
            <a href="#faq" className="px-2.5 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              سوالات
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <AuthHeaderNav />
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-[#06281C] via-[#0B3B24] to-[#041F16] text-white py-16 sm:py-24 lg:py-28">
          <div className="absolute inset-0 bg-pitch-lines pointer-events-none opacity-40" />
          <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7 space-y-6 text-right">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-bold text-emerald-200 shadow-inner backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span>از جدول مسابقه تا باشگاه و جامعه ورزشی — یک سامانه</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[3.1rem] font-black leading-[1.3] text-white tracking-tight">
                  مسابقه برگزار کنید، تیم بسازید،{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                    در جامعه ورزشی دیده شوید
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed sm:leading-8 max-w-2xl">
                  NexSport فقط قرعه‌کشی نیست: برنامه لیگ و حذفی بسازید، نتیجه را زنده ثبت کنید، لینک تماشاگر بدهید،
                  ثبت‌نام رایگان بگیرید، کتابخانه تیم و باشگاه داشته باشید و مسابقات و خدمات را در جامعه پیدا کنید.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href="/planner"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-7 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    <span>ساخت برنامه مسابقه</span>
                    <span className="text-lg">⚡</span>
                  </Link>
                  <Link
                    href="/explore"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-all backdrop-blur-md"
                  >
                    <span>ورود به جامعه ورزشی</span>
                    <span>←</span>
                  </Link>
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-5 sm:gap-6 text-xs text-emerald-200/80 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>شروع بدون ثبت‌نام</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>ثبت‌نام تیم رایگان</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>صفحه زنده تماشاگر</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative rounded-2xl border border-emerald-500/30 bg-slate-950/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-xs font-black text-amber-300">جام قهرمانان NexSport</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      هفته سوم • زنده
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">ش</span>
                        <span className="font-bold text-white">شاهین تهران</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono font-black text-amber-300">
                        <span>۲</span>
                        <span className="text-white/30">:</span>
                        <span>۱</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">امید سپاهان</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/30">س</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 flex items-center justify-between text-xs sm:text-sm ring-1 ring-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-black text-xs">پ</span>
                        <span className="font-black text-emerald-300">پاس نوین</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 text-xs font-mono font-black text-emerald-400">
                        <span>۳</span>
                        <span className="text-white/30">:</span>
                        <span>۱</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">الوند مرکزی</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 font-black text-xs border border-purple-500/30">ا</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-emerald-500/15 p-3 flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      <div>
                        <span className="font-black text-amber-300 block">صدرنشین: پاس نوین</span>
                        <span className="text-[10px] text-white/70">۳ بازی • ۹ امتیاز • تفاضل +۴</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30">صعود</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border-b border-slate-200/80 shadow-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-pitch">۶</div>
                <div className="text-xs font-bold text-slate-500">فرمت مسابقاتی</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-emerald-700">رایگان</div>
                <div className="text-xs font-bold text-slate-500">ثبت‌نام آنلاین تیم‌ها</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-amber-700">زنده</div>
                <div className="text-xs font-bold text-slate-500">صفحه تماشاگر و رده‌بندی</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">یکجا</div>
                <div className="text-xs font-bold text-slate-500">تیم، باشگاه، جامعه، خدمات</div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-3.5 py-1 rounded-full border border-emerald-300/60">
              همه امکانات در یک سامانه
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">از قرعه‌کشی تا جامعه ورزشی</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              هر بخشی که ساخته‌ایم از همین صفحه باز می‌شود — بدون اکسل، بدون نصب.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="sport-card p-5 text-right space-y-2 hover:border-emerald-300 transition-colors"
              >
                <div className="text-2xl">{card.icon}</div>
                <h3 className="font-black text-slate-900">{card.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{card.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="formats" className="bg-white border-y border-slate-200/80 py-20 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-3.5 py-1 rounded-full border border-emerald-300/60">
                فرمت‌های مسابقه
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">شش ساختار استاندارد جهانی</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                از لیگ محلی تا جام رسمی — فرمت را انتخاب کنید و برنامه را در یک دقیقه بگیرید.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FORMATS.map((f) => (
                <div key={f.id} className={`sport-card flex flex-col justify-between p-6 ${f.borderTop}`}>
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg shrink-0 shadow-2xs border border-slate-200/80">
                          {f.icon}
                        </span>
                        <h3 className="font-black text-base sm:text-lg text-slate-900">{f.title}</h3>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${f.badgeColor}`}>{f.tag}</span>
                    </div>
                    <p className="text-xs leading-6 text-slate-600 mb-5">{f.desc}</p>
                    <ul className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                          <span className="text-emerald-700 font-bold text-xs shrink-0">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    href={`/planner?format=${f.id}`}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-800 hover:bg-pitch hover:text-white hover:border-pitch transition-all shadow-2xs"
                  >
                    <span>ساخت مسابقه با این فرمت</span>
                    <span>←</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-black text-amber-800 bg-amber-100/80 px-3.5 py-1 rounded-full border border-amber-300/60">ساده و سریع</span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">سه گام تا برنامه مسابقه</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { n: "۱", icon: "⚙️", title: "فرمت را انتخاب کنید", desc: "لیگ، رفت‌وبرگشت، گروهی، حذفی یا دو حذفی." },
                { n: "۲", icon: "👥", title: "تیم‌ها را وارد کنید", desc: "تایپ کنید یا از کتابخانه تیم‌های ذخیره‌شده پر کنید." },
                { n: "۳", icon: "📊", title: "نتیجه، لینک، چاپ", desc: "گل بزنید، لینک تماشاگر بدهید، ثبت‌نام باز کنید و چاپ بگیرید." },
              ].map((s) => (
                <div key={s.n} className="sport-card p-6 text-right space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-black text-lg border border-emerald-300/60">
                      {s.n}
                    </span>
                    <span className="text-2xl">{s.icon}</span>
                  </div>
                  <h3 className="font-black text-base text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-white border-y border-slate-200/80 py-20 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-black text-pitch bg-emerald-100/80 px-3.5 py-1 rounded-full border border-emerald-300/60">امکانات پیاده‌شده</span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">هر چیزی که روی سایت ساختیم</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                برای مربی، مدرسه فوتبال، باشگاه و برگزارکننده تورنمنت.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((item) => (
                <div key={item.title} className="sport-card p-6">
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl mb-4 border ${item.accent}`}>
                    {item.icon}
                  </span>
                  <h3 className="font-black text-base text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-xs leading-6 text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-slate-50 py-20 scroll-mt-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="text-xs font-black text-slate-700 bg-slate-200/80 px-3.5 py-1 rounded-full">سوالات متداول</span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">قبل از شروع</h2>
            </div>
            <div className="space-y-3.5">
              {FAQS.map((faq) => (
                <div key={faq.q} className="sport-card p-5">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-black text-xs shrink-0 mt-0.5">؟</span>
                    <span>{faq.q}</span>
                  </h3>
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-7 pr-7">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-[#06281C] via-[#0F5132] to-[#041F16] py-16 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-pitch-lines opacity-30 pointer-events-none" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">مسابقه بعدی را همین حالا بچینید</h2>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-xl mx-auto leading-relaxed">
              بدون نصب نرم‌افزار. برنامه را بسازید، بعد اگر خواستید تیم، باشگاه و صفحه تماشاگر را هم اضافه کنید.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/planner"
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-8 py-3.5 text-sm font-black text-slate-950 shadow-xl hover:from-amber-300"
              >
                شروع برنامه‌ریزی
              </Link>
              <Link href="/services" className="inline-flex items-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10">
                ثبت آگهی خدمت
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-12 items-start">
            <div className="md:col-span-5 space-y-3 text-right">
              <div className="flex items-center gap-2.5">
                <NexSportIcon className="w-8 h-8 shrink-0 drop-shadow-sm" />
                <span className="text-lg font-black text-white">NexSport</span>
              </div>
              <p className="text-xs text-slate-400 leading-6 max-w-md">
                پلتفرم برگزاری مسابقه، مدیریت تیم و باشگاه، جامعه ورزشی و خدمات مرتبط — از جدول تا تماشاگر.
              </p>
            </div>
            <div className="md:col-span-3 space-y-2 text-right">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">دسترسی</h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li><Link href="/planner" className="hover:text-emerald-300">برنامه‌ریز</Link></li>
                <li><Link href="/explore" className="hover:text-emerald-300">جامعه ورزشی</Link></li>
                <li><Link href="/services" className="hover:text-emerald-300">خدمات</Link></li>
                <li><Link href="/teams" className="hover:text-emerald-300">تیم‌های من</Link></li>
                <li><Link href="/panel" className="hover:text-emerald-300">پنل برگزارکننده</Link></li>
                <li><Link href="/panel?tab=clubs" className="hover:text-emerald-300">باشگاه‌ها</Link></li>
              </ul>
            </div>
            <div className="md:col-span-4 space-y-2 text-right">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">فرمت‌ها</h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {FORMATS.map((f) => (
                  <li key={f.id}>
                    <Link href={`/planner?format=${f.id}`} className="hover:text-amber-300">
                      {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-800/80 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} تمامی حقوق برای سامانه ورزشی NexSport محفوظ است.</p>
            <p className="text-slate-400">طراحی‌شده برای ورزشکاران و برگزارکنندگان ایرانی</p>
          </div>
        </div>
      </footer>
    </>
  );
}
