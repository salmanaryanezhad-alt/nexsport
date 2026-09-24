import { db } from "../db";
import { hashPassword, verifyPassword } from "./password";
import { generateVerificationCode } from "./email";
import { cleanMobileNumber, toEnglishDigits } from "./utils";

type TestFn = () => Promise<void> | void;

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg} - انتظار: ${expected}، دریافت شد: ${actual}`);
  }
}

async function test(name: string, fn: TestFn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error instanceof Error ? error.message : error);
    failed++;
  }
}

async function run() {
  console.log("شروع تست‌های سیستم احراز هویت و دیتابیس (فاز دوم)...\n");

  await test("رمز عبور: هش‌گذاری و اعتبارسنجی صحیح رمز", () => {
    const raw = "123456";
    const hashed = hashPassword(raw);
    assert(hashed.includes(":"), "هش باید دارای سالت و فرمت مناسب باشد.");
    assert(verifyPassword(raw, hashed), "رمز عبور صحیح باید تایید شود.");
    assert(!verifyPassword("wrong", hashed), "رمز عبور اشتباه نباید تایید شود.");
  });

  await test("تولید کد تایید ایمیل: فرمت عددی ۶ رقمی", () => {
    const code = generateVerificationCode();
    assertEqual(code.length, 6, "کد باید ۶ رقمی باشد.");
    assert(/^\d{6}$/.test(code), "کد باید فقط شامل ارقام باشد.");
  });

  await test("ثبت‌نام کاربر: ایجاد کاربر جدید در دیتابیس با وضعیت تاییدنشده اولیه", async () => {
    const email = "testuser@nexsport.ir";
    const mobile = "09120000001";
    const user = await db.createUser({
      name: "کاربر تستی",
      email,
      mobile,
      password_hash: hashPassword("mypass"),
      is_verified: false,
    });

    assert(Boolean(user.id), "کاربر باید شناسه داشته باشد.");
    assertEqual(user.email, email, "ایمیل باید تطابق داشته باشد.");
    assertEqual(user.is_verified, false, "وضعیت تایید اولیه باید false باشد.");

    const foundByEmail = await db.findUserByEmail(email);
    assert(Boolean(foundByEmail), "کاربر با ایمیل باید پیدا شود.");

    const foundByMobile = await db.findUserByMobile(mobile);
    assert(Boolean(foundByMobile), "کاربر با شماره موبایل باید پیدا شود.");
  });

  await test("لاگین دوگانه: ورود با ایمیل و ورود با شماره همراه", async () => {
    const email = "dual@nexsport.ir";
    const mobile = "09129998877";
    await db.createUser({
      name: "کاربر دوگانه",
      email,
      mobile,
      password_hash: hashPassword("1234"),
      is_verified: true,
    });

    const userByEmail = await db.findUserByIdentifier(email);
    assert(Boolean(userByEmail), "یافتن با شناسه ایمیل باید موفق باشد.");
    assertEqual(userByEmail?.mobile, mobile, "شماره موبایل کاربر باید مطابقت داشته باشد.");

    const userByMobile = await db.findUserByIdentifier(mobile);
    assert(Boolean(userByMobile), "یافتن با شناسه موبایل باید موفق باشد.");
    assertEqual(userByMobile?.email, email, "ایمیل کاربر باید مطابقت داشته باشد.");
  });

  await test("تایید ایمیل: تولید کد تایید، اعتبارسنجی کد و فعال‌سازی حساب کاربری", async () => {
    const email = "verify@nexsport.ir";
    const user = await db.createUser({
      name: "کاربر تاییدیه",
      email,
      mobile: "09121112233",
      password_hash: hashPassword("pass"),
      is_verified: false,
    });

    const code = "789123";
    await db.saveVerificationCode(user.id, email, code, 15);

    const validRecord = await db.verifyCode(email, code);
    assert(Boolean(validRecord), "کد صحیح باید تایید شود.");

    const invalidRecord = await db.verifyCode(email, "000000");
    assertEqual(invalidRecord, null, "کد اشتباه نباید تایید شود.");

    await db.markUserVerified(user.id);
    const updatedUser = await db.findUserById(user.id);
    assertEqual(updatedUser?.is_verified, true, "پس از تایید، وضعیت کاربر باید true شود.");
  });

  await test("مدیریت نشست (Session): ایجاد توکن، بازیابی و ابطال خروج", async () => {
    const user = await db.createUser({
      name: "کاربر نشست",
      email: "session@nexsport.ir",
      mobile: "09123334455",
      password_hash: hashPassword("pass"),
      is_verified: true,
    });

    const token = await db.createSession(user.id, 48);
    assert(Boolean(token), "توکن باید تولید شود.");

    const session = await db.findSession(token);
    assertEqual(session?.user_id, user.id, "شناسه کاربر در نشست باید مطابقت کند.");

    await db.deleteSession(token);
    const expiredSession = await db.findSession(token);
    assertEqual(expiredSession, null, "پس از حذف نشست، باید null بازگردد.");
  });

  await test("نشست لغزان ۴۸ ساعته (Rolling Session): تمدید خودکار ۴۸ ساعت پس از هر فعالیت و ثبت زمان آخرین فعالیت", async () => {
    const user = await db.createUser({
      name: "کاربر لغزان",
      email: "rolling@nexsport.ir",
      mobile: "09127778899",
      password_hash: hashPassword("pass"),
      is_verified: true,
    });

    // ایجاد نشست اولیه ۴۸ ساعته
    const token = await db.createSession(user.id, 48);
    const initialSession = await db.findSession(token);
    assert(Boolean(initialSession), "نشست باید ایجاد شده باشد.");
    assert(Boolean(initialSession?.last_active_at), "زمان آخرین فعالیت باید ثبت شده باشد.");

    const now = Date.now();
    const expiresMs = new Date(initialSession!.expires_at).getTime();
    const hoursRemaining = (expiresMs - now) / (1000 * 60 * 60);

    // زمان انقضا باید حدود ۴۸ ساعت از اکنون باشد (حداقل ۴۷.۹ ساعت)
    assert(hoursRemaining >= 47.9 && hoursRemaining <= 48.1, `زمان انقضا باید ۴۸ ساعت پس از فعالیت باشد. زمان فعلی: ${hoursRemaining} ساعت`);

    // شبیه‌سازی فعالیت مجدد کاربر: فراخوانی findSession باید تاریخ انقضا را دوباره تمدید کند
    const refreshedSession = await db.findSession(token);
    assert(Boolean(refreshedSession), "نشست تمدید شده باید معتبر باشد.");
    assertEqual(refreshedSession?.user_id, user.id, "شناسه کاربر باید تطابق داشته باشد.");
  });

  await test("نرمال‌سازی ارقام فارسی: تبدیل کیبورد موبایل به انگلیسی و پاکسازی شماره", () => {
    const persianDigits = "۰۹۱۲۳۴۵۶۷۸۹";
    const englishDigits = "09123456789";
    const withSpaces = "+98 912 345 6789";
    assertEqual(cleanMobileNumber(persianDigits), englishDigits, "اعداد فارسی باید به انگلیسی تبدیل شوند.");
    assertEqual(cleanMobileNumber(withSpaces), englishDigits, "پیش‌شماره +98 باید به 0 تبدیل شود.");
  });

  await test("انعطاف کیبورد در رمز عبور: سازگاری کامل ثبت‌نام با کیبورد فارسی و ورود با انگلیسی و برعکس", () => {
    // سناریو ۱: کاربر با کیبورد فارسی روی گوشی ثبت‌نام کرده (مثلاً Pass۱۲۳۴)
    const mobileHashed = hashPassword("Pass۱۲۳۴");
    // حالا روی کامپیوتر با کیبورد انگلیسی تایپ می‌کند (Pass1234)
    assert(verifyPassword("Pass1234", mobileHashed), "ورود با ارقام انگلیسی برای رمزی که با ارقام فارسی ثبت شده باید تایید شود.");

    // سناریو ۲: کاربر با کیبورد انگلیسی ثبت‌نام کرده و روی گوشی با فارسی وارد می‌شود
    const pcHashed = hashPassword("Secret1405");
    assert(verifyPassword("Secret۱۴۰۵", pcHashed), "ورود با ارقام فارسی برای رمزی که با ارقام انگلیسی ثبت شده باید تایید شود.");
  });

  await test("فراموشی رمز عبور: ایجاد کد بازیابی، اعتبارسنجی و به‌روزرسانی رمز عبور", async () => {
    const email = "forgot@nexsport.ir";
    const oldPassword = "oldPassword123";
    const user = await db.createUser({
      name: "کاربر بازیابی",
      email,
      mobile: "09124445566",
      password_hash: hashPassword(oldPassword),
      is_verified: true,
    });

    const resetCode = "654321";
    await db.savePasswordResetCode(user.id, email, resetCode, 15);

    // Verify invalid code
    const invalidCheck = await db.verifyPasswordResetCode(email, "111111");
    assertEqual(invalidCheck, null, "کد بازیابی اشتباه نباید تایید شود.");

    // Verify valid code
    const validCheck = await db.verifyPasswordResetCode(email, resetCode);
    assert(Boolean(validCheck), "کد بازیابی صحیح باید تایید شود.");
    assertEqual(validCheck?.user_id, user.id, "شناسه کاربر در کد بازیابی باید مطابقت داشته باشد.");

    // Update password
    const newPassword = "newPassword456";
    await db.updateUserPassword(user.id, hashPassword(newPassword));
    await db.deletePasswordResetCodesForUser(user.id);

    // Verify user password was updated
    const updated = await db.findUserById(user.id);
    assert(Boolean(updated), "کاربر باید یافت شود.");
    assert(verifyPassword(newPassword, updated!.password_hash), "رمز جدید باید تایید شود.");
    assert(!verifyPassword(oldPassword, updated!.password_hash), "رمز قدیمی نباید تایید شود.");
  });

  await test("مدیریت حساب کاربری: ویرایش نام و پروفایل", async () => {
    const email = "profile@nexsport.ir";
    const user = await db.createUser({
      name: "نام اولیه",
      email,
      mobile: "09125556677",
      password_hash: hashPassword("pass123"),
      is_verified: true,
    });

    const updated = await db.updateUserProfile(user.id, "نام ویرایش شده جدید");
    assertEqual(updated?.name, "نام ویرایش شده جدید", "نام جدید باید در دیتابیس ثبت شده باشد.");
  });

  await test("ذخیره‌سازی ابری مسابقات: چرخه کامل ذخیره، لیست، فراخوانی و حذف", async () => {
    const user = await db.createUser({
      name: "مدیر تورنمنت",
      email: "tournaments@nexsport.ir",
      mobile: "09126667788",
      password_hash: hashPassword("pass"),
      is_verified: true,
    });

    // 1. Save new tournament
    const t1 = await db.saveTournament({
      userId: user.id,
      title: "جام حذفی فوتبال ۱۴۰۵",
      format: "knockout",
      sport: "فوتبال",
      teamCount: 8,
      state: { step: 4, teams: ["A", "B", "C", "D"] },
    });
    assert(Boolean(t1.id), "شناسه تورنمنت باید اختصاص یابد.");
    assertEqual(t1.title, "جام حذفی فوتبال ۱۴۰۵", "عنوان مسابقه باید تطابق داشته باشد.");

    // 2. Save second tournament
    const t2 = await db.saveTournament({
      userId: user.id,
      title: "لیگ فوتسال محلات",
      format: "league-single",
      sport: "فوتسال",
      teamCount: 6,
      state: { step: 4 },
    });

    // 3. List tournaments for user
    const list = await db.listTournaments(user.id);
    assertEqual(list.length, 2, "کاربر باید ۲ مسابقه ذخیره‌شده در فهرست داشته باشد.");

    // 4. Update existing tournament
    const updatedT1 = await db.saveTournament({
      id: t1.id,
      userId: user.id,
      title: "جام حذفی فوتبال ۱۴۰۵ - نسخه نهایی",
      format: "knockout",
      sport: "فوتبال",
      teamCount: 8,
      state: { step: 4, champion: "A" },
    });
    assertEqual(updatedT1.title, "جام حذفی فوتبال ۱۴۰۵ - نسخه نهایی", "عنوان باید به‌روزرسانی شده باشد.");
    assertEqual(updatedT1.id, t1.id, "شناسه در به‌روزرسانی باید حفظ شود.");

    // 5. Get single tournament
    const fetched = await db.getTournament(t1.id, user.id);
    assertEqual(fetched?.state?.champion, "A", "اطلاعات بازیابی شده باید شامل فیلدهای ذخیره شده باشد.");

    // 6. Delete tournament
    const deleted = await db.deleteTournament(t1.id, user.id);
    assert(deleted, "حذف تورنمنت باید موفقیت‌آمیز باشد.");

    const listAfter = await db.listTournaments(user.id);
    assertEqual(listAfter.length, 1, "پس از حذف، باید یک مسابقه در لیست بماند.");
    assertEqual(listAfter[0].id, t2.id, "مسابقه باقی‌مانده باید دومین مسابقه باشد.");
  });

  await test("قانون اتصال دوگانه (Dual-Device Policy): همزمانی ۱ رایانه و ۱ موبایل", async () => {
    const user = await db.createUser({
      name: "کاربر تست دو دستگاه",
      email: "dualdevice@nexsport.ir",
      mobile: "09121112233",
      passwordHash: hashPassword("Secret123"),
      isVerified: true,
    });

    // 1. کاربر روی رایانه (Desktop) وارد می‌شود
    const desktopToken1 = await db.createSession(user.id, 48, "desktop");
    const activeDesktop1 = await db.findActiveSessionByDevice(user.id, "desktop");
    assert(Boolean(activeDesktop1), "باید نشست فعال رایانه وجود داشته باشد.");
    assertEqual(activeDesktop1?.id, desktopToken1, "نشست فعال رایانه باید برابر با توکن ثبت شده باشد.");
    assertEqual(activeDesktop1?.device_type, "desktop", "نوع دستگاه باید desktop باشد.");

    // 2. کاربر همزمان روی گوشی همراه (Mobile) وارد می‌شود
    const mobileToken1 = await db.createSession(user.id, 48, "mobile");
    const activeMobile1 = await db.findActiveSessionByDevice(user.id, "mobile");
    assert(Boolean(activeMobile1), "باید نشست فعال موبایل همزمان وجود داشته باشد.");
    assertEqual(activeMobile1?.id, mobileToken1, "نشست فعال موبایل باید برابر با توکن موبایل باشد.");
    assertEqual(activeMobile1?.device_type, "mobile", "نوع دستگاه باید mobile باشد.");

    // هر دو نشست همزمان معتبر هستند (۱ رایانه + ۱ موبایل)
    const validDesktop = await db.findSession(desktopToken1);
    const validMobile = await db.findSession(mobileToken1);
    assert(Boolean(validDesktop), "نشست رایانه باید همزمان با موبایل معتبر و فعال بماند.");
    assert(Boolean(validMobile), "نشست موبایل باید همزمان با رایانه معتبر و فعال بماند.");

    // 3. تلاش برای ورود با یک رایانه دیگر (Desktop 2)
    // سیستم ابتدا وجود نشست فعال رایانه را شناسایی می‌کند
    const conflictDesktop = await db.findActiveSessionByDevice(user.id, "desktop");
    assert(Boolean(conflictDesktop), "سیستم باید نشست قبلی رایانه را شناسایی کند تا فرم تایید نمایش داده شود.");

    // با تایید کاربر برای خروج از رایانه قبلی (forceKick):
    await db.deleteSessionsByDevice(user.id, "desktop");
    const desktopToken2 = await db.createSession(user.id, 48, "desktop");

    // بررسی نتیجه خروج گزینشی:
    const expiredDesktop1 = await db.findSession(desktopToken1);
    assertEqual(expiredDesktop1, null, "نشست رایانه ۱ باید ابطال و خارج شده باشد.");

    const freshDesktop = await db.findSession(desktopToken2);
    assert(Boolean(freshDesktop), "نشست رایانه ۲ باید فعال باشد.");

    // مهم: نشست تلفن همراه (Mobile) نباید هیچ تغییری کرده باشد!
    const stillAliveMobile = await db.findSession(mobileToken1);
    assert(Boolean(stillAliveMobile), "خروج از رایانه نباید هیچ اثری روی نشست تلفن همراه بگذارد.");
    assertEqual(stillAliveMobile?.device_type, "mobile", "نشست موبایل بدون تغییر باقی می‌ماند.");

    // 4. ورود روی یک موبایل دیگر با تایید خروج از موبایل اول:
    await db.deleteSessionsByDevice(user.id, "mobile");
    const mobileToken2 = await db.createSession(user.id, 48, "mobile");

    const expiredMobile1 = await db.findSession(mobileToken1);
    assertEqual(expiredMobile1, null, "نشست موبایل ۱ باید ابطال و خارج شده باشد.");

    const freshMobile = await db.findSession(mobileToken2);
    assert(Boolean(freshMobile), "نشست موبایل ۲ باید فعال باشد.");

    // رایانه ۲ هم‌چنان معتبر باقی می‌ماند:
    const desktopStillAlive = await db.findSession(desktopToken2);
    assert(Boolean(desktopStillAlive), "خروج از موبایل نباید هیچ اثری روی نشست رایانه بگذارد.");
  });

  console.log("\n======================================");
  console.log(`تست‌های موفق: ${passed}`);
  console.log(`تست‌های ناموفق: ${failed}`);
  console.log("======================================\n");

  if (failed > 0) process.exit(1);
}

run();
