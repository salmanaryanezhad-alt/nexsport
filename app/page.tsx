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
    accentColor: "from-emerald-500 to-emerald-700",
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
    accentColor: "from-amber-500 to-amber-700",
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
    accentColor: "from-blue-500 to-blue-700",
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
    accentColor: "from-purple-500 to-purple-700",
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
    accentColor: "from-rose-500 to-rose-700",
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
    accentColor: "from-teal-500 to-teal-700",
    borderTop: "border-t-4 border-teal-500",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
    desc: "هیچ تیمی با یک شکست حذف نمی‌شود! بازنده‌ها به جدول شانس مجدد (Losers Bracket) می‌روند و فینال بین قهرمانان دو جدول برگزار می‌شود.",
    bullets: ["جدول دوگانه برندگان و شانس مجدد", "تعیین دقیق مقام‌های اول تا سوم", "امکان فینال مجدد (Bracket Reset)"],
  },
];

const FEATURES = [
  {
    icon: "📐",
    title: "الگوریتم دایره‌ای استاندارد (Berger Method)",
    desc: "دیگر نگران بازی تکراری یا جا افتادن مسابقه تیم‌ها نباشید. الگوریتم ما از نظر ریاضی تضمین می‌کند جدول کاملاً عادلانه چیده شود.",
    accent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    icon: "🎲",
    title: "سیدبندی کاملاً اختیاری و منعطف",
    desc: "برخلاف برنامه‌های دیگر، در NexSport مجبور به سیدبندی اجباری نیستید. می‌توانید همه‌چیز را تصادفی بگذارید یا فقط چند سرگروه شاخص انتخاب کنید.",
    accent: "bg-amber-50 text-amber-800 border-amber-200",
  },
  {
    icon: <BracketSvgIcon className="w-7 h-7 text-blue-600" />,
    title: "براکت حذفی با تقسیم هوشمند Bye",
    desc: "اگر تعداد تیم‌هایتان توان ۲ نباشد (مثلاً ۱۰ یا ۱۳ تیم)، سیستم به طور عادلانه به تیم‌های برتر استراحت دور اول می‌دهد.",
    accent: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    icon: "📊",
    title: "ثبت زنده گل‌ها و جدول رده‌بندی لحظه‌ای",
    desc: "گل‌های هر بازی را وارد کنید تا جدول لیگ (امتیاز، تفاضل، گل زده و خورده) به طور زنده و لحظه‌ای به‌روزرسانی شود.",
    accent: "bg-purple-50 text-purple-800 border-purple-200",
  },
  {
    icon: "📋",
    title: "اشتراک‌گذاری در پیام‌رسان‌ها (تلگرام و ایتا)",
    desc: "با یک کلیک متن خوانا و مرتب برنامه هفتگی مسابقات را کپی کرده و در گروه‌های تلگرامی و پیام‌رسان تیم‌ها بفرستید.",
    accent: "bg-teal-50 text-teal-800 border-teal-200",
  },
  {
    icon: "🖨️",
    title: "نسخه چاپی جدولی، تمیز و خروجی PDF",
    desc: "جدول بازی‌ها را بدون به‌هم‌ریختگی و بدون شکستگی مرز صفحات چاپ کنید یا در قالب فایل اکسل دانلود نمایید.",
    accent: "bg-rose-50 text-rose-800 border-rose-200",
  },
];

