import Link from "next/link";

const formats = [
  {
    title: "لیگ",
    desc: "هر تیم یک‌بار مقابل تیم‌های دیگر بازی می‌کند؛ بدون هیچ بازی تکراری.",
  },
  {
    title: "لیگ رفت و برگشت",
    desc: "هر دو تیم دقیقاً یک‌بار در خانه و یک‌بار خارج از خانه به مصاف هم می‌روند.",
  },
  {
    title: "مرحله گروهی",
    desc: "تیم‌ها به گروه‌های دلخواه تقسیم می‌شوند؛ سیدبندی کاملاً اختیاری است.",
  },
  {
    title: "گروهی + حذفی",
    desc: "بعد از مرحله گروهی، صعودکننده‌ها وارد براکت حذفی می‌شوند.",
  },
  {
    title: "حذفی",
    desc: "براکت تک‌حذفی با پشتیبانی از Bye برای تعداد تیم‌های نامتوازن.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-pitch text-chalk">
        <div className="absolute inset-0 bg-pitch-lines pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="max-w-2xl">
            <p className="text-gold-light text-sm tracking-wide">NexSport</p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold leading-[1.25]">
              برنامه مسابقه‌تان را بدون اکسل بسازید
            </h1>
            <p className="mt-6 text-lg text-chalk/80 leading-8">
              تعداد تیم‌ها را وارد کنید، نوع مسابقه را انتخاب کنید و در چند
              مرحله یک برنامه معتبر و بدون بازی تکراری تحویل بگیرید — آماده
              چاپ یا ذخیره.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/planner"
                className="inline-flex items-center rounded-md bg-gold px-6 py-3 font-semibold text-ink transition-colors hover:bg-gold-light"
              >
                ساخت برنامه مسابقات
              </Link>
              <span className="text-sm text-chalk/60">رایگان، بدون نیاز به حساب کاربری</span>
            </div>
          </div>

          {/* Miniature scoreboard, built from real markup rather than an image */}
          <div className="mt-16 max-w-sm rounded-lg border border-chalk/15 bg-pitch-dark/60 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between text-xs text-chalk/50">
              <span>هفته ۱</span>
              <span>گروه A</span>
            </div>
            {[
              ["تیم آبی", "تیم سرخ"],
              ["تیم سبز", "تیم زرد"],
            ].map(([a, b], i) => (
              <div
                key={i}
                className="flex items-center justify-between border-t border-chalk/10 py-2.5 text-sm first:border-t-0"
              >
                <span>{a}</span>
                <span className="text-chalk/40">در برابر</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-bold text-ink">فرمت‌هایی که پشتیبانی می‌شوند</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {formats.map((f) => (
            <div key={f.title} className="rounded-md border border-line p-6">
              <h3 className="font-semibold text-pitch">{f.title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink/70">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
