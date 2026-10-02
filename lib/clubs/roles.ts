export const CLUB_MEMBER_ROLES = ["owner", "manager", "coach", "member"] as const;
export type ClubMemberRole = (typeof CLUB_MEMBER_ROLES)[number];
export type ClubMemberStatus = "pending" | "active";

export const CLUB_COACH_TITLES = [
  "سرمربی",
  "کمک‌مربی",
  "مربی دروازه‌بان",
  "مربی بدنساز",
  "مربی نوجوانان",
  "سایر",
] as const;

export function clubRoleLabel(role?: string) {
  switch (role) {
    case "owner":
      return "مالک";
    case "manager":
      return "مدیر باشگاه";
    case "coach":
      return "مربی";
    case "member":
      return "عضو";
    default:
      return "عضو";
  }
}

export function canEditClub(role?: string | null, isAdmin = false) {
  return Boolean(isAdmin || role === "owner" || role === "manager");
}

export function canManageMembers(role?: string | null, isAdmin = false) {
  return Boolean(isAdmin || role === "owner" || role === "manager");
}
