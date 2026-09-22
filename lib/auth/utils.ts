export function toEnglishDigits(str: string): string {
  if (!str) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], "g"), String(i));
    result = result.replace(new RegExp(arabicDigits[i], "g"), String(i));
  }
  return result;
}

export function cleanMobileNumber(mobile: string): string {
  const normalized = toEnglishDigits(mobile).replace(/\s+/g, "").replace(/-/g, "");
  // If starts with +98 or 0098, normalize to 09...
  if (normalized.startsWith("+98")) {
    return "0" + normalized.slice(3);
  }
  if (normalized.startsWith("0098")) {
    return "0" + normalized.slice(4);
  }
  return normalized;
}

export function cleanEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}