const FAQS = [
  {
    q: "آیا برای استفاده از برنامه‌ریز مسابقات NexSport باید ثبت‌نام کنم؟",
    a: "خیر! استفاده از تمامی امکانات NexSport (تولید برنامه مسابقات، جدول رده‌بندی، چاپ و خروجی اکسل) بدون نیاز به ثبت‌نام و کاملاً رایگان است. در عین حال با ایجاد حساب کاربری می‌توانید مسابقات خود را در فضای ابری ذخیره کرده و از هر دستگاهی به آنها دسترسی داشته باشید.",
  },
  {
    q: "تفاوت لیگ دوره‌ای با مسابقات گروهی چیست؟",
    a: "در لیگ دوره‌ای، همه تیم‌ها در یک جدول واحد با یکدیگر مسابقه می‌دهند و بر اساس مجموع امتیازات قهرمان مشخص می‌شود. اما در مرحله گروهی، ابتدا تیم‌ها به چند گروه تفکیک می‌شوند و پس از رقابت درون‌گروهی، تیم‌های برتر به مرحله حذفی راه می‌یابند.",
  },
  {
    q: "اگر تعداد تیم‌ها فرد باشد، سیستم استراحت را چطور مدیریت می‌کند؟",
    a: "الگوریتم برگر هوشمند ما به صورت خودکار در هر هفته به یکی از تیم‌ها استراحت (Bye) می‌دهد؛ به نحوی که در انتهای دور رفت، تمام تیم‌ها دقیقاً یک بار استراحت کرده باشند و تعداد بازی‌های همه تیم‌ها کاملاً برابر باشد.",
  },
  {
    q: "آیا می‌توانم نتیجه بازی‌ها را ثبت کنم و جدول رده‌بندی داشته باشم؟",
    a: "بله! پس از تولید برنامه، می‌توانید گل‌های هر مسابقه را ثبت کنید. سیستم به صورت خودکار جدول امتیازات، برد، باخت، مساوی و تفاضل گل را محاسبه می‌کند و در مسابقات حذفی نیز تیم برنده را خودکار به دور بعد می‌برد.",
  },
  {
    q: "این ابزار برای چه رشته‌های ورزشی مناسب است؟",
    a: "NexSport برای تمامی مسابقات ورزشی از جمله فوتبال، فوتسال، والیبال، بسکتبال، پینگ‌پنگ، بدمینتون، شطرنج، تنیس و حتی تورنمنت‌های بازی‌های ویدیویی (FIFA، PES، Call of Duty) کاملاً کاربردی و قابل استفاده است.",
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
        description: "سامانه آنلاین و رایگان قرعه‌کشی و برنامه‌ریزی مسابقات ورزشی",
      },
      {
        "@type": "WebSite",
        "@id": "https://nexsport.ir/#website",
        url: "https://nexsport.ir",
        name: "NexSport",
        description: "سامانه آنلاین و رایگان قرعه‌کشی و برنامه‌ریزی مسابقات ورزشی",
        inLanguage: "fa-IR",
        publisher: {
          "@id": "https://nexsport.ir/#organization",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "NexSport Tournament Planner",
        operatingSystem: "Web",
        applicationCategory: "SportsApplication",
        image: "https://nexsport.ir/og-image.png",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "IRR",
        },
        description:
          "ابزار آنلاین قرعه‌کشی مسابقات فوتبال و تورنمنت‌های ورزشی، تولید جدول لیگ و براکت حذفی بدون بازی تکراری همراه با خروجی اکسل و PDF.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* NAVBAR */}
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
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider">
                سامانه هوشمند مسابقات
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
            <a href="#formats" className="px-3 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              فرمت‌های مسابقات
            </a>
            <a href="#features" className="px-3 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              امکانات کلیدی
            </a>
            <a href="#how-it-works" className="px-3 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              نحوه کار
            </a>
            <a href="#faq" className="px-3 py-1.5 rounded-lg hover:bg-white hover:text-pitch transition-all">
              سوالات متداول
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <AuthHeaderNav />
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION WITH DYNAMIC STADIUM VIBE */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#06281C] via-[#0B3B24] to-[#041F16] text-white py-16 sm:py-24 lg:py-28">
          {/* Ambient Lighting & Field lines */}
          <div className="absolute inset-0 bg-pitch-lines pointer-events-none opacity-40" />
          <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left/Main Column */}
              <div className="lg:col-span-7 space-y-6 text-right">
                {/* Live Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/60 px-4 py-1.5 text-xs font-bold text-emerald-200 shadow-inner backdrop-blur-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span>برنامه‌ریز رسمی مسابقات ورزشی • ۱۰۰٪ رایگان</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-3xl sm:text-5xl lg:text-[3.1rem] font-black leading-[1.3] text-white tracking-tight">
                  برنامه‌ریزی و قرعه‌کشی مسابقات ورزشی؛{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                    سریع، دقیق و پرانرژی
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed sm:leading-8 max-w-2xl">
                  بدون دغدغه فرمول‌های اکسل و خطای انسانی، در کمتر از یک دقیقه برای مسابقات{" "}
                  <strong className="text-amber-300">فوتبال، فوتسال، والیبال</strong> یا تورنمنت‌های دوستانه
                  برنامه لیگ، مرحله گروهی یا براکت حذفی بسازید، نتایج را زنده ثبت کنید و نسخه چاپی بی‌نقص بگیرید.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href="/planner"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-7 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    <span>ساخت فوری برنامه مسابقات</span>
                    <span className="text-lg">⚡</span>
                  </Link>

                  <a
                    href="#formats"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-all backdrop-blur-md"
                  >
                    <span>مشاهده فرمت‌ها</span>
                    <span>↓</span>
                  </a>
                </div>

                {/* Trust Badges */}
                <div className="pt-4 flex flex-wrap items-center gap-5 sm:gap-6 text-xs text-emerald-200/80 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>الگوریتم بدون تکرار برگر</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>خروجی اکسل و نسخه چاپی A4</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px]">✓</span>
                    <span>رده‌بندی هوشمند و خودکار</span>
                  </div>
                </div>
              </div>

              {/* Right Column: High-Energy Stadium Matchday Mockup */}
              <div className="lg:col-span-5">
                <div className="relative rounded-2xl border border-emerald-500/30 bg-slate-950/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-xs font-black text-amber-300">جام قهرمانان NexSport</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                      هفته سوم • زنده
                    </span>
                  </div>

                  {/* Matches List */}
                  <div className="space-y-2.5">
                    {/* Match 1 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 font-black text-xs border border-emerald-500/30">
                          ش
                        </span>
                        <span className="font-bold text-white">شاهین تهران</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono font-black text-amber-300 shadow-inner">
                        <span>۲</span>
                        <span className="text-white/30">:</span>
                        <span>۱</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">امید سپاهان</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/30">
                          س
                        </span>
                      </div>
                    </div>

                    {/* Match 2 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between text-xs sm:text-sm hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 font-black text-xs border border-blue-500/30">
                          س
                        </span>
                        <span className="font-bold text-white">ستارگان آبی</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono font-black text-slate-300 shadow-inner">
                        <span>۰</span>
                        <span className="text-white/30">:</span>
                        <span>۰</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">عقاب جنوب</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300 font-black text-xs border border-rose-500/30">
                          ع
                        </span>
                      </div>
                    </div>

                    {/* Match 3 */}
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 flex items-center justify-between text-xs sm:text-sm ring-1 ring-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-slate-950 font-black text-xs">
                          پ
                        </span>
                        <span className="font-black text-emerald-300">پاس نوین</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-emerald-500/40 text-xs font-mono font-black text-emerald-400 shadow-inner">
                        <span>۳</span>
                        <span className="text-white/30">:</span>
                        <span>۱</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">الوند مرکزی</span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 font-black text-xs border border-purple-500/30">
                          ا
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Leader Standings Highlight */}
                  <div className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-emerald-500/15 p-3 flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      <div>
                        <span className="font-black text-amber-300 block">صدرنشین جدول: پاس نوین</span>
                        <span className="text-[10px] text-white/70">۳ بازی • ۹ امتیاز • تفاضل +۴</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30">
                      صعود قطعی
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* METRICS & QUICK STATS BAR */}
        <section className="bg-white border-b border-slate-200/80 shadow-xs">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-pitch font-mono">+۱۰,۰۰۰</div>
                <div className="text-xs font-bold text-slate-500">مسابقه برنامه‌ریزی‌شده</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">۱۰۰٪</div>
                <div className="text-xs font-bold text-slate-500">الگوریتم بدون خطای ریاضی</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">۶</div>
                <div className="text-xs font-bold text-slate-500">فرمت مسابقاتی استاندارد جهانی</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">رایگان</div>
                <div className="text-xs font-bold text-slate-500">بدون نیاز به پرداخت و ثبت‌نام</div>
              </div>
            </div>
          </div>
        </section>

        {/* FORMATS SHOWCASE */}
        <section id="formats" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-black text-emerald-800 bg-emerald-100/80 px-3.5 py-1 rounded-full uppercase tracking-wider border border-emerald-300/60">
              انعطاف‌پذیری نامحدود مسابقات
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              پشتیبانی از تمامی ساختارها و فرمت‌های ورزشی
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              چه یک لیگ محلی ۴ نفره داشته باشید و چه تورنمنت بزرگ ۶۴ تیمی، NexSport دقیق‌ترین الگوریتم
              را برای شما اجرا می‌کند. فرمت مورد نظر خود را انتخاب کنید:
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((f) => (
              <div
                key={f.id}
                className={`sport-card flex flex-col justify-between p-6 ${f.borderTop}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg shrink-0 shadow-2xs border border-slate-200/80">
                        {f.icon}
                      </span>
                      <h3 className="font-black text-base sm:text-lg text-slate-900">{f.title}</h3>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${f.badgeColor}`}
                    >
                      {f.tag}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-slate-600 mb-5">{f.desc}</p>

                  <ul className="space-y-2 mb-6 border-t border-slate-100 pt-4">
                    {f.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                        <span className="text-emerald-700 font-bold text-xs shrink-0">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={`/planner?format=${f.id}`}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-800 hover:bg-pitch hover:text-white hover:border-pitch transition-all shadow-2xs group"
                >
                  <span>ساخت مسابقه با این فرمت</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">←</span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="bg-white border-y border-slate-200/80 py-20 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-black text-amber-800 bg-amber-100/80 px-3.5 py-1 rounded-full uppercase tracking-wider border border-amber-300/60">
                ساده و سریع
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
                تنها ۳ گام تا ساخت برنامه مسابقات
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                بدون نیاز به دانش ریاضی یا فرمول‌های سخت، جدول مسابقات خود را در لحظه تحویل بگیرید.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="sport-card p-6 text-right space-y-4 relative">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-black text-lg border border-emerald-300/60">
                    ۱
                  </span>
                  <span className="text-2xl">⚙️</span>
                </div>
                <h3 className="font-black text-base text-slate-900">انتخاب فرمت مسابقه</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  از بین ۶ فرمت استاندارد (لیگ، رفت‌وبرگشت، گروهی، حذفی، دو حذفی)، ساختار مورد نظر خود را انتخاب کنید.
                </p>
              </div>

              <div className="sport-card p-6 text-right space-y-4 relative">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 font-black text-lg border border-amber-300/60">
                    ۲
                  </span>
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="font-black text-base text-slate-900">وارد کردن اسامی تیم‌ها</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  تیم‌های مسابقه را تایپ کرده یا کل فهرست را یکجا پیست کنید. در صورت تمایل سرگروه‌ها را مشخص کنید.
                </p>
              </div>

              <div className="sport-card p-6 text-right space-y-4 relative">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-800 font-black text-lg border border-purple-300/60">
                    ۳
                  </span>
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="font-black text-base text-slate-900">دریافت برنامه، ثبت نتایج و چاپ</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  برنامه مسابقات، تاریخ و زمین‌ها را تحویل بگیرید، گل‌ها را وارد کنید و نسخه چاپی A4 یا فایل اکسل را ذخیره نمایید.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="py-20 scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
              <span className="text-xs font-black text-pitch bg-emerald-100/80 px-3.5 py-1 rounded-full uppercase tracking-wider border border-emerald-300/60">
                امکانات هوشمند و بی‌رقیب
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
                چرا برگزارکنندگان حرفه‌ای NexSport را انتخاب می‌کنند؟
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                طراحی‌شده برای مربیان، مدارس فوتبال، مدیران سالن‌های ورزشی و برگزارکنندگان تورنمنت‌های کشوری.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((item, idx) => (
                <div
                  key={idx}
                  className="sport-card p-6 flex flex-col justify-between"
                >
                  <div>
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl mb-4 border ${item.accent}`}>
                      {item.icon}
                    </span>
                    <h3 className="font-black text-base text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-xs leading-6 text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="bg-slate-50 border-t border-slate-200/80 py-20 scroll-mt-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="text-xs font-black text-slate-700 bg-slate-200/80 px-3.5 py-1 rounded-full uppercase tracking-wider">
                پاسخ به سوالات متداول
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                سوالات متداول برگزارکنندگان
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                پاسخ پرتکرارترین پرسش‌ها درباره نحوه تولید جدول و قرعه‌کشی مسابقات.
              </p>
            </div>

            <div className="space-y-3.5">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="sport-card p-5">
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

        {/* FINAL CTA BANNER */}
        <section className="bg-gradient-to-br from-[#06281C] via-[#0F5132] to-[#041F16] py-16 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-pitch-lines opacity-30 pointer-events-none" />
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
              آماده‌اید مسابقات خود را بدون دغدغه و حرفه‌ای برگزار کنید؟
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-xl mx-auto leading-relaxed">
              همین حالا و بدون نیاز به نصب هیچ نرم‌افزاری، اولین جدول مسابقات خود را در سامانه NexSport بسازید.
            </p>
            <div className="pt-2">
              <Link
                href="/planner"
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 px-8 py-3.5 text-sm sm:text-base font-black text-slate-950 shadow-xl shadow-amber-500/25 hover:from-amber-300 hover:to-amber-400 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>شروع رایگان برنامه‌ریزی مسابقات</span>
                <span className="text-lg">⚡</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-12 items-start">
            <div className="md:col-span-6 space-y-3 text-right">
              <div className="flex items-center gap-2.5">
                <NexSportIcon className="w-8 h-8 shrink-0 drop-shadow-sm" />
                <span className="text-lg font-black text-white">NexSport</span>
              </div>
              <p className="text-xs text-slate-400 leading-6 max-w-md">
                NexSport پلتفرم هوشمند مدیریت و برنامه‌ریزی مسابقات ورزشی است. هدف ما حذف پیچیدگی‌های
                قرعه‌کشی، جدول‌بندی و ثبت نتایج برای مدارس فوتبال، سالن‌ها و برگزارکنندگان تورنمنت‌ها
                می‌باشد.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2 text-right">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">دسترسی سریع</h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li>
                  <Link href="/planner" className="hover:text-emerald-300 transition-colors">
                    برنامه‌ریز مسابقات
                  </Link>
                </li>
                <li>
                  <a href="#formats" className="hover:text-emerald-300 transition-colors">
                    فرمت‌های پشتیبانی‌شده
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-emerald-300 transition-colors">
                    امکانات و مزایا
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-emerald-300 transition-colors">
                    سوالات متداول
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2 text-right">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">فرمت‌های مسابقه</h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li>
                  <Link href="/planner?format=league" className="hover:text-amber-300 transition-colors">
                    لیگ دوره‌ای (تک‌دور)
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=double-league" className="hover:text-amber-300 transition-colors">
                    لیگ رفت و برگشت
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=groups" className="hover:text-amber-300 transition-colors">
                    مرحله گروهی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=groups-knockout" className="hover:text-amber-300 transition-colors">
                    گروهی + براکت حذفی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=knockout" className="hover:text-amber-300 transition-colors">
                    براکت تک‌حذفی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=double-knockout" className="hover:text-amber-300 transition-colors">
                    تورنمنت دو حذفی
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-800/80 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} تمامی حقوق برای سامانه ورزشی NexSport محفوظ است.</p>
            <p className="text-slate-400">طراحی‌شده با عشق برای ورزشکاران و برگزارکنندگان ایرانی 🇮🇷</p>
          </div>
        </div>
      </footer>
    </>
  );
}
