/**
 * NexSport Automated cPanel Package Builder
 * - Compiles static Next.js frontend (HTML, CSS, JS, local Vazirmatn fonts, sitemap, robots)
 * - Bundles zero-config PHP MySQL API in api/
 * - Injects user MySQL credentials into config.php and .env
 * - Packages everything into a ready-to-extract ZIP file for cPanel public_html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'out');
const PHP_API_DIR = path.join(ROOT_DIR, 'php-api');
const APP_API_DIR = path.join(ROOT_DIR, 'app', 'api');
const APP_API_TEMP = path.join(ROOT_DIR, 'app', '_api_temp');
const NEXT_CONFIG = path.join(ROOT_DIR, 'next.config.mjs');
const ZIP_OUTPUT = '/home/user/nexsport-cpanel-direct-upload.zip';

console.log('🚀 Starting NexSport cPanel Package Build...');

// 1. Ensure next.config.mjs has output: 'export'
let configContent = fs.readFileSync(NEXT_CONFIG, 'utf8');
const originalConfig = configContent;
if (!configContent.includes("output: 'export'") && !configContent.includes('output: "export"')) {
    configContent = configContent.replace(
        'const nextConfig = {',
        'const nextConfig = {\n  output: "export",'
    );
    fs.writeFileSync(NEXT_CONFIG, configContent);
    console.log('✓ Configured next.config.mjs for static export');
}

// 2. Temporarily move app/api during static build
let apiMoved = false;
if (fs.existsSync(APP_API_DIR)) {
    fs.renameSync(APP_API_DIR, APP_API_TEMP);
    apiMoved = true;
    console.log('✓ Temporarily moved app/api for static page prerendering');
}

try {
    // 3. Build Next.js
    console.log('⏳ Running Next.js build...');
    execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✓ Static frontend build completed successfully!');
} finally {
    // Restore app/api
    if (apiMoved && fs.existsSync(APP_API_TEMP)) {
        fs.renameSync(APP_API_TEMP, APP_API_DIR);
        console.log('✓ Restored app/api');
    }
}

// 4. Copy PHP API into out/api/
const targetApiDir = path.join(OUT_DIR, 'api');
if (fs.existsSync(targetApiDir)) {
    fs.rmSync(targetApiDir, { recursive: true, force: true });
}
fs.mkdirSync(targetApiDir, { recursive: true });

const phpFiles = fs.readdirSync(PHP_API_DIR);
for (const file of phpFiles) {
    fs.copyFileSync(path.join(PHP_API_DIR, file), path.join(targetApiDir, file));
}
console.log('✓ Injected PHP MySQL API into out/api/');

// 5. Copy .htaccess to out/.htaccess
const publicHtaccess = path.join(ROOT_DIR, 'public', '.htaccess');
if (fs.existsSync(publicHtaccess)) {
    fs.copyFileSync(publicHtaccess, path.join(OUT_DIR, '.htaccess'));
    console.log('✓ Injected root .htaccess with API routing');
}

// 6. Include MySQL Schema in out/database/
const dbDir = path.join(OUT_DIR, 'database');
fs.mkdirSync(dbDir, { recursive: true });
fs.copyFileSync(
    path.join(ROOT_DIR, 'lib', 'db', 'schema_mysql.sql'),
    path.join(dbDir, 'schema_mysql.sql')
);

// 7. Write deployment guide inside out/
const guideFa = `======================================================================
راهنمای استقرار مستقیم NexSport روی هاست cPanel (بدون نیاز به Node.js)
======================================================================

تبریک! این بسته به صورت ۱۰۰٪ آماده و خودکار (Zero-Configuration) ساخته شده است.

مراحل نصب فوق‌العاده ساده (کمتر از ۱ دقیقه):
--------------------------------------------------
۱. وارد cPanel هاست خود شوید.
۲. به بخش «File Manager» بروید و وارد پوشه «public_html» شوید.
۳. تمام محتویات فایل زیپ (nexsport-cpanel-direct-upload.zip) را مستقیماً داخل public_html اکسترکت (Extract) نمایید.
۴. تمام! سایت شما با آدرس https://nexsport.ir بالا آمده و آماده استفاده است.

مشخصات دیتابیس متصل شده:
--------------------------------------------------
- نام دیتابیس: unmvwyxf_nexsport_db
- نام کاربری: unmvwyxf_nexsport_db
- سرور: localhost
- تمامی جداول (users, sessions, tournaments, ...) در اولین باز شدن سایت به صورت کاملاً خودکار ساخته می‌شوند.
- در صورت تمایل به ایمپورت دستی، فایل SQL نیز در پوشه database/schema_mysql.sql قرار دارد.

ویژگی‌های کلیدی این نسخه:
--------------------------------------------------
✓ بدون نیاز به سرور مجازی یا تنظیمات ترمینال Node.js
✓ نشست ورود شناور ۴۸ ساعته (Rolling Session)
✓ اتصال مستقیم به پایگاه داده MySQL با کارایی و امنیت بالا
✓ پشتیبانی کامل از سئو و ایندکس موتورهای جستجو (Googlebot Allow, Sitemap, Robots.txt)
✓ سازگار با کلیه هاست‌های لینوکسی Apache و LiteSpeed
======================================================================
`;
fs.writeFileSync(path.join(OUT_DIR, 'README_CPANEL_FA.txt'), guideFa);

// 8. Create ZIP package
console.log('📦 Creating ZIP archive...');
if (fs.existsSync(ZIP_OUTPUT)) {
    fs.unlinkSync(ZIP_OUTPUT);
}

// Copy .env into out/ as well
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, path.join(OUT_DIR, '.env'));
}

execSync(`cd "${OUT_DIR}" && zip -r -q "${ZIP_OUTPUT}" . -x "__MACOSX/*"`);
console.log(`🎉 Successfully generated: ${ZIP_OUTPUT}`);

// Also copy to nexsport-direct-upload.zip
const ALT_ZIP = '/home/user/nexsport-direct-upload.zip';
fs.copyFileSync(ZIP_OUTPUT, ALT_ZIP);
console.log(`✓ Also updated: ${ALT_ZIP}`);
