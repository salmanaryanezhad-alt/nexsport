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
  avoidPairs?: [string, string][];
}

export function buildGroups({
  teams,
  numGroups,
  seededTeams,
  avoidPairs = [],
}: BuildGroupsParams): GroupResult[] {
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

  // Validate avoidance pairs
  for (const [a, b] of avoidPairs) {
    if (!teams.includes(a) || !teams.includes(b)) {
      throw new ScheduleValidationError(
        `تیم «${!teams.includes(a) ? a : b}» در لیست تیم‌ها برای قانون عدم برخورد یافت نشد.`
      );
    }
  }

  // Build adjacency map for avoidance
  const avoidMap = new Map<string, Set<string>>();
  for (const [a, b] of avoidPairs) {
    if (!avoidMap.has(a)) avoidMap.set(a, new Set());
    if (!avoidMap.has(b)) avoidMap.set(b, new Set());
    avoidMap.get(a)!.add(b);
    avoidMap.get(b)!.add(a);
  }

  const minSize = Math.floor(teams.length / numGroups);
  const extra = teams.length % numGroups;

  // Each bucket has an allowed max capacity so group sizes differ by at most 1
  const capacities = Array.from({ length: numGroups }, (_, i) =>
    i < extra ? minSize + 1 : minSize
  );

  const remaining = shuffle(teams.filter((t) => !seededTeams.includes(t)));

  // Try to find a valid assignment that respects avoidance constraints
  let success = false;
  let finalBuckets: string[][] = [];

  // Attempt up to 50 randomized search passes
  for (let attempt = 0; attempt < 50; attempt++) {
    const buckets: string[][] = Array.from({ length: numGroups }, () => []);

    // Place seeded teams
    seededTeams.forEach((team, i) => {
      buckets[i].push(team);
    });

    const unassigned = attempt === 0 ? remaining : shuffle([...remaining]);

    // Backtracking solver for remaining teams
    function backtrack(idx: number): boolean {
      if (idx === unassigned.length) {
        return true;
      }
      const current = unassigned[idx];
      const avoided = avoidMap.get(current);

      // Try buckets ordered by least filled
      const bucketOrder = Array.from({ length: numGroups }, (_, i) => i).sort(
        (a, b) => buckets[a].length - buckets[b].length
      );

      for (const bIdx of bucketOrder) {
        if (buckets[bIdx].length >= capacities[bIdx]) continue;

        // Check avoidance conflict
        if (avoided && buckets[bIdx].some((member) => avoided.has(member))) {
          continue;
        }

        buckets[bIdx].push(current);
        if (backtrack(idx + 1)) return true;
        buckets[bIdx].pop();
      }

      return false;
    }

    if (backtrack(0)) {
      finalBuckets = buckets;
      success = true;
      break;
    }
  }

  if (!success) {
    throw new ScheduleValidationError(
      "قوانین انتخاب‌شده با ساختار این مسابقه سازگار نیستند: تفکیک تیم‌های مشخص‌شده در این تعداد گروه امکان‌پذیر نیست."
    );
  }

  return finalBuckets.map((groupTeams, i) => {
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
