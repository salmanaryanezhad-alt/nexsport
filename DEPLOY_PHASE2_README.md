# راهنمای جامع استقرار سرور نکس‌پورت (NexSport — فاز دوم)

این بسته شامل آخرین و کامل‌ترین نسخه رسمی سامانه **NexSport** همراه با کلیه قابلیت‌های **فاز اول و فاز دوم** است که برای استقرار بر روی سرور واقعی (هاست لینوکس، سرور مجازی VPS، پنل cPanel/DirectAdmin یا پلتفرم‌های ابری) با **سئوی کامل و ایندکس فعال موتورهای جستجو** آماده‌سازی شده است.

---

## 🌟 ویژگی‌های نسخه فاز دوم (Phase 2 Indexed Server Edition)

1. **سئوی فعال و آماده ایندکس گوگل:**
   - فایل `robots.txt` استاندارد با دستور `Allow: /` و معرفی نقشه سایت `https://nexsport.ir/sitemap.xml`.
   - برچسب‌های متای سرچشمه: `index, follow` و `max-image-preview: large`.
   - نشانی کانونیکال رسمی: `https://nexsport.ir`.
   - داده‌های ساختاریافته Schema.org برای رتبه اول در جستجوی کلمات کلیدی ورزشی.

2. **سیستم احراز هویت و پایگاه‌داده ابری:**
   - ثبت‌نام با نام، ایمیل و شماره همراه.
   - ورود دوگانه با ایمیل یا شماره موبایل + رمز عبور.
   - سیستم تایید ایمیل با کد ۶ رقمی و قالب شیک HTML با پشتیبانی از Resend API.
   - بازیابی رمز عبور، ویرایش مشخصات در پروفایل.
   - ذخیره‌سازی ابری و همگام‌سازی مسابقات در PostgreSQL با ایجاد خودکار جداول (`Auto-Migration`).
   - دسترسی آزاد و نامحدود برای کاربران مهمان (بدون اجبار به ورود).

3. **موتور پیشرفته زمان‌بندی و جدول مسابقات:**
   - لیگ دوره‌ای (تک‌دور) و لیگ رفت‌وبرگشت سنتی و اروپایی.
   - مرحله گروهی و گروهی + براکت حذفی با صعود خودکار سرگروه‌ها.
   - براکت تک‌حذفی و دوحذفی (Double Elimination) استاندارد.
   - محاسبه قطعی‌شدن ریاضی رتبه‌ها و جلوگیری از نمایش زودهنگام نشان‌های قهرمانی.
   - قفل مسابقات دارای حریف نامشخص و تفکیک قرعه استراحت (BYE).
   - سیستم امتیازدهی چندرشته‌ای (فوتبال، فوتسال، والیبال FIVB، بسکتبال، فوتبال ساحلی).
   - فیلتر مسابقات تیم، تنظیم زمان/زمین بازی‌ها و خروجی اکسل/CSV/چاپ با برند `https://nexsport.ir`.

---

## 🚀 روش‌های استقرار روی سرور

### روش اول: استقرار روی سرور مجازی (VPS لینوکس - اوبونتو / دبیان) با PM2
۱. فایل زیپ را در سرور در مسیر دلخواه (مثلاً `/var/www/nexsport`) از حالت فشرده خارج کنید.
۲. وابستگی‌ها را نصب کرده و پروژه را بیلد کنید:
```bash
npm install --production=false
npm run build
```
۳. یک فایل `.env.production` در کنار پروژه بسازید و متغیرهای زیر را در آن قرار دهید:
```env
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_SITE_URL=https://nexsport.ir
DATABASE_URL=postgres://USERNAME:PASSWORD@localhost:5432/nexsport_db
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=NexSport <noreply@nexsport.ir>
```
۴. برنامه را با `PM2` اجرا کنید تا همیشه روشن بماند:
```bash
npm install -g pm2
pm2 start npm --name "nexsport" -- start
pm2 save
pm2 startup
```
۵. در Nginx یا Apache، پورت ۳۰۰۰ را به عنوان Reverse Proxy برای دامنه `nexsport.ir` تنظیم کنید:
```nginx
server {
    server_name nexsport.ir www.nexsport.ir;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### روش دوم: استقرار روی هاست‌های اشتراکی سی‌پنل (cPanel Setup Node.js App)
۱. در پنل cPanel به بخش **Setup Node.js App** بروید.
۲. روی دکمه **Create Application** کلیک کنید.
   - **Node.js version:** نسخه ۱۸ یا ۲۰ را انتخاب نمایید.
   - **Application mode:** گزینه `Production`.
   - **Application root:** نام پوشه (مثلاً `nexsport`).
   - **Application URL:** دامنه `nexsport.ir`.
   - **Application startup file:** فایل اجرایی استارتاپ (`node_modules/next/dist/bin/next` با آرگومان `start`).
۳. در بخش **Environment Variables** متغیرهای زیر را اضافه کنید:
   - `DATABASE_URL`: آدرس اتصال به پایگاه‌داده PostgreSQL.
   - `RESEND_API_KEY`: کلید ارسال ایمیل (اختیاری؛ در صورت نبود در حالت دمو کار می‌کند).
۴. فایل زیپ را داخل پوشه آپلود کرده و از حالت فشرده خارج کنید.
۵. دکمه **Run NPM Install** را بزنید و سپس دستور `npm run build` را در کنسول اجرا کرده و اپلیکیشن را ری‌استارت کنید.

---

### روش سوم: استقرار در پلتفرم‌های ابری (Liara / Chapaar / Vercel / Railway)
۱. در داشبورد پلتفرم ابری یک برنامه جدید از نوع **Next.js** بسازید.
۲. در بخش متغیرها (Environment Variables) مقادیر زیر را وارد کنید:
   - `DATABASE_URL`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://nexsport.ir`
۳. کدها را مستقیماً از طریق Git یا آپلود فایل ارسال کنید. پلتفرم بیلد و راه‌اندازی را خودکار انجام خواهد داد.

---

## 🗄️ ایجاد جداول دیتابیس
سامانه مجهز به **Auto-Migration** است؛ نیازی به اجرای دستور SQL به صورت دستی نیست. به محض اولین ارتباط با دیتابیس، تمام جدول‌های مورد نیاز ایجاد و آماده استفاده می‌شوند. در صورت نیاز به بررسی ساختار جداول، اسکریپت کامل در فایل `lib/db/schema.sql` در دسترس است.

با آرزوی موفقیت،  
تیم توسعه **NexSport** — پاییز ۱۴۰۵ (سپتامبر ۲۰۲۶)
