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
    desc: "هر تیم دقیقاً یک‌بار با سایر تیم‌ها بازی می‌کند. مبتنی بر الگوریتم استاندارد برگر که از نظر ریاضی تضمین می‌کند هیچ بازی تکراری ایجاد نشود.",
    bullets: ["بدون مسابقه تکراری", "توازن میزبانی و میهمانی", "محاسبه خودکار استراحت (Bye) برای تیم‌های فرد"],
    badgeColor: "bg-pitch/10 text-pitch border-pitch/30",
  },
  {
    id: "double-league",
    title: "لیگ رفت و برگشت",
    icon: "🔄",
    tag: "استاندارد حرفه‌ای",
    desc: "هر دو تیم دو بار، یک‌بار در زمین خود و یک‌بار در زمین حریف به مصاف هم می‌روند. نیم‌فصل اول و دوم به طور منظم تفکیک می‌شوند.",
    bullets: ["تفکیک بازی‌های رفت و برگشت", "تضمین دو بازی برای هر زوج", "تولید تقویم منظم هفتگی"],
    badgeColor: "bg-gold/15 text-gold-dark border-gold/40",
  },
  {
    id: "groups",
    title: "مرحله گروهی",
    icon: "👥",
    tag: "سیدبندی اختیاری",
    desc: "تقسیم تیم‌ها به ۲ تا ۳۲ گروه به صورت کاملاً تصادفی یا با تعیین سرگروه‌ها و تیم‌های شاخص دلخواه شما.",
    bullets: ["سیدبندی کاملاً اختیاری", "تعداد سرگروه کمتر یا مساوی تعداد گروه", "توازن خودکار تعداد تیم‌ها در گروه‌ها"],
    badgeColor: "bg-pitch/10 text-pitch border-pitch/30",
  },
  {
    id: "groups-knockout",
    title: "گروهی + براکت حذفی",
    icon: "🏆",
    tag: "جام‌های رسمی",
    desc: "مسابقات با مرحله گروهی آغاز شده و تیم‌های اول و دوم با سیستم ضربدری کلاسیک (مثل جام جهانی) وارد براکت حذفی می‌شوند.",
    bullets: ["عدم برخورد تیم‌های هم‌گروه تا فینال", "جدول ضربدری صعودکنندگان", "براکت حذفی شکیل تا تعیین قهرمان"],
    badgeColor: "bg-gold/15 text-gold-dark border-gold/40",
  },
  {
    id: "knockout",
    title: "براکت تک‌حذفی",
    icon: <BracketSvgIcon className="w-5 h-5 text-brick" />,
    tag: "جام حذفی",
    desc: "براکت تک‌حذفی استاندارد با مدیریت خودکار تعداد تیم‌های نامتوازن (پشتیبانی کامل از قرعه‌های استراحت / Bye).",
    bullets: ["سیدبندی ۱ تا ۴ در ۴ بخش جداگانه", "صعود مستقیم تیم‌های برتر با Bye", "صعود خودکار برنده با ثبت نتیجه"],
    badgeColor: "bg-brick/10 text-brick border-brick/30",
  },
  {
    id: "double-knockout",
    title: "جدول دو حذفی (Double Elimination)",
    icon: "🛡️",
    tag: "ویژه مدارس و المپیادها",
    desc: "هیچ تیمی با یک شکست حذف نمی‌شود! بازنده‌ها به جدول شانس مجدد (Losers Bracket) می‌روند و فینال بین قهرمانان دو جدول برگزار می‌شود.",
    bullets: ["جدول دوگانه برندگان و شانس مجدد", "تعیین دقیق مقام‌های اول تا سوم", "امکان فینال مجدد (Bracket Reset)"],
    badgeColor: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
];

