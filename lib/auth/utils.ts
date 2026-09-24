export function toEnglishDigits(str: string): string {
  if (!str) return "";
  const persianDigits   = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits    = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const fullwidthDigits = ["０", "１", "۲", "３", "۴", "۵", "۶", "۷", "۸", "۹"];

  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], "g"), String(i));
    result = result.replace(new RegExp(arabicDigits[i], "g"), String(i));
    result = result.replace(new RegExp(fullwidthDigits[i], "g"), String(i));
  }
  return result;
}

export function cleanMobileNumber(mobile: string): string {
  if (!mobile) return "";
  const digits = toEnglishDigits(mobile).replace(/[^\d]/g, "");
  if (digits.startsWith("98") && digits.length === 12) {
    return "0" + digits.slice(2);
  }
  if (digits.startsWith("0098") && digits.length === 14) {
    return "0" + digits.slice(4);
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return "0" + digits;
  }
  return digits;
}

export function cleanEmailAddress(email: string): string {
  if (!email) return "";
  const normalized = toEnglishDigits(email)
    .replace(/[\u200C\u200B\uFEFF]/g, "")
    .trim()
    .toLowerCase();
  return normalized;
}

/**
 * بررسی اینکه آیا متن حاوی حروف یا کاراکترهای الفبای فارسی/عربی است یا خیر.
 * (ارقام فارسی/عربی ۰ تا ۹ مجاز هستند و به صورت خودکار به ارقام انگلیسی تبدیل می‌شوند)
 */
export function hasPersianLetters(str: string): boolean {
  if (!str) return false;
  return /[\u0600-\u065F\u066A-\u06EF\u06FA-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D]/.test(str);
}

