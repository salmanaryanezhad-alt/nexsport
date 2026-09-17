import { GroupResult, ScheduleValidationError } from "./types";
import { generateSingleRoundRobin } from "./roundRobin";
import { shuffle } from "./shuffle";

function groupLabel(index: number): string {
  // A, B, C ... Z, AA, AB ...
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export interface BuildGroupsParams {
  teams: string[];
  numGroups: number;
  seededTeams: string[];
}

export function buildGroups({ teams, numGroups, seededTeams }: BuildGroupsParams): GroupResult[] {
  if (numGroups < 1) {
    throw new ScheduleValidationError("تعداد گروه‌ها باید حداقل ۱ باشد.");
  }
  if (numGroups > teams.length) {
    throw new ScheduleValidationError(
      "قوانین انتخاب‌شده با ساختار این مسابقه سازگار نیستند: تعداد گروه‌ها نمی‌تواند بیشتر از تعداد تیم‌ها باشد."
    );
  }
  if (seededTeams.length > numGroups) {
    throw new ScheduleValidationError(
      "قوانین انتخاب‌شده با ساختار این مسابقه سازگار نیستند: تعداد تیم‌های شاخص نمی‌تواند بیشتر از تعداد گروه‌ها باشد."
    );
  }
  const unknownSeed = seededTeams.find((t) => !teams.includes(t));
  if (unknownSeed) {
    throw new ScheduleValidationError(`تیم شاخص «${unknownSeed}» در لیست تیم‌ها یافت نشد.`);
  }

  const buckets: { id: number; teams: string[] }[] = Array.from({ length: numGroups }, (_, id) => ({
    id,
    teams: [],
  }));

  // Seeded teams: one per group, in the order the organizer specified.
  seededTeams.forEach((team, i) => {
    buckets[i].teams.push(team);
  });

  // Remaining teams are shuffled, then dealt into the smallest groups first
  // so group sizes never differ by more than one. Sorting by size (not id)
  // is intentional here; the final .sort((a,b) => a.id - b.id) below restores
  // the stable A/B/C group order for display.
  const remaining = shuffle(teams.filter((t) => !seededTeams.includes(t)));
  for (const team of remaining) {
    buckets.sort((a, b) => a.teams.length - b.teams.length);
    buckets[0].teams.push(team);
  }

  const ordered = buckets.sort((a, b) => a.id - b.id).map((b) => b.teams);

  return ordered.map((groupTeams, i) => {
    const gName = `گروه ${groupLabel(i)}`;
    const rounds = groupTeams.length >= 2 ? generateSingleRoundRobin(groupTeams) : [];
    const prefixedRounds = rounds.map((r) => ({
      ...r,
      matches: r.matches.map((m) => ({
        ...m,
        id: `g${i + 1}-${m.id ?? "m"}`,
      })),
    }));

    return {
      name: gName,
      teams: groupTeams,
      rounds: prefixedRounds,
    };
  });
}