const FEATURES = [
  {
    icon: "📐",
    title: "الگوریتم دایره‌ای استاندارد (Berger Method)",
    desc: "دیگر نگران بازی تکراری یا جا افتادن مسابقه تیم‌ها نباشید. الگوریتم ما از نظر ریاضی تضمین می‌کند جدول کاملاً عادلانه چیده شود.",
  },
  {
    icon: "🎲",
    title: "سیدبندی کاملاً اختیاری و منعطف",
    desc: "برخلاف برنامه‌های دیگر، در NexSport مجبور به سیدبندی اجباری نیستید. می‌توانید همه‌چیز را تصادفی بگذارید یا فقط چند سرگروه شاخص انتخاب کنید.",
  },
  {
    icon: <BracketSvgIcon className="w-7 h-7 text-pitch" />,
    title: "براکت حذفی با تقسیم هوشمند Bye",
    desc: "اگر تعداد تیم‌هایتان توان ۲ نباشد (مثلاً ۱۰ یا ۱۳ تیم)، سیستم به طور عادلانه به تیم‌های برتر استراحت دور اول می‌دهد.",
  },
  {
    icon: "📊",
    title: "ثبت زنده گل‌ها و جدول رده‌بندی لحظه‌ای",
    desc: "گل‌های هر بازی را وارد کنید تا جدول لیگ (امتیاز، تفاضل، گل زده و خورده) به طور زنده و لحظه‌ای به‌روزرسانی شود.",
  },
  {
    icon: "📋",
    title: "اشتراک‌گذاری در پیام‌رسان‌ها (تلگرام و واتس‌اپ)",
    desc: "با یک کلیک متن خوانا و مرتب برنامه هفتگی مسابقات را کپی کرده و در گروه‌های تلگرامی و پیام‌رسان تیم‌ها بفرستید.",
  },
  {
    icon: "📥",
    title: "خروجی استاندارد اکسل (CSV) و چاپ / PDF",
    desc: "جدول بازی‌ها را در قالب فایل اکسل با فونت فارسی سالم دانلود کنید یا با کلیک روی پرینت، خروجی PDF تمیز بگیرید.",
  },
];

