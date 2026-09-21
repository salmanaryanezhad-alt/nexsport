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

    const token = await db.createSession(user.id, 30);
    assert(Boolean(token), "توکن باید تولید شود.");

    const session = await db.findSession(token);
    assertEqual(session?.user_id, user.id, "شناسه کاربر در نشست باید مطابقت کند.");

    await db.deleteSession(token);
    const expiredSession = await db.findSession(token);
    assertEqual(expiredSession, null, "پس از حذف نشست، باید null بازگردد.");
  });

  await test("نرمال‌سازی ارقام فارسی: تبدیل کیبورد موبایل به انگلیسی و پاکسازی شماره", () => {
    const persianDigits = "۰۹۱۲۳۴۵۶۷۸۹";
    const englishDigits = "09123456789";
    const withSpaces = "+98 912 345 6789";
    assertEqual(cleanMobileNumber(persianDigits), englishDigits, "اعداد فارسی باید به انگلیسی تبدیل شوند.");
    assertEqual(cleanMobileNumber(withSpaces), englishDigits, "پیش‌شماره +98 باید به 0 تبدیل شود.");
  });

  console.log("\n======================================");
  console.log(`تست‌های موفق: ${passed}`);
  console.log(`تست‌های ناموفق: ${failed}`);
  console.log("======================================\n");

  if (failed > 0) process.exit(1);
}

run();
