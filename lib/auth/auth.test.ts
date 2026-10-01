import { db } from "../db";
import { hashPassword, verifyPassword } from "./password";
import { generateVerificationCode } from "./email";
import { cleanMobileNumber, toEnglishDigits, hasPersianLetters, shouldSkipAdminSensitiveReauth } from "./utils";
import { paymentService, MockGateway } from "../payment";
import { isSignedSessionToken, getRequestToken, createSignedSessionToken } from "./sessionToken";

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
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "salman.aryanezhad@gmail.com";
  console.log("شروع تست‌های سیستم احراز هویت و دیتابیس (فاز دوم)...\n");

  await test("رمز عبور: هش‌گذاری و اعتبارسنجی صحیح رمز", () => {
    const raw = "12345678";
    const hashed = hashPassword(raw);
    assert(hashed.includes(":"), "هش باید دارای سالت و فرمت مناسب باشد.");
    assert(verifyPassword(raw, hashed), "رمز عبور صحیح باید تایید شود.");
    assert(!verifyPassword("wrongpass", hashed), "رمز عبور اشتباه نباید تایید شود.");
  });

  await test("قانون حداقل ۸ کاراکتر رمز عبور", () => {
    // اعتبارسنجی حداقل ۸ کاراکتر
    const validateLength = (pwd: string) => typeof pwd === "string" && pwd.length >= 8;
    assert(!validateLength("1234567"), "رمز کمتر از ۸ کاراکتر باید رد شود");
    assert(!validateLength("abc"), "رمز کوتاه باید رد شود");
    assert(validateLength("12345678"), "رمز ۸ رقمی عددی مجاز است");
    assert(validateLength("password"), "رمز ۸ حرفی متنی مجاز است");
    assert(validateLength("Pass@1234"), "رمز ترکیبی مجاز است");
  });

  await test("محدودیت عدم پذیرش حروف فارسی در رمز عبور (صفحه کلید را به انگلیسی تغییر دهید)", () => {
    // حروف فارسی، نیم‌فاصله و علائم نگارشی کیبورد فارسی باید رد شوند
    assert(hasPersianLetters("سلام1234"), "رمز دارای حروف فارسی باید شناسایی شود");
    assert(hasPersianLetters("حشسسصخقی"), "تایپ اشتباه رمز عبور روی کیبورد فارسی باید شناسایی شود");
    assert(hasPersianLetters("pass‌word"), "کاراکتر نیم‌فاصله فارسی باید شناسایی شود");
    assert(hasPersianLetters("password،"), "ویرگول فارسی باید شناسایی شود");
    assert(hasPersianLetters("password؟"), "علامت سوال فارسی باید شناسایی شود");

    // حروف انگلیسی، اعداد، کاراکترهای خاص و ارقام فارسی نباید به عنوان حروف فارسی رد شوند
    assert(!hasPersianLetters("password123"), "رمز استاندارد انگلیسی باید تایید شود");
    assert(!hasPersianLetters("12345678"), "رمز عددی انگلیسی باید تایید شود");
    assert(!hasPersianLetters("Pass!@#$%^&*()_+"), "رمز با کاراکترهای ویژه انگلیسی باید تایید شود");
    assert(!hasPersianLetters("۱۲۳۴۵۶۷۸"), "ارقام فارسی به عنوان حروف تلقی نمی‌شوند (خودکار به انگلیسی تبدیل می‌شوند)");
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

  await test("نشست امضاشده سرورلس: هویت بدون حافظه مشترک باقی می‌ماند", async () => {
    const user = await db.createUser({
      name: "کاربر سرورلس",
      email: "serverless-session@nexsport.ir",
      mobile: "09120001122",
      password_hash: hashPassword("pass"),
      is_verified: true,
    });

    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      const token = await db.createSession(user.id, 48, "desktop");
      assert(isSignedSessionToken(token), "توکن باید امضای HMAC داشته باشد.");
      await db.deleteSession(token);
      const recovered = await db.findSession(token);
      assert(Boolean(recovered), "روی Vercel توکن امضاشده بدون حافظه مشترک باید معتبر بماند.");
      assertEqual(recovered?.user_id, user.id, "شناسه کاربر باید از کوکی امضاشده خوانده شود.");
      assertEqual(recovered?.user_snapshot?.email, user.email, "ایمیل کاربر باید در نمای کوکی باشد.");
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });

  await test("خواندن توکن نشست از کوکی کلاینت و هدر Bearer", () => {
    const { token } = createSignedSessionToken({ userId: "u-bearer", email: "b@nexsport.ir" });
    const fromClient = getRequestToken({
      cookies: {
        get: (name: string) => (name === "nexsport_client_token" ? { value: token } : undefined),
      },
      headers: { get: () => null },
    });
    assertEqual(fromClient, token, "توکن کوکی کلاینت باید خوانده شود.");

    const fromHeader = getRequestToken({
      cookies: { get: () => undefined },
      headers: {
        get: (name: string) => (name.toLowerCase() === "authorization" ? `Bearer ${token}` : null),
      },
    });
    assertEqual(fromHeader, token, "توکن Authorization Bearer باید خوانده شود.");
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

  await test("فهرست مدیر: پلن/سهمیه کاربر و مسابقات ثبت‌نام‌شده بدون مهمان", async () => {
    const owner = await db.createUser({
      name: "برگزارکننده سهمیه",
      email: "quota-owner@nexsport.ir",
      mobile: "09121112233",
      password_hash: hashPassword("QuotaPass123"),
      is_verified: true,
    });

    const saved = await db.saveTournament({
      userId: owner.id,
      title: "جام باشگاه‌های سهمیه",
      format: "league-single",
      sport: "فوتبال",
      teamCount: 4,
      state: { payment: { isPaid: true } },
    });

    await db.saveTournament({
      userId: "public",
      title: "مسابقه مهمان نباید دیده شود",
      format: "knockout",
      teamCount: 2,
      state: { payment: { isPaid: true } },
    });

    const allUsers = await db.listAllUsers();
    const listedOwner = allUsers.find((u) => u.id === owner.id);
    assert(Boolean(listedOwner), "کاربر باید در فهرست مدیر باشد.");
    assertEqual(listedOwner?.planning_credits, 5, "اعتبار اولیه برنامه‌ریزی باید ۵ باشد.");
    assertEqual(listedOwner?.free_link_used, false, "لینک رایگان باید در ابتدا موجود باشد.");
    assert(!("password_hash" in (listedOwner as any)), "هش رمز نباید در فهرست مدیر باشد.");

    const adminList = await db.listAdminUserTournaments();
    assert(adminList.some((t) => t.id === saved.id), "مسابقه کاربر ثبت‌نام‌شده باید در فهرست مدیر باشد.");
    assert(
      !adminList.some((t) => t.user_id === "public" || t.title.includes("مهمان")),
      "مسابقات مهمان/عمومی نباید در فهرست مدیر بیاید."
    );
    const mine = await db.listAdminUserTournaments(owner.id);
    assertEqual(mine.length, 1, "فیلتر کاربر باید فقط مسابقات همان حساب را برگرداند.");
    assertEqual(mine[0].owner.email, owner.email, "ایمیل برگزارکننده باید همراه مسابقه باشد.");
    assertEqual(mine[0].linkActive, true, "وضعیت لینک فعال باید از state خوانده شود.");
  });

  await test("صفحه عمومی و لینک اختصاصی مسابقات (فاز سوم): بازیابی عمومی بدون نشست و اعتبارسنجی شناسه کوتاه", async () => {
    const user = await db.createUser({
      name: "برگزارکننده لیگ عمومی",
      email: "public-league@nexsport.ir",
      mobile: "09124445566",
      password_hash: hashPassword("passPublic123"),
      is_verified: true,
    });

    // 1. Save tournament with automatically generated short ID
    const tournament = await db.saveTournament({
      userId: user.id,
      title: "لیگ برتر فوتسال پیشکسوتان",
      format: "league-single",
      sport: "فوتسال",
      teamCount: 6,
      state: { step: 4, rounds: [], scores: { "m-1": { home: 3, away: 1 } } },
    });

    assert(Boolean(tournament.id), "مسابقه باید دارای شناسه اختصاصی باشد.");
    assertEqual(tournament.id.length, 8, "شناسه لینک کوتاه تولیدشده باید ۸ کاراکتر باشد.");

    // 2. Public retrieval without userId
    const publicData = await db.getPublicTournament(tournament.id);
    assert(Boolean(publicData), "مسابقه باید به صورت عمومی بدون لاگین قابل بازیابی باشد.");
    assertEqual(publicData?.title, "لیگ برتر فوتسال پیشکسوتان", "عنوان مسابقه عمومی باید تطابق داشته باشد.");
    assertEqual(publicData?.team_count, 6, "تعداد تیم‌ها باید درست باشد.");
    assertEqual(publicData?.state?.scores?.["m-1"]?.home, 3, "نتایج بازی‌ها باید در داده‌های عمومی موجود باشد.");

    // 3. Non-existent ID returns null
    const notFound = await db.getPublicTournament("unknown-xyz");
    assertEqual(notFound, null, "شناسه ناموجود باید null برگرداند.");
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
    assertEqual(activeDesktop1?.user_id, user.id, "نشست فعال رایانه باید متعلق به همان کاربر باشد.");
    assertEqual(activeDesktop1?.device_type, "desktop", "نوع دستگاه باید desktop باشد.");
    const desktopLookup1 = await db.findSession(desktopToken1);
    assertEqual(desktopLookup1?.id, activeDesktop1?.id, "توکن رایانه باید به همان نشست ذخیره‌شده برسد.");

    // 2. کاربر همزمان روی گوشی همراه (Mobile) وارد می‌شود
    const mobileToken1 = await db.createSession(user.id, 48, "mobile");
    const activeMobile1 = await db.findActiveSessionByDevice(user.id, "mobile");
    assert(Boolean(activeMobile1), "باید نشست فعال موبایل همزمان وجود داشته باشد.");
    assertEqual(activeMobile1?.user_id, user.id, "نشست فعال موبایل باید متعلق به همان کاربر باشد.");
    assertEqual(activeMobile1?.device_type, "mobile", "نوع دستگاه باید mobile باشد.");
    const mobileLookup1 = await db.findSession(mobileToken1);
    assertEqual(mobileLookup1?.id, activeMobile1?.id, "توکن موبایل باید به همان نشست ذخیره‌شده برسد.");

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

  await test("مدیریت کاربران: دسترسی اختصاصی salman.aryanezhad@gmail.com و فهرست کاربران", async () => {
    // ایجاد حساب کاربری مدیر کل
    const adminUser = await db.createUser({
      name: "سلمان آریان‌نژاد",
      email: "salman.aryanezhad@gmail.com",
      mobile: "09120000000",
      passwordHash: hashPassword("AdminPass123"),
      isVerified: true,
    });

    // بررسی اینکه نقش کاربر به صورت خودکار مدیر (admin) تعیین شده است
    const fetchedAdmin = await db.findUserByEmail("salman.aryanezhad@gmail.com");
    assertEqual(fetchedAdmin?.role, "admin", "ایمیل salman.aryanezhad@gmail.com باید دسترسی مدیر کل (admin) داشته باشد.");

    // ایجاد یک کاربر عادی
    const normalUser = await db.createUser({
      name: "کاربر معمولی",
      email: "normaluser@nexsport.ir",
      mobile: "09129998877",
      passwordHash: hashPassword("NormalPass123"),
      isVerified: true,
    });
    const fetchedNormal = await db.findUserByEmail("normaluser@nexsport.ir");
    assertEqual(fetchedNormal?.role, "user", "کاربر معمولی باید نقش عادی (user) داشته باشد.");

    // فراخوانی فهرست کامل کاربران برای نمایش در مودال مدیریت کاربران
    const allUsers = await db.listAllUsers();
    assert(Array.isArray(allUsers), "خروجی listAllUsers باید یک آرایه باشد.");
    assert(allUsers.length >= 2, "حداقل دو کاربر باید در فهرست وجود داشته باشند.");

    // بررسی ساختار فیلدهای خروجی (ردیف، نام، ایمیل، موبایل، تاریخ)
    const adminInList = allUsers.find((u) => u.email === "salman.aryanezhad@gmail.com");
    assert(Boolean(adminInList), "مدیر کل باید در فهرست کاربران حضور داشته باشد.");
    assertEqual(adminInList?.name, "سلمان آریان‌نژاد", "نام مدیر باید صحیح باشد.");
    assert(Boolean(adminInList?.created_at), "تاریخ عضویت کاربر باید ثبت شده باشد.");
    assertEqual(adminInList?.role, "admin", "مدیر کل باید نقش admin داشته باشد.");

    // بررسی عدم افشای پسورد هش در خروجی
    assert(!("password_hash" in (allUsers[0] as any)), "هش رمز عبور نباید در خروجی لیست کاربران به فرانت‌اند بازگردانده شود.");
  });

  await test("اکانت مدیر پیش‌نمایش فقط روی Vercel ساخته می‌شود", async () => {
    const prevVercel = process.env.VERCEL;
    delete process.env.VERCEL;
    const absent = await db.findUserByEmail("test@gmail.com");
    assertEqual(absent, null, "بدون VERCEL نباید اکانت تست ساخته شود.");

    process.env.VERCEL = "1";
    const seeded = await db.findUserByEmail("test@gmail.com");
    assert(Boolean(seeded), "روی Vercel اکانت تست باید موجود باشد.");
    assertEqual(seeded?.role, "admin", "اکانت تست باید نقش مدیر داشته باشد.");
    assertEqual(seeded?.name, "تست", "نام اکانت تست باید «تست» باشد.");
    assertEqual(seeded?.is_verified, true, "اکانت تست باید از قبل تایید شده باشد.");
    assert(verifyPassword("12341234", seeded!.password_hash), "رمز اکانت تست باید معتبر باشد.");
    const byMobile = await db.findUserByMobile("09112223344");
    assertEqual(byMobile?.id, seeded?.id, "ورود با موبایل تست باید همان حساب باشد.");

    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  });

  await test("پلن مالی و کد تخفیف بدون رمز فقط روی Vercel", () => {
    const prevVercel = process.env.VERCEL;
    const prevExport = process.env.NEXT_EXPORT;
    const prevPublic = process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.NEXT_EXPORT;
    assertEqual(shouldSkipAdminSensitiveReauth(), false, "روی سرور باید رمز مجدد بماند.");

    process.env.NEXT_EXPORT = "true";
    process.env.VERCEL = "1";
    assertEqual(shouldSkipAdminSensitiveReauth(), false, "خروجی استاتیک/زیپ نباید رمز را بردارد.");

    delete process.env.NEXT_EXPORT;
    process.env.VERCEL = "1";
    assertEqual(shouldSkipAdminSensitiveReauth(), true, "روی Vercel نباید رمز مجدد بخواهد.");

    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevExport === undefined) delete process.env.NEXT_EXPORT;
    else process.env.NEXT_EXPORT = prevExport;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = prevPublic;
  });

  await test("اعتبار نامحدود مدیر کل: ساخت مکرر مسابقه تستی بدون شارژ", async () => {
    const admin = await db.findUserByEmail("salman.aryanezhad@gmail.com");
    assert(Boolean(admin), "حساب مدیر باید موجود باشد.");

    const before = await db.getUserQuota(admin!.id);
    assertEqual(before.unlimitedPlanning, true, "سهمیه مدیر باید نامحدود باشد.");
    assert(before.planningCredits >= 999999, "موجودی نمایشی مدیر باید نامحدود باشد.");

    for (let i = 0; i < 12; i++) {
      const res = await db.consumePlanningCredit(admin!.id);
      assertEqual(res.success, true, `مصرف اعتبار مدیر در دور ${i + 1} باید موفق باشد.`);
      assertEqual(res.unlimitedPlanning, true, "مصرف اعتبار مدیر نباید موجودی را کم کند.");
    }

    const after = await db.getUserQuota(admin!.id);
    assertEqual(after.unlimitedPlanning, true, "پس از ساخت چند مسابقه، اعتبار مدیر همچنان نامحدود است.");
  });

  await test("لینک اختصاصی نامحدود مدیر: بدون درگاه حتی اگر زرین‌پال فعال باشد", async () => {
    const admin = await db.findUserByEmail("salman.aryanezhad@gmail.com");
    assert(Boolean(admin), "حساب مدیر باید موجود باشد.");

    const tournament = await db.saveTournament({
      userId: admin!.id,
      title: "مسابقه تست لینک مدیر",
      format: "league",
      teamCount: 4,
      state: { step: 4 },
    });

    paymentService.setGatewayDriver({
      gatewayName: "zarinpal",
      async initiatePayment() {
        return {
          success: true,
          isDirectSuccess: false,
          paymentUrl: "https://zarinpal.example/pay",
        };
      },
      async verifyPayment() {
        return { success: false, error: "should not be called" };
      },
    } as any);

    try {
      const first = await paymentService.initiateTournamentPayment({
        tournamentId: tournament.id,
        userId: admin!.id,
        userEmail: admin!.email,
      });
      assertEqual(first.success, true, "فعال‌سازی لینک مدیر باید موفق باشد.");
      assertEqual(first.isDirectSuccess, true, "مدیر نباید به درگاه پرداخت هدایت شود.");
      assertEqual(first.isAdminFree, true, "فلگ لینک رایگان مدیر باید true باشد.");
      assertEqual(first.paymentInfo.amount, 0, "مبلغ لینک مدیر باید ۰ باشد.");
      assertEqual(first.paymentInfo.gateway, "admin_free", "درگاه نباید زرین‌پال باشد.");
      assertEqual(Boolean(first.paymentUrl), false, "آدرس درگاه نباید برگردد.");
      assertEqual(await paymentService.isTournamentPaid(tournament.id), true, "لینک باید فعال شود.");

      const secondTournament = await db.saveTournament({
        userId: admin!.id,
        title: "مسابقه دوم تست لینک مدیر",
        format: "knockout",
        teamCount: 8,
        state: { step: 4 },
      });
      const second = await paymentService.initiateTournamentPayment({
        tournamentId: secondTournament.id,
        userId: admin!.id,
        userEmail: admin!.email,
      });
      assertEqual(second.isDirectSuccess, true, "لینک‌های بعدی مدیر هم باید بدون درگاه فعال شوند.");
      assertEqual(second.paymentInfo.gateway, "admin_free", "لینک دوم هم باید admin_free باشد.");
    } finally {
      paymentService.setGatewayDriver(new MockGateway());
    }
  });

  await test("مدیریت کاربران: تایید دستی کاربر در انتظار (دکمه سبز) و ورود بدون نیاز به کد تایید", async () => {
    const unverifiedEmail = "pending_approve@nexsport.ir";
    const user = await db.createUser({
      name: "کاربر تستی در انتظار",
      email: unverifiedEmail,
      mobile: "09121110022",
      passwordHash: hashPassword("Pass1234"),
      isVerified: false,
    });

    assertEqual(user.is_verified, false, "کاربر ابتدا باید در انتظار تایید باشد.");

    // مدیر روی دکمه تایید سبز کلیک می‌کند:
    await db.markUserVerified(user.id);

    const approvedUser = await db.findUserById(user.id);
    assertEqual(approvedUser?.is_verified, true, "پس از کلیک تایید، کاربر باید فعال و تایید شده باشد.");
  });

  await test("مدیریت کاربران: رد و حذف کاربر تستی در انتظار (دکمه قرمز) و خروج کامل از فهرست", async () => {
    const junkEmail = "junk_test_user@nexsport.ir";
    const junkUser = await db.createUser({
      name: "کاربر تستی نامعتبر",
      email: junkEmail,
      mobile: "09121110033",
      passwordHash: hashPassword("JunkPass12"),
      isVerified: false,
    });

    assert(Boolean(await db.findUserById(junkUser.id)), "کاربر قبل از حذف باید وجود داشته باشد.");

    // مدیر روی دکمه رد قرمز کلیک می‌کند:
    const deleteResult = await db.deleteUnverifiedUser(junkUser.id);
    assertEqual(deleteResult, true, "عملیات حذف باید با موفقیت انجام شود.");

    const afterDelete = await db.findUserById(junkUser.id);
    assertEqual(afterDelete, null, "کاربر تستی پس از رد باید کاملاً از سامانه حذف شود.");

    // محافظت: تلاش برای حذف کاربر تاییدشده باید رد شود
    const verifiedUser = await db.createUser({
      name: "کاربر رسمی تاییدشده",
      email: "official@nexsport.ir",
      mobile: "09121110044",
      passwordHash: hashPassword("Official12"),
      isVerified: true,
    });

    let prevented = false;
    try {
      await db.deleteUnverifiedUser(verifiedUser.id);
    } catch {
      prevented = true;
    }
    assert(prevented, "کاربران رسمی تاییدشده نباید قابل حذف باشند.");
  });

  await test("سیستم پرداخت و فعال‌سازی لینک اختصاصی (۱۵۰,۰۰۰ تومان و درایور شبیه‌ساز)", async () => {
    const { paymentService, DEDICATED_LINK_PRICE_TOMANS } = await import("@/lib/payment");

    // ۱. بررسی مبلغ مصوب تعرفه فاز ۳: ۱۵۰,۰۰۰ تومان
    assertEqual(DEDICATED_LINK_PRICE_TOMANS, 150000, "هزینه فعال‌سازی لینک اختصاصی باید ۱۵۰,۰۰۰ تومان باشد.");

    // ۲. ایجاد کاربر و مسابقه تستی
    const organizer = await db.createUser({
      name: "برگزارکننده لیگ آزمایشی",
      email: "organizer_pay@nexsport.ir",
      mobile: "09127778899",
      passwordHash: hashPassword("OrgSecret1"),
      isVerified: true,
    });

    const tournament = await db.saveTournament({
      userId: organizer.id,
      title: "جام برتر فوتسال فجر",
      format: "league",
      sport: "فوتسال",
      teamCount: 4,
      state: { step: 4, teams: ["تیم الف", "تیم ب", "تیم ج", "تیم د"], scores: {} },
    });

    // ۳. پیش از پرداخت: وضعیت فعال‌سازی باید false باشد
    const initialPaidStatus = await paymentService.isTournamentPaid(tournament.id);
    assertEqual(initialPaidStatus, false, "پیش از پرداخت، لینک مسابقه نباید فعال باشد.");

    // ۴. ثبت و شبیه‌سازی پرداخت ۱۵۰,۰۰۰ تومانی بدون خروج از برنامه
    const payResult = await paymentService.initiateTournamentPayment({
      tournamentId: tournament.id,
      userId: organizer.id,
      userEmail: organizer.email,
      userMobile: organizer.mobile || undefined,
      origin: "https://nexsport.ir",
    });

    assert(payResult.success, "پرداخت باید با موفقیت ثبت شود.");
    assertEqual(payResult.isDirectSuccess, true, "در حالت شبیه‌ساز، تایید باید فوری و بدون ریدایرکت باشد.");
    assertEqual(payResult.isPaid, true, "وضعیت پرداخت مسابقه باید تایید گردد.");
    assert(Boolean(payResult.refId), "باید کد رهگیری بانکی تولید شده باشد.");
    assert(payResult.refId?.startsWith("TRX-"), "فرمت کد رهگیری بانکی باید TRX- باشد.");

    // ۵. پس از پرداخت: وضعیت فعال‌سازی باید true باشد
    const afterPaidStatus = await paymentService.isTournamentPaid(tournament.id);
    assertEqual(afterPaidStatus, true, "پس از پرداخت، لینک مسابقه باید فعال باشد.");

    const paymentInfo = await paymentService.getTournamentPaymentInfo(tournament.id);
    assertEqual(paymentInfo?.amount, 150000, "مبلغ ثبت شده در تراکنش باید ۱۵۰,۰۰۰ تومان باشد.");
    assertEqual(paymentInfo?.isPaid, true, "فلگ isPaid در دیتابیس مسابقه باید true باشد.");

    // ۶. محافظت از وضعیت پرداخت در زمان ویرایش و ذخیره مجدد نتایج مسابقه
    const updatedTournament = await db.saveTournament({
      id: tournament.id,
      userId: organizer.id,
      title: "جام برتر فوتسال فجر (هفته دوم)",
      format: "league",
      sport: "فوتسال",
      teamCount: 4,
      state: { step: 4, teams: ["تیم الف", "تیم ب", "تیم ج", "تیم د"], scores: { "m-1": { home: 2, away: 0 } } },
    });

    assertEqual(updatedTournament.state?.payment?.isPaid, true, "وضعیت پرداخت نباید پس از ویرایش نتایج مسابقه پاک شود.");
  });

  await test("محدودیت کاربر مهمان: حداکثر ۲ مسابقه با ثبت و بررسی IP", async () => {
    const testIp = `192.168.10.${Math.floor(Math.random() * 200) + 10}`;

    // 1. بررسی اولیه: ۰ مسابقه استفاده شده و ۲ مسابقه باقی‌مانده
    const initial = await db.getGuestUsage(testIp);
    assertEqual(initial.count, 0, "مهمان در ابتدا باید ۰ مسابقه داشته باشد.");
    assertEqual(initial.remaining, 2, "مهمان باید ۲ مسابقه فرصت داشته باشد.");

    // 2. ایجاد مسابقه اول مهمان
    const step1 = await db.recordGuestUsage(testIp);
    assertEqual(step1.success, true, "مسابقه اول مهمان باید با موفقیت ثبت شود.");
    assertEqual(step1.count, 1, "تعداد مسابقات استفاده شده باید ۱ باشد.");
    assertEqual(step1.remaining, 1, "۱ مسابقه باقی‌مانده است.");

    // 3. ایجاد مسابقه دوم مهمان
    const step2 = await db.recordGuestUsage(testIp);
    assertEqual(step2.success, true, "مسابقه دوم مهمان باید با موفقیت ثبت شود.");
    assertEqual(step2.count, 2, "تعداد مسابقات استفاده شده باید ۲ باشد.");
    assertEqual(step2.remaining, 0, "۰ مسابقه باقی‌مانده است.");

    // 4. تلاش برای ایجاد مسابقه سوم مهمان (باید رد شود)
    const step3 = await db.recordGuestUsage(testIp);
    assertEqual(step3.success, false, "مسابقه سوم مهمان باید رد شود (تکمیل سقف).");
    assertEqual(step3.remaining, 0, "باقی‌مانده همچنان ۰ است.");
  });

  await test("سهمیه کاربر ثبت‌نام شده: ۵ برنامه‌ریزی مسابقه رایگان اولیه", async () => {
    const registeredUser = await db.createUser({
      name: "کاربر با ۵ مسابقه رایگان",
      email: "free5user@nexsport.ir",
      mobile: "09121112233",
      passwordHash: hashPassword("Secret123"),
      isVerified: true,
    });

    const quota = await db.getUserQuota(registeredUser.id);
    assertEqual(quota.planningCredits, 5, "کاربر ثبت‌نام شده باید ۵ مسابقه رایگان داشته باشد.");
    assertEqual(quota.freeLinkAvailable, true, "یک لینک هدیه رایگان باید فعال باشد.");
    assertEqual(quota.isVip, false, "کاربر نباید در ابتدا VIP باشد.");

    // استفاده از اعتبارها
    for (let i = 1; i <= 5; i++) {
      const res = await db.consumePlanningCredit(registeredUser.id);
      assertEqual(res.success, true, `برنامه‌ریزی شماره ${i} باید موفقیت‌آمیز باشد.`);
      assertEqual(res.remainingCredits, 5 - i, `اعتبار باقی‌مانده باید ${5 - i} باشد.`);
    }

    // تلاش برای برنامه‌ریزی ششم با اعتبار ۰ (باید رد شود)
    const extra = await db.consumePlanningCredit(registeredUser.id);
    assertEqual(extra.success, false, "برنامه‌ریزی بیش از ۵ مسابقه بدون خرید باید رد شود.");
    assertEqual(extra.remainingCredits, 0, "اعتبار باقی‌مانده ۰ است.");

    // خرید بسته اعتباری ۱۰ تایی روی موجودی ۰ → باید ۱۰ شود (جمع، نه جایگزینی روی عدد دیگر)
    await db.addPlanningCredits(registeredUser.id, 10);
    const afterBuyQuota = await db.getUserQuota(registeredUser.id);
    assertEqual(afterBuyQuota.planningCredits, 10, "پس از خرید ۱۰ اعتبار روی موجودی ۰ باید ۱۰ شود.");

    const afterBuyConsume = await db.consumePlanningCredit(registeredUser.id);
    assertEqual(afterBuyConsume.success, true, "پس از شارژ اعتبار باید بتواند مسابقه ایجاد کند.");
    assertEqual(afterBuyConsume.remainingCredits, 9, "موجودی باید ۹ شود.");
  });

  await test("خرید بسته اعتباری به موجودی قبلی اضافه می‌شود نه جایگزین", async () => {
    const buyer = await db.createUser({
      name: "خریدار بسته اعتباری",
      email: "credit-stack@nexsport.ir",
      mobile: "09120001122",
      passwordHash: hashPassword("Secret123"),
      isVerified: true,
    });

    const start = await db.getUserQuota(buyer.id);
    assertEqual(start.planningCredits, 5, "موجودی اولیه باید ۵ باشد.");

    const afterTen = await db.addPlanningCredits(buyer.id, 10);
    assertEqual(afterTen, 15, "۵ موجودی + بسته ۱۰ تایی باید ۱۵ شود، نه ۱۰.");
    const quotaAfterTen = await db.getUserQuota(buyer.id);
    assertEqual(quotaAfterTen.planningCredits, 15, "موجودی ذخیره‌شده باید ۱۵ باشد.");

    const afterFiveMore = await db.addPlanningCredits(buyer.id, 5);
    assertEqual(afterFiveMore, 20, "۱۵ + بسته ۵ تایی باید ۲۰ شود.");
    const quotaAfterFive = await db.getUserQuota(buyer.id);
    assertEqual(quotaAfterFive.planningCredits, 20, "موجودی ذخیره‌شده باید ۲۰ باشد.");
  });

  await test("فرمول محاسبات تخفیف بسته‌های اعتباری مسابقه (هر ۵ عدد ۱ درصد)", async () => {
    const { calculateCreditPrice } = await import("../payment/pricing");

    // ۱ عدد: ۰٪ تخفیف (بسته شروع)
    const p1 = calculateCreditPrice(1);
    assertEqual(p1.count, 1, "تعداد ۱");
    assertEqual(p1.discountPercent, 0, "تخفیف ۱ عدد ۰٪ است.");
    assertEqual(p1.finalPrice, 50000, "قیمت ۱ عدد ۵۰ هزار تومان است.");

    // ۵ عدد: ۱٪ تخفیف
    const p5 = calculateCreditPrice(5);
    assertEqual(p5.count, 5, "تعداد ۵");
    assertEqual(p5.discountPercent, 1, "تخفیف ۵ عدد ۱٪ است.");
    assertEqual(p5.finalPrice, 247500, "قیمت ۵ عدد ۲۴۷,۵۰۰ تومان است.");

    // ۱۰ عدد: ۲٪ تخفیف
    const p10 = calculateCreditPrice(10);
    assertEqual(p10.discountPercent, 2, "تخفیف ۱۰ عدد ۲٪ است.");
    assertEqual(p10.finalPrice, 490000, "قیمت ۱۰ عدد ۴۹۰ هزار تومان است.");

    // ۲۰ عدد: ۴٪ تخفیف
    const p20 = calculateCreditPrice(20);
    assertEqual(p20.discountPercent, 4, "تخفیف ۲۰ عدد ۴٪ است.");
    assertEqual(p20.baseTotal, 1000000, "قیمت پایه ۲۰ عدد ۱ میلیون است.");
    assertEqual(p20.discountTomans, 40000, "تخفیف ۴۰ هزار تومان.");
    assertEqual(p20.finalPrice, 960000, "مبلغ نهایی ۹۶۰ هزار تومان.");

    // ۵۰ عدد: ۱۰٪ تخفیف
    const p50 = calculateCreditPrice(50);
    assertEqual(p50.discountPercent, 10, "تخفیف ۵۰ عدد ۱۰٪ است.");
    assertEqual(p50.finalPrice, 2250000, "مبلغ نهایی ۵۰ عدد ۲,۲۵۰,۰۰۰ تومان است.");

    // ۱۰۰ عدد: ۲۰٪ تخفیف
    const p100 = calculateCreditPrice(100);
    assertEqual(p100.discountPercent, 20, "تخفیف ۱۰۰ عدد ۲۰٪ است.");
    assertEqual(p100.finalPrice, 4000000, "مبلغ نهایی ۱۰۰ عدد ۴,۰۰۰,۰۰۰ تومان است.");

    // عدد غیر رند و دلخواه (مثلاً ۲۵ عدد): ۵٪ تخفیف
    const p25 = calculateCreditPrice(25);
    assertEqual(p25.count, 25, "تعداد ۲۵");
    assertEqual(p25.discountPercent, 5, "تخفیف ۲۵ عدد ۵٪ است.");
    assertEqual(p25.finalPrice, 1187500, "مبلغ نهایی ۲۵ عدد ۱,۱۸۷,۵۰۰ تومان است.");

    // سقف پیش‌فرض ۲۰٪: ۵۰۰ مسابقه نباید ۹۰٪ تخفیف بگیرد
    const p500 = calculateCreditPrice(500);
    assertEqual(p500.discountPercent, 20, "سقف تخفیف پیش‌فرض بسته‌های اعتباری ۲۰٪ است.");
    assertEqual(p500.finalPrice, 20000000, "مبلغ ۵۰۰ مسابقه با سقف ۲۰٪ باید ۲۰ میلیون تومان باشد.");
  });

  await test("هدیه اولین ایجاد لینک اختصاصی رایگان و پرداخت برای لینک‌های دوم به بعد", async () => {
    const user = await db.createUser({
      name: "کاربر با لینک هدیه",
      email: "freelinkuser@nexsport.ir",
      mobile: "09123334455",
      passwordHash: hashPassword("Pass123"),
      isVerified: true,
    });

    const t1 = await db.saveTournament({
      userId: user.id,
      title: "مسابقه اول",
      format: "league",
      teamCount: 4,
      state: { step: 4 },
    });

    const t2 = await db.saveTournament({
      userId: user.id,
      title: "مسابقه دوم",
      format: "knockout",
      teamCount: 4,
      state: { step: 4 },
    });

    // ۱. فعال‌سازی لینک اول با استفاده از هدیه ثبت‌نام (۰ تومان)
    const giftResult = await paymentService.initiateTournamentPayment({
      tournamentId: t1.id,
      userId: user.id,
      useFreeGift: true,
    });
    assertEqual(giftResult.success, true, "فعال‌سازی لینک اول باید موفق باشد.");
    assertEqual(giftResult.isFreeGift, true, "باید هدیه رایگان باشد.");
    assertEqual(giftResult.paymentInfo.amount, 0, "مبلغ هدیه باید ۰ تومان باشد.");

    const t1Paid = await paymentService.isTournamentPaid(t1.id);
    assertEqual(t1Paid, true, "لینک مسابقه اول باید فعال شده باشد.");

    // ۲. بررسی سهمیه پس از استفاده از هدیه: freeLinkAvailable باید false باشد
    const quotaAfter = await db.getUserQuota(user.id);
    assertEqual(quotaAfter.freeLinkAvailable, false, "هدیه لینک اول مصرف شده است.");

    // ۳. فعال‌سازی لینک مسابقه دوم: باید ۱۵۰,۰۰۰ تومان پرداخت شود
    const secondResult = await paymentService.initiateTournamentPayment({
      tournamentId: t2.id,
      userId: user.id,
      useFreeGift: true, // حتی اگر درخواست دهد، چون هدیه تمام شده، پرداخت عادی اعمال می‌شود
    });
    assertEqual(secondResult.success, true, "پرداخت لینک دوم باید با موفقیت ثبت شود.");
    assertEqual(secondResult.paymentInfo.amount, 150000, "لینک دوم باید ۱۵۰,۰۰۰ تومان باشد.");
  });

  await test("اشتراک کاربر ویژه VIP: برنامه‌ریزی نامحدود و ایجاد نامحدود لینک‌های رایگان", async () => {
    const vipUser = await db.createUser({
      name: "کاربر ویژه طلایی",
      email: "vipuser@nexsport.ir",
      mobile: "09129998877",
      passwordHash: hashPassword("VipPass123"),
      isVerified: true,
    });

    // صفر کردن اعتبار کاربر برای آزمایش عملکرد VIP
    await db.consumePlanningCredit(vipUser.id);
    await db.consumePlanningCredit(vipUser.id);
    await db.consumePlanningCredit(vipUser.id);
    await db.consumePlanningCredit(vipUser.id);
    await db.consumePlanningCredit(vipUser.id);

    // فعال‌سازی اشتراک ۳ ماهه VIP
    await db.activateVipSubscription(vipUser.id, 3);

    const vipQuota = await db.getUserQuota(vipUser.id);
    assertEqual(vipQuota.isVip, true, "کاربر باید دارای وضعیت VIP باشد.");

    // ۱. برنامه‌ریزی نامحدود (حتی اگر اعتبار عادی ۰ بوده است)
    const consumeRes = await db.consumePlanningCredit(vipUser.id);
    assertEqual(consumeRes.success, true, "کاربر VIP بدون محدودیت مسابقه ایجاد می‌کند.");
    assertEqual(consumeRes.isVip, true, "تایید هویت VIP در برنامه‌ریزی.");

    // ۲. ایجاد لینک اختصاصی رایگان برای مسابقه (بدون پرداخت ۱۵۰,۰۰۰ تومان)
    const vipTournament = await db.saveTournament({
      userId: vipUser.id,
      title: "مسابقه بزرگ VIP",
      format: "double-knockout",
      teamCount: 8,
      state: { step: 4 },
    });

    const vipLinkResult = await paymentService.initiateTournamentPayment({
      tournamentId: vipTournament.id,
      userId: vipUser.id,
    });
    assertEqual(vipLinkResult.success, true, "لینک برای کاربر ویژه باید فعال شود.");
    assertEqual(vipLinkResult.isVipFree, true, "فلگ isVipFree باید true باشد.");
    assertEqual(vipLinkResult.paymentInfo.amount, 0, "مبلغ ایجاد لینک برای کاربر ویژه ۰ تومان است.");

    const isVipPaid = await paymentService.isTournamentPaid(vipTournament.id);
    assertEqual(isVipPaid, true, "لینک مسابقه کاربر ویژه باید فعال باشد.");
  });

  await test("مدیریت و اعمال کدهای تخفیف (ایجاد، وضعیت فعال/غیرفعال، اعتبارسنجی و اعمال روی خرید)", async () => {
    const { paymentService } = await import("@/lib/payment");

    // ۱. ایجاد کد تخفیف جدید برای هر دو بخش (۵۰٪)
    const codeAll = await db.createDiscountCode({
      code: "NOWRUZ50",
      discountPercent: 50,
      appliesTo: "all",
      isActive: true,
      createdBy: "salman.aryanezhad@gmail.com",
    });
    assertEqual(codeAll.code, "NOWRUZ50", "متن کد تخفیف باید حروف بزرگ باشد.");
    assertEqual(codeAll.discount_percent, 50, "درصد تخفیف ۵۰ است.");
    assertEqual(codeAll.is_active, true, "کد تخفیف باید فعال باشد.");

    // ۲. ایجاد کد تخفیف منحصراً برای ایجاد لینک (۲۰٪)
    const codeLink = await db.createDiscountCode({
      code: "LINK20",
      discountPercent: 20,
      appliesTo: "link",
      isActive: true,
    });
    assertEqual(codeLink.applies_to, "link", "محدوده کد تخفیف باید link باشد.");

    // ۳. ایجاد کد تخفیف منقضی شده تستی
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expiredCode = await db.createDiscountCode({
      code: "EXPIRED10",
      discountPercent: 10,
      appliesTo: "all",
      expiresAt: pastDate,
      isActive: true,
    });

    // ۴. اعتبارسنجی کد تخفیف ۵۰٪ روی هر دو بخش
    const valAllForLink = await db.validateDiscountCode("NOWRUZ50", "link");
    assertEqual(valAllForLink.valid, true, "کد تخفیف NOWRUZ50 برای لینک معتبر است.");
    assertEqual(valAllForLink.discountPercent, 50, "درصد ۵۰٪.");

    const valAllForPlanning = await db.validateDiscountCode("nowruz50", "planning");
    assertEqual(valAllForPlanning.valid, true, "کد تخفیف بدون حساسیت به حروف کوچک/بزرگ باید معتبر باشد.");

    // ۵. اعتبارسنجی کد تخفیف اختصاصی لینک روی بخش برنامه‌ریزی (باید نامعتبر باشد)
    const valLinkOnPlanning = await db.validateDiscountCode("LINK20", "planning");
    assertEqual(valLinkOnPlanning.valid, false, "کد LINK20 نباید برای بخش برنامه‌ریزی اعمال شود.");

    // ۶. اعتبارسنجی کد منقضی شده (باید رد شود)
    const valExpired = await db.validateDiscountCode("EXPIRED10", "link");
    assertEqual(valExpired.valid, false, "کد منقضی شده نباید معتبر شناخته شود.");

    // ۷. تغییر وضعیت فعال/غیرفعال (Toggle)
    const toggledOff = await db.toggleDiscountCode(codeAll.id, false);
    assertEqual(toggledOff?.is_active, false, "کد تخفیف باید غیرفعال شده باشد.");

    const valToggledOff = await db.validateDiscountCode("NOWRUZ50", "link");
    assertEqual(valToggledOff.valid, false, "کد غیرفعال نباید معتبر شناخته شود.");

    // فعال‌سازی مجدد
    const toggledOn = await db.toggleDiscountCode(codeAll.id, true);
    assertEqual(toggledOn?.is_active, true, "کد تخفیف مجدداً باید فعال شده باشد.");

    // ۸. اعمال کد تخفیف روی خرید لینک مسابقه (۱۵۰,۰۰۰ تومان با ۵۰٪ تخفیف = ۷۵,۰۰۰ تومان)
    const buyer = await db.createUser({
      name: "خریدار با تخفیف",
      email: "buyer_dsc@nexsport.ir",
      mobile: "09121112233",
      passwordHash: hashPassword("BuyerSecret1"),
      isVerified: true,
    });

    // سوزاندن هدیه لینک رایگان تا پرداخت واقعی نیاز شود
    await db.useFreeLink(buyer.id);

    const buyerTournament = await db.saveTournament({
      userId: buyer.id,
      title: "لیگ تابستانه با تخفیف",
      format: "league",
      teamCount: 6,
      state: { step: 4 },
    });

    const discountedLinkRes = await paymentService.initiateTournamentPayment({
      tournamentId: buyerTournament.id,
      userId: buyer.id,
      discountCode: "NOWRUZ50",
    });

    assertEqual(discountedLinkRes.success, true, "پرداخت لینک با کد تخفیف باید موفق باشد.");
    assertEqual(discountedLinkRes.paymentInfo.amount, 75000, "مبلغ لینک ۱۵۰,۰۰۰ با ۵۰٪ تخفیف باید ۷۵,۰۰۰ تومان باشد.");

    // ۹. حذف کد تخفیف
    const deleted = await db.deleteDiscountCode(codeLink.id);
    assertEqual(deleted, true, "کد تخفیف باید با موفقیت حذف شود.");

    const valDeleted = await db.validateDiscountCode("LINK20", "link");
    assertEqual(valDeleted.valid, false, "کد حذف‌شده نباید یافت شود.");

    // ۱۰. محدوده‌های جدید کد تخفیف: credits / vip / planning
    const codeCredits = await db.createDiscountCode({
      code: "CREDIT30",
      discountPercent: 30,
      appliesTo: "credits",
      isActive: true,
    });
    const codeVip = await db.createDiscountCode({
      code: "VIP15",
      discountPercent: 15,
      appliesTo: "vip",
      isActive: true,
    });
    const valCreditsOnCredits = await db.validateDiscountCode("CREDIT30", "credits");
    assertEqual(valCreditsOnCredits.valid, true, "کد بسته‌های اعتباری باید روی اعتبار اعمال شود.");
    const valCreditsOnVip = await db.validateDiscountCode("CREDIT30", "vip");
    assertEqual(valCreditsOnVip.valid, false, "کد بسته‌های اعتباری نباید روی VIP اعمال شود.");
    const valVipOnVip = await db.validateDiscountCode("VIP15", "vip");
    assertEqual(valVipOnVip.valid, true, "کد VIP باید روی اشتراک ویژه اعمال شود.");
    const valVipOnLink = await db.validateDiscountCode("VIP15", "link");
    assertEqual(valVipOnLink.valid, false, "کد VIP نباید روی لینک اعمال شود.");
    const valPlanningOnCredits = await db.validateDiscountCode("NOWRUZ50", "credits");
    assertEqual(valPlanningOnCredits.valid, true, "کد all باید روی اعتبار اعمال شود.");

    const portable = await db.validateDiscountCode("PORTABLE25", "vip", [
      {
        id: "portable-1",
        code: "PORTABLE25",
        discount_percent: 25,
        applies_to: "all",
        expires_at: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    assertEqual(portable.valid, true, "کد تخفیف باید از کاتالوگ کمکی هم اعمال شود.");
    assertEqual(portable.discountPercent, 25, "درصد کاتالوگ کمکی ۲۵ است.");

    // ۱۱. کد تخفیف روی مبلغ نهایی قبلی اعمال می‌شود (تخفیف حجمی + کوپن)
    const creditBuyer = await db.createUser({
      name: "خریدار بسته با تخفیف دو لایه",
      email: "stack_dsc@nexsport.ir",
      mobile: "09120001122",
      passwordHash: hashPassword("StackSecret1"),
      isVerified: true,
    });
    const stacked = await paymentService.initiateCreditPackagePayment({
      userId: creditBuyer.id,
      creditCount: 100,
      discountCode: "CREDIT30",
    });
    assertEqual(stacked.success, true, "خرید بسته ۱۰۰ تایی با کوپن باید موفق باشد.");
    // ۱۰۰ × ۵۰هزار = ۵ میلیون، ۲۰٪ تخفیف حجمی = ۴ میلیون، سپس ۳۰٪ کوپن روی ۴ میلیون = ۲٫۸ میلیون
    assertEqual(stacked.amountTomans, 2800000, "کوپن باید روی مبلغ نهایی قبلی (پس از تخفیف حجمی) اعمال شود.");
  });

  await test("تنظیمات مالی مدیر: ذخیره و اعمال تعرفه سفارشی بدون کدنویسی", async () => {
    const { calculateCreditPrice, buildVipPlans } = await import("../payment/pricing");

    const defaults = await db.getPricingSettings();
    assertEqual(defaults.creditPriceTomans, 50000, "مبلغ پیش‌فرض هر مسابقه ۵۰ هزار تومان است.");
    assertEqual(defaults.creditDiscountEvery, 5, "پله تخفیف پیش‌فرض هر ۵ مسابقه است.");
    assertEqual(defaults.creditDiscountPercent, 1, "درصد پیش‌فرض هر پله ۱٪ است.");
    assertEqual(defaults.creditDiscountMaxPercent, 20, "سقف تخفیف پیش‌فرض ۲۰٪ است.");
    assertEqual(defaults.vipMonthlyTomans, 350000, "مبلغ ماهانه VIP پیش‌فرض ۳۵۰ هزار تومان است.");
    assertEqual(defaults.vipDiscount3mPercent, 20, "تخفیف پیش‌فرض ۳ ماهه VIP ۲۰٪ است.");
    assertEqual(defaults.vipDiscount6mPercent, 25, "تخفیف پیش‌فرض ۶ ماهه VIP ۲۵٪ است.");
    assertEqual(defaults.vipDiscount12mPercent, 30, "تخفیف پیش‌فرض سالانه VIP ۳۰٪ است.");
    assertEqual(defaults.linkPriceTomans, 150000, "تعرفه لینک پیش‌فرض ۱۵۰ هزار تومان است.");

    const saved = await db.savePricingSettings({
      creditPriceTomans: 40000,
      creditDiscountEvery: 10,
      creditDiscountPercent: 2,
      creditDiscountMaxPercent: 15,
      vipMonthlyTomans: 400000,
      vipDiscount3mPercent: 10,
      vipDiscount6mPercent: 25,
      vipDiscount12mPercent: 35,
      linkPriceTomans: 180000,
    });
    assertEqual(saved.creditPriceTomans, 40000, "مبلغ هر مسابقه باید ۴۰ هزار ذخیره شود.");
    assertEqual(saved.linkPriceTomans, 180000, "تعرفه لینک باید ۱۸۰ هزار ذخیره شود.");

    const loaded = await db.getPricingSettings();
    assertEqual(loaded.vipDiscount12mPercent, 35, "تخفیف سالانه باید ۳۵٪ خوانده شود.");

    const p100 = calculateCreditPrice(100, loaded);
    assertEqual(p100.discountPercent, 15, "۱۰۰ مسابقه با هر ۱۰ تا ۲٪ به سقف ۱۵٪ می‌رسد.");
    assertEqual(p100.finalPrice, 3400000, "مبلغ نهایی ۱۰۰ مسابقه با تعرفه ۴۰هزار و سقف ۱۵٪ ۳٫۴ میلیون است.");

    const plans = buildVipPlans(loaded);
    const y = plans.find((p) => p.id === "vip-12m");
    assertEqual(y?.basePriceTomans, 4800000, "قیمت پایه سالانه باید ۴٫۸ میلیون باشد.");
    assertEqual(y?.finalPriceTomans, 3120000, "قیمت نهایی سالانه با ۳۵٪ تخفیف ۳٫۱۲۰ میلیون است.");
    assertEqual(y?.discountPercent, 35, "لیبل سالانه باید همان درصد ذخیره‌شده مدیر باشد.");
    assertEqual(y?.tag, "35٪ تخفیف", "برچسب پلن باید فقط درصد تخفیف تنظیم‌شده باشد.");
    assert(!String(y?.tag || "").includes("اقتصادی"), "برچسب اقتصادی نباید روی پلن باشد.");
    const month = plans.find((p) => p.id === "vip-1m");
    assertEqual(month?.tag, undefined, "پلن بدون تخفیف نباید لیبل تبلیغاتی داشته باشد.");

    // بازگردانی پیش‌فرض برای ایزوله ماندن تست‌های بعدی
    await db.savePricingSettings({
      creditPriceTomans: 50000,
      creditDiscountEvery: 5,
      creditDiscountPercent: 1,
      creditDiscountMaxPercent: 20,
      vipMonthlyTomans: 350000,
      vipDiscount3mPercent: 20,
      vipDiscount6mPercent: 25,
      vipDiscount12mPercent: 30,
      linkPriceTomans: 150000,
    });
  });

  await test("سیستم تیکت پشتیبانی: ثبت، ترتیب پیام‌ها، پاسخ‌نداده/پاسخ‌داده و نوتیف کاربر", async () => {
    const member = await db.createUser({
      name: "کاربر تیکت",
      email: "ticket.user@nexsport.ir",
      mobile: "09123334400",
      passwordHash: hashPassword("TicketPass1"),
      isVerified: true,
    });

    const created = await db.createTicket({
      userId: member.id,
      subject: "مشکل در فعال‌سازی لینک",
      body: "لینک اختصاصی بعد از پرداخت باز نمی‌شود.",
    });
    assertEqual(created.ticket.status, "unanswered", "تیکت تازه باید پاسخ‌نداده باشد.");
    assertEqual(created.ticket.user_has_unread, false, "کاربر برای تیکت خودش نوتیف نمی‌گیرد.");
    assertEqual(created.message.sender, "user", "اولین پیام از کاربر است.");

    const unanswered = await db.countUnansweredTickets();
    assert(unanswered >= 1, "حداقل یک تیکت پاسخ‌نداده باید وجود داشته باشد.");

    const listed = await db.listUserTickets(member.id);
    assertEqual(listed.length, 1, "کاربر باید تیکت خودش را ببیند.");
    assertEqual(listed[0].subject, "مشکل در فعال‌سازی لینک", "موضوع باید ذخیره شده باشد.");

    const adminReply = await db.addTicketMessage({
      ticketId: created.ticket.id,
      sender: "admin",
      body: "پرداخت شما تایید شد؛ لینک را یک‌بار تازه‌سازی کنید.",
    });
    assert(Boolean(adminReply), "پاسخ مدیر باید ثبت شود.");

    const afterReply = await db.getTicket(created.ticket.id);
    assertEqual(afterReply?.status, "answered", "پس از پاسخ مدیر وضعیت باید پاسخ‌داده شود.");
    assertEqual(afterReply?.user_has_unread, true, "کاربر باید نوتیف پاسخ جدید بگیرد.");

    const unread = await db.countUserUnreadTickets(member.id);
    assertEqual(unread, 1, "یک تیکت خوانده‌نشده برای کاربر.");

    const marked = await db.markTicketReadByUser(created.ticket.id, member.id);
    assertEqual(marked?.user_has_unread, false, "با باز کردن تیکت، نوتیف کاربر پاک شود.");

    const userFollowUp = await db.addTicketMessage({
      ticketId: created.ticket.id,
      sender: "user",
      body: "انجام شد، الان باز می‌شود. سپاس.",
    });
    assert(Boolean(userFollowUp), "پیام بعدی کاربر باید ثبت شود.");

    const afterUser = await db.getTicket(created.ticket.id);
    assertEqual(afterUser?.status, "unanswered", "پیام جدید کاربر دوباره تیکت را پاسخ‌نداده می‌کند.");
    assertEqual(afterUser?.user_has_unread, false, "پیام خود کاربر نوتیف برای خودش نمی‌سازد.");

    const thread = await db.listTicketMessages(created.ticket.id);
    assertEqual(thread.length, 3, "گفتگو باید سه پیام به‌ترتیب داشته باشد.");
    assertEqual(thread[0].sender, "user", "پیام اول کاربر.");
    assertEqual(thread[1].sender, "admin", "پیام دوم مدیر.");
    assertEqual(thread[2].sender, "user", "پیام سوم کاربر.");
    assert(
      thread[0].created_at.getTime() <= thread[1].created_at.getTime() &&
        thread[1].created_at.getTime() <= thread[2].created_at.getTime(),
      "پیام‌ها باید به‌ترتیب زمان باشند."
    );

    const adminList = await db.listAdminTickets();
    const found = adminList.find((t) => t.id === created.ticket.id);
    assert(Boolean(found), "تیکت باید در پنل مدیر دیده شود.");
    assertEqual(found?.user_name, "کاربر تیکت", "نام کاربر در فهرست مدیر مشخص باشد.");
  });

  await test("تیم و بازیکن: اعتبارسنجی، کد ملی اختیاری، شماره پیراهن یکتا", async () => {
    const { sanitizeTeamInput, sanitizePlayerInput } = await import("../teams/validate");

    const emptyTeam = sanitizeTeamInput({ name: "" });
    assert(!emptyTeam.ok, "نام خالی تیم باید رد شود.");

    const yearFa = sanitizeTeamInput({ name: "پرسپولیس", founded_year: "۱۴۰۰" });
    assert(yearFa.ok, "سال شمسی با ارقام فارسی باید قبول شود.");
    if (yearFa.ok) assertEqual(yearFa.data.founded_year, "1400", "سال باید به ارقام انگلیسی تبدیل شود.");

    const badYear = sanitizeTeamInput({ name: "پرسپولیس", founded_year: "1998" });
    assert(!badYear.ok, "سال میلادی خارج از بازه شمسی باید رد شود.");

    const emptyNid = sanitizePlayerInput({ name: "علی" });
    assert(emptyNid.ok, "کد ملی اختیاری است.");
    if (emptyNid.ok) assertEqual(emptyNid.data.national_id, "", "کد ملی خالی بماند.");

    const nidFa = sanitizePlayerInput({ name: "علی", national_id: "۱۲۳۴۵۶۷۸۹۰", jersey_number: "۱۰" });
    assert(nidFa.ok, "کد ملی ۱۰ رقمی فارسی باید قبول شود.");
    if (nidFa.ok) {
      assertEqual(nidFa.data.national_id, "1234567890", "کد ملی به انگلیسی.");
      assertEqual(nidFa.data.jersey_number, "10", "شماره پیراهن به انگلیسی.");
    }

    const badNid = sanitizePlayerInput({ name: "علی", national_id: "12345" });
    assert(!badNid.ok, "کد ملی ناقص باید رد شود.");

    const owner = await db.createUser({
      name: "مالک تیم",
      email: "team-owner@nexsport.ir",
      mobile: "09120001122",
      password_hash: hashPassword("12345678"),
      is_verified: true,
    });
    const teamIn = sanitizeTeamInput({ name: "نکس اسپورت", sport: "فوتسال", city: "تهران", founded_year: "1402" });
    assert(teamIn.ok, "ورودی تیم معتبر.");
    if (!teamIn.ok) return;
    const team = await db.createTeam(owner.id, teamIn.data);
    assert(Boolean(team.id), "تیم باید شناسه داشته باشد.");
    assertEqual(team.sport, "فوتسال", "رشته ورزشی ذخیره شود.");

    const listed = await db.listTeams(owner.id);
    assert(listed.some((t) => t.id === team.id), "تیم در فهرست مالک باشد.");

    if (!nidFa.ok) return;
    const p1 = await db.createPlayer(team.id, nidFa.data);
    assert(!("error" in p1), "بازیکن اول باید ثبت شود.");

    const dup = await db.createPlayer(team.id, {
      name: "رضا",
      jersey_number: "10",
      position: "",
      birth_date: "",
      mobile: "",
      national_id: "",
      status: "active",
    });
    assert("error" in dup, "شماره پیراهن تکراری در یک تیم باید رد شود.");

    const p2in = sanitizePlayerInput({ name: "حسن", jersey_number: "9", status: "injured" });
    assert(p2in.ok, "بازیکن دوم معتبر.");
    if (!p2in.ok) return;
    const p2 = await db.createPlayer(team.id, p2in.data);
    assert(!("error" in p2), "بازیکن با شماره متفاوت ثبت شود.");

    const roster = await db.listPlayers(team.id);
    assertEqual(roster.length, 2, "دو بازیکن در فهرست.");

    await db.deletePlayer(("id" in p2 ? p2.id : "") as string);
    const afterDel = await db.listPlayers(team.id);
    assertEqual(afterDel.length, 1, "پس از حذف یک بازیکن بماند.");

    await db.deleteTeam(team.id);
    const afterTeam = await db.getTeam(team.id);
    assertEqual(afterTeam, null, "پس از حذف، تیم وجود نداشته باشد.");
    const orphanPlayers = await db.listPlayers(team.id);
    assertEqual(orphanPlayers.length, 0, "بازیکنان تیم حذف‌شده پاک شوند.");
  });

  await test("تبدیل تقویم شمسی و میلادی", async () => {
    const { gregorianToJalali, jalaliToGregorian, parseJalaliInput } = await import("../jalali");
    const j = gregorianToJalali(2026, 3, 21);
    assertEqual(j.y, 1405, "۲۱ مارس ۲۰۲۶ باید ۱ فروردین ۱۴۰۵ باشد (سال).");
    assertEqual(j.m, 1, "۲۱ مارس ۲۰۲۶ باید فروردین باشد.");
    assertEqual(j.d, 1, "۲۱ مارس ۲۰۲۶ باید روز اول باشد.");

    const g = jalaliToGregorian(1403, 6, 25);
    assertEqual(g.gy, 2024, "۲۵ شهریور ۱۴۰۳ سال میلادی.");
    assertEqual(g.gm, 9, "۲۵ شهریور ۱۴۰۳ ماه سپتامبر.");
    assertEqual(g.gd, 15, "۲۵ شهریور ۱۴۰۳ روز ۱۵.");

    const parsed = parseJalaliInput("۱۴۰۴/۰۷/۱۰");
    assert(Boolean(parsed), "تاریخ شمسی با ارقام فارسی باید خوانده شود.");
    assertEqual(parsed?.y, 1404, "سال ۱۴۰۴");
    assertEqual(parsed?.m, 7, "مهر");
    assertEqual(parsed?.d, 10, "روز ۱۰");
  });

  console.log("\n======================================");
  console.log(`تست‌های موفق: ${passed}`);
  console.log(`تست‌های ناموفق: ${failed}`);
  console.log("======================================\n");

  if (failed > 0) process.exit(1);
}

run();