const FAQS = [
  {
    q: "آیا برای استفاده از برنامه‌ریز مسابقات NexSport باید ثبت‌نام کنم؟",
    a: "خیر! استفاده از تمامی امکانات NexSport (تولید برنامه مسابقات، جدول رده‌بندی، چاپ و خروجی اکسل) بدون نیاز به ثبت‌نام و کاملاً رایگان است. در عین حال با ایجاد حساب کاربری می‌توانید مسابقات خود را در فضای ابری ذخیره کرده و از هر دستگاهی به آنها دسترسی داشته باشید.",
  },
  {
    q: "چگونه مطمئن شوم هیچ مسابقه تکراری در لیگ ایجاد نمی‌شود؟",
    a: "موتور برنامه‌ریزی NexSport از الگوریتم استاندارد جهانی Circle Method (روش دوره‌ای برگر) استفاده می‌کند. این الگوریتم تضمین ریاضی می‌دهد که هر تیم دقیقاً یک‌بار (یا در رفت‌وبرگشت، دقیقاً دو بار با جابه‌جایی میزبان) مقابل هر حریف قرار بگیرد.",
  },
  {
    q: "اگر تعداد تیم‌ها فرد باشد یا در مرحله حذفی به توان ۲ نرسد چه اتفاقی می‌افتد؟",
    a: "در لیگ با تعداد تیم فرد، سیستم به صورت خودکار در هر هفته یک بازی استراحت (Bye) به صورت چرخشی به تیم‌ها اختصاص می‌دهد. در مسابقات حذفی نیز جایگاه‌های خالی به صورت استراحت مستقیم برای تیم‌های برتر در نظر گرفته می‌شوند.",
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
  // Structured Data (JSON-LD) for Google SEO Rich Snippets & Knowledge Graph
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
      <header className="sticky top-0 z-50 border-b border-line/70 bg-chalk/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4">
          <Link href="/" className="flex items-center gap-2 text-pitch hover:opacity-90 transition-opacity shrink-0">
            <NexSportIcon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-xs" />
            <span className="text-lg sm:text-xl font-black tracking-tight text-ink">NexSport</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-ink/75">
            <a href="#formats" className="hover:text-pitch transition-colors">
              فرمت‌های مسابقات
            </a>
            <a href="#features" className="hover:text-pitch transition-colors">
              امکانات کلیدی
            </a>
            <a href="#how-it-works" className="hover:text-pitch transition-colors">
              نحوه کار
            </a>
            <a href="#faq" className="hover:text-pitch transition-colors">
              سوالات متداول
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <AuthHeaderNav />
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-pitch text-chalk py-20 md:py-28">
          <div className="absolute inset-0 bg-pitch-lines pointer-events-none opacity-60" />
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-pitch-light/30 blur-3xl pointer-events-none" />

          <div className="relative mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
              {/* Left/Main Column */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-pitch-dark/80 px-3.5 py-1.5 text-xs text-gold-light backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
                  <span>برنامه‌ریز ۱۰۰٪ رایگان و بدون نیاز به ثبت‌نام</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[2.9rem] font-black leading-[1.3] text-chalk">
                  برنامه‌ریزی و قرعه‌کشی مسابقات ورزشی؛{" "}
                  <span className="text-gold-light underline decoration-gold/40 decoration-wavy underline-offset-8">
                    سریع، دقیق و بدون خطا
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-chalk/80 leading-8">
                  دیگر نیازی به اکسل یا محاسبات دستی پیچیده نیست! برای مسابقات{" "}
                  <strong>فوتبال، فوتسال، والیبال</strong> یا تورنمنت‌های دوستانه در کمتر از ۱ دقیقه
                  جدول استاندارد لیگ، گروهی یا براکت حذفی بسازید، نتایج را ثبت کنید و خروجی اکسل یا
                  PDF بگیرید.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/planner"
                    className="inline-flex items-center gap-2 rounded-lg bg-gold px-7 py-3.5 text-base font-bold text-ink shadow-lg shadow-gold/20 hover:bg-gold-light transition-all transform hover:-translate-y-0.5"
                  >
                    <span>ساخت برنامه مسابقات (رایگان)</span>
                    <span>⚡</span>
                  </Link>

                  <a
                    href="#formats"
                    className="inline-flex items-center rounded-lg border border-chalk/25 bg-pitch-dark/50 px-5 py-3.5 text-sm font-semibold text-chalk hover:bg-pitch-dark transition-colors"
                  >
                    مشاهده انواع فرمت‌ها ↓
                  </a>
                </div>

                {/* Trust Badges */}
                <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-chalk/70 border-t border-chalk/10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gold">✓</span>
                    <span>بدون بازی تکراری (الگوریتم برگر)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gold">✓</span>
                    <span>خروجی استاندارد اکسل و PDF</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gold">✓</span>
                    <span>ثبت زنده نتایج و رده‌بندی</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Scoreboard Mockup */}
              <div className="lg:col-span-5">
                <div className="relative rounded-2xl border border-chalk/15 bg-pitch-dark/70 p-6 backdrop-blur-md shadow-2xl">
                  <div className="flex items-center justify-between border-b border-chalk/10 pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-brick" />
                      <span className="h-3 w-3 rounded-full bg-gold" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-xs font-semibold text-gold-light bg-gold/10 px-2.5 py-1 rounded-full border border-gold/20">
                      هفته اول مسابقات لیگ
                    </span>
                  </div>

                  {/* Match cards */}
                  <div className="space-y-3">
                    <div className="rounded-xl border border-chalk/10 bg-chalk/5 p-3.5 flex items-center justify-between text-sm">
                      <span className="font-bold text-chalk">شاهین تهران</span>
                      <div className="flex items-center gap-2 px-3 py-1 rounded bg-pitch-dark/90 text-xs font-mono font-bold text-gold">
                        <span>۲</span>
                        <span className="text-chalk/40">:</span>
                        <span>۱</span>
                      </div>
                      <span className="font-bold text-chalk">امید سپاهان</span>
                    </div>

                    <div className="rounded-xl border border-chalk/10 bg-chalk/5 p-3.5 flex items-center justify-between text-sm">
                      <span className="font-bold text-chalk">ستارگان آبی</span>
                      <div className="flex items-center gap-2 px-3 py-1 rounded bg-pitch-dark/90 text-xs font-mono font-bold text-chalk/70">
                        <span>۰</span>
                        <span className="text-chalk/40">:</span>
                        <span>۰</span>
                      </div>
                      <span className="font-bold text-chalk">عقاب جنوب</span>
                    </div>

                    <div className="rounded-xl border border-chalk/10 bg-chalk/5 p-3.5 flex items-center justify-between text-sm">
                      <span className="font-bold text-chalk">پاس نوین</span>
                      <div className="flex items-center gap-2 px-3 py-1 rounded bg-pitch-dark/90 text-xs font-mono font-bold text-gold">
                        <span>۳</span>
                        <span className="text-chalk/40">:</span>
                        <span>۱</span>
                      </div>
                      <span className="font-bold text-chalk">الوند مرکزی</span>
                    </div>
                  </div>

                  {/* Standings Snippet */}
                  <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 p-3 flex items-center justify-between text-xs text-chalk">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏆</span>
                      <span className="font-bold text-gold-light">صدرنشین: پاس نوین</span>
                    </div>
                    <span className="text-chalk/80 font-mono font-bold">۳ امتیاز (+۲ تفاضل)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FORMATS SHOWCASE */}
        <section id="formats" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-gold-dark bg-gold/15 px-3 py-1 rounded-full uppercase tracking-wider">
              انعطاف‌پذیری نامحدود
            </span>
            <h2 className="text-3xl font-black text-ink">پشتیبانی از تمامی فرمت‌های مسابقات</h2>
            <p className="text-sm text-ink/70 leading-7">
              چه یک لیگ محلی ۴ نفره داشته باشید و چه تورنمنت بزرگ ۶۴ تیمی، NexSport دقیق‌ترین الگوریتم
              را برای شما اجرا می‌کند.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((f) => (
              <div
                key={f.id}
                className="flex flex-col justify-between rounded-xl border border-line bg-white p-6 shadow-sm hover:border-pitch/50 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-pitch/10 text-base shrink-0">
                        {f.icon}
                      </span>
                      <h3 className="font-bold text-lg text-pitch">{f.title}</h3>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${f.badgeColor}`}
                    >
                      {f.tag}
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-ink/70 mb-5">{f.desc}</p>

                  <ul className="space-y-2 mb-6 border-t border-line/60 pt-4">
                    {f.bullets.map((b, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-ink/80">
                        <span className="text-pitch font-bold">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={`/planner?format=${f.id}`}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-pitch bg-pitch/5 py-2.5 text-xs font-bold text-pitch hover:bg-pitch hover:text-chalk transition-colors"
                >
                  ساخت مسابقه با این فرمت ←
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES GRID */}
        <section id="features" className="bg-chalk/60 border-y border-line py-20 scroll-mt-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold text-pitch bg-pitch/10 px-3 py-1 rounded-full uppercase tracking-wider">
                امکانات هوشمند
              </span>
              <h2 className="text-3xl font-black text-ink">چرا NexSport بهترین انتخاب برگزارکنندگان است؟</h2>
              <p className="text-sm text-ink/70 leading-7">
                ساخته‌شده برای مربیان، مدارس فوتبال، مدیران سالن‌های ورزشی و برگزارکنندگان مسابقات حرفه‌ای.
              </p>
            </div>

            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-line bg-white p-6 shadow-sm hover:border-pitch/40 transition-colors"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-pitch/10 text-2xl mb-4">
                    {item.icon}
                  </span>
                  <h3 className="font-bold text-base text-pitch mb-2">{item.title}</h3>
                  <p className="text-xs leading-6 text-ink/70">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold text-gold-dark bg-gold/15 px-3 py-1 rounded-full uppercase tracking-wider">
              ساده و سریع
            </span>
            <h2 className="text-3xl font-black text-ink">در ۳ مرحله برنامه مسابقات خود را بسازید</h2>
            <p className="text-sm text-ink/70 leading-7">
              بدون نیاز به آموزش، در چند کلیک ساده به خروجی کامل برسید.
            </p>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3 relative">
            <div className="rounded-xl border border-line bg-white p-6 shadow-sm relative">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pitch text-chalk font-black text-sm mb-4">
                ۱
              </span>
              <h3 className="font-bold text-base text-pitch mb-2">انتخاب فرمت و تعداد تیم‌ها</h3>
              <p className="text-xs text-ink/70 leading-6">
                نوع مسابقه (لیگ، گروهی، حذفی) و تعداد شرکت‌کنندگان را مشخص کنید.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-white p-6 shadow-sm relative">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink font-black text-sm mb-4">
                ۲
              </span>
              <h3 className="font-bold text-base text-pitch mb-2">نام‌گذاری و سیدبندی (اختیاری)</h3>
              <p className="text-xs text-ink/70 leading-6">
                اسامی تیم‌ها را وارد کنید و در صورت تمایل، سرگروه‌ها را برای جلوگیری از برخورد تعیین کنید.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-white p-6 shadow-sm relative">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pitch text-chalk font-black text-sm mb-4">
                ۳
              </span>
              <h3 className="font-bold text-base text-pitch mb-2">دریافت برنامه، چاپ و ثبت نتایج</h3>
              <p className="text-xs text-ink/70 leading-6">
                برنامه را به صورت PDF یا اکسل دریافت کنید، گل‌ها را ثبت کنید یا برای پیام‌رسان‌ها کپی کنید.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/planner"
              className="inline-flex items-center gap-2 rounded-lg bg-pitch px-8 py-3.5 text-base font-bold text-chalk shadow-md hover:bg-pitch-light transition-colors"
            >
              <span>ورود به برنامه‌ریز مسابقات</span>
              <span className="text-gold">←</span>
            </Link>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="bg-chalk/60 border-t border-line py-20 scroll-mt-20">
          <div className="mx-auto max-w-4xl px-6">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
              <span className="text-xs font-bold text-pitch bg-pitch/10 px-3 py-1 rounded-full uppercase tracking-wider">
                پاسخ به سوالات
              </span>
              <h2 className="text-3xl font-black text-ink">سوالات متداول کاربران</h2>
              <p className="text-sm text-ink/70 leading-7">
                پاسخ پرتکرارترین سوالات برگزارکنندگان درباره ساخت جدول و قرعه‌کشی مسابقات.
              </p>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="rounded-xl border border-line bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-base text-pitch flex items-start gap-2">
                    <span className="text-gold font-bold">؟</span>
                    <span>{faq.q}</span>
                  </h3>
                  <p className="mt-2.5 text-xs sm:text-sm text-ink/75 leading-7 pr-5">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="bg-pitch py-16 text-chalk relative overflow-hidden">
          <div className="absolute inset-0 bg-pitch-lines opacity-40 pointer-events-none" />
          <div className="relative mx-auto max-w-4xl px-6 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-black text-chalk leading-tight">
              آماده‌اید مسابقات خود را بدون دغدغه و حرفه‌ای برگزار کنید؟
            </h2>
            <p className="text-sm sm:text-base text-chalk/80 max-w-xl mx-auto leading-7">
              همین حالا و بدون نیاز به نصب هیچ نرم‌افزاری، اولین جدول مسابقات خود را در NexSport
              بسازید.
            </p>
            <div className="pt-2">
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-8 py-3.5 text-base font-bold text-ink shadow-xl hover:bg-gold-light transition-all transform hover:-translate-y-0.5"
              >
                <span>شروع رایگان برنامه‌ریزی مسابقات</span>
                <span>⚡</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-line bg-chalk py-12 text-ink">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-12 items-start">
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <NexSportIcon className="w-8 h-8 shrink-0 drop-shadow-xs" />
                <span className="text-lg font-black text-ink">NexSport</span>
              </div>
              <p className="text-xs text-ink/70 leading-6 max-w-md">
                NexSport پلتفرم هوشمند مدیریت و برنامه‌ریزی مسابقات ورزشی است. هدف ما حذف پیچیدگی‌های
                قرعه‌کشی، جدول‌بندی و ثبت نتایج برای مدارس فوتبال، سالن‌ها و برگزارکنندگان تورنمنت‌ها
                می‌باشد.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-pitch">دسترسی سریع</h4>
              <ul className="space-y-1.5 text-xs text-ink/75">
                <li>
                  <Link href="/planner" className="hover:text-pitch transition-colors">
                    برنامه‌ریز مسابقات
                  </Link>
                </li>
                <li>
                  <a href="#formats" className="hover:text-pitch transition-colors">
                    فرمت‌های پشتیبانی‌شده
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-pitch transition-colors">
                    امکانات و مزایا
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-pitch transition-colors">
                    سوالات متداول
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-pitch">فرمت‌های مسابقه</h4>
              <ul className="space-y-1.5 text-xs text-ink/75">
                <li>
                  <Link href="/planner?format=league" className="hover:text-pitch transition-colors">
                    لیگ دوره‌ای (تک‌دور)
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=double-league" className="hover:text-pitch transition-colors">
                    لیگ رفت و برگشت
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=groups" className="hover:text-pitch transition-colors">
                    مرحله گروهی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=groups-knockout" className="hover:text-pitch transition-colors">
                    گروهی + براکت حذفی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=knockout" className="hover:text-pitch transition-colors">
                    براکت تک‌حذفی
                  </Link>
                </li>
                <li>
                  <Link href="/planner?format=double-knockout" className="hover:text-pitch transition-colors">
                    تورنمنت دو حذفی (Double Elimination)
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-line/70 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-ink/50">
            <p>© {new Date().getFullYear()} تمامی حقوق برای سامانه ورزشی NexSport محفوظ است.</p>
            <p>طراحی‌شده با عشق برای ورزشکاران و برگزارکنندگان ایرانی 🇮🇷</p>
          </div>
        </div>
      </footer>
    </>
  );
}
