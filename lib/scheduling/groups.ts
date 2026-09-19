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

/**
 * Calculates the default number of groups such that each group has at most 4 teams:
 * - Up to 4 teams -> 1 group
 * - Up to 8 teams -> 2 groups
 * - Up to 12 teams -> 3 groups
 * - Up to 16 teams -> 4 groups
 * - And so on (ceil(teamCount / 4))
 */
export function calculateDefaultNumGroups(teamCount: number): number {
  if (teamCount <= 0) return 1;
  return Math.max(1, Math.ceil(teamCount / 4));
}

export interface BuildGroupsParams {
  teams: string[];
  numGroups: number;
  seededTeams?: string[];
  pot2Teams?: string[];
  pot3Teams?: string[];
  pot4Teams?: string[];
  pots?: string[][];
  avoidPairs?: [string, string][];
}

export function buildGroups({
  teams,
  numGroups,
  seededTeams = [],
  pot2Teams = [],
  pot3Teams = [],
  pot4Teams = [],
  pots,
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

  // Normalize pots: either explicit pots array or [seededTeams (Pot 1), pot2Teams, pot3Teams, pot4Teams]
  const normalizedPots: string[][] = pots
    ? pots
    : [seededTeams ?? [], pot2Teams ?? [], pot3Teams ?? [], pot4Teams ?? []];

  // Validate that no pot has more teams than numGroups
  for (let pIdx = 0; pIdx < normalizedPots.length; pIdx++) {
    const potList = normalizedPots[pIdx];
    const potNum = pIdx + 1;
    if (potList.length > numGroups) {
      const potLabel = potNum === 1 ? "سرگروه‌ها (سید ۱)" : `سید ${potNum}`;
      throw new ScheduleValidationError(
        `قوانین انتخاب‌شده با ساختار این مسابقه سازگار نیستند: تعداد تیم‌های ${potLabel} (${potList.length}) نمی‌تواند بیشتر از تعداد گروه‌ها (${numGroups}) باشد.`
      );
    }

    for (const t of potList) {
      if (!teams.includes(t)) {
        throw new ScheduleValidationError(`تیم شاخص «${t}» در سید ${potNum} در لیست تیم‌ها یافت نشد.`);
      }
    }
  }

  // Validate that no team appears in multiple pots
  const potMembership = new Map<string, number>();
  for (let pIdx = 0; pIdx < normalizedPots.length; pIdx++) {
    for (const t of normalizedPots[pIdx]) {
      if (potMembership.has(t)) {
        const prevPot = potMembership.get(t)! + 1;
        throw new ScheduleValidationError(
          `تیم «${t}» نمی‌تواند همزمان در سید ${prevPot} و سید ${pIdx + 1} انتخاب شود.`
        );
      }
      potMembership.set(t, pIdx);
    }
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

  const pot1 = normalizedPots[0] ?? [];
  const otherPots = normalizedPots.slice(1);
  const unseededTeams = teams.filter((t) => !potMembership.has(t));

  // Try to find a valid assignment that respects pot constraints, capacities, and avoidance
  let success = false;
  let finalBuckets: string[][] = [];

  for (let attempt = 0; attempt < 50; attempt++) {
    const buckets: string[][] = Array.from({ length: numGroups }, () => []);

    // 1. Assign Pot 1 teams to random distinct buckets
    const pot1Buckets = shuffle(Array.from({ length: numGroups }, (_, i) => i));
    pot1.forEach((team, i) => {
      buckets[pot1Buckets[i]].push(team);
    });

    // 2. Prepare remaining teams to be assigned:
    // Order by pots (Pot 2, then Pot 3, then Pot 4, then unseeded)
    const teamsToAssign: string[] = [];
    for (const pot of otherPots) {
      teamsToAssign.push(...shuffle(pot));
    }
    teamsToAssign.push(...shuffle(unseededTeams));

    // Backtracking solver
    function backtrack(idx: number): boolean {
      if (idx === teamsToAssign.length) {
        return true;
      }
      const current = teamsToAssign[idx];
      const pIdx = potMembership.get(current); // undefined if unseeded
      const avoided = avoidMap.get(current);

      // Randomize bucket trial order to ensure varied group draws
      const bucketOrder = shuffle(Array.from({ length: numGroups }, (_, i) => i)).sort(
        (a, b) => buckets[a].length - buckets[b].length
      );

      for (const bIdx of bucketOrder) {
        if (buckets[bIdx].length >= capacities[bIdx]) continue;

        // Pot constraint: bucket cannot already contain a team from the same pot
        if (pIdx !== undefined && buckets[bIdx].some((m) => potMembership.get(m) === pIdx)) {
          continue;
        }

        // Avoidance conflict
        if (avoided && buckets[bIdx].some((m) => avoided.has(m))) {
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
      "قوانین انتخاب‌شده با ساختار این مسابقه سازگار نیستند: تفکیک تیم‌های مشخص‌شده در سیدها و قوانین عدم برخورد در این تعداد گروه امکان‌پذیر نیست."
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
