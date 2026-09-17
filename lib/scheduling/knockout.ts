import { BracketMatch, BracketRound, KnockoutResult, ScheduleValidationError } from "./types";
import { shuffle } from "./shuffle";

const BYE = null;

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Classic tournament seeding order, e.g. for size 8: [1,8,4,5,2,7,3,6].
 * Keeps seed 1 and seed 2 on opposite halves of the bracket, and seeds
 * 1-4 apart from each other for as long as possible, which is what lets
 * "seeded" / "top" teams avoid meeting early.
 */
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const doubled = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed);
      next.push(doubled + 1 - seed);
    }
    order = next;
  }
  return order;
}

const roundLabel = (roundsFromFinal: number): string => {
  if (roundsFromFinal === 0) return "فینال";
  if (roundsFromFinal === 1) return "نیمه‌نهایی";
  if (roundsFromFinal === 2) return "یک‌چهارم نهایی";
  if (roundsFromFinal === 3) return "یک‌هشتم نهایی";
  return `دور ${roundsFromFinal + 1} مانده به فینال`;
};

export interface BuildKnockoutParams {
  teams: string[];
  seededTeams: string[];
}

/**
 * Builds a single-elimination bracket. Teams beyond the ordered
 * `seededTeams` list fill the remaining seed slots in their given order.
 * Byes (when team count isn't a power of two) are awarded to the
 * top seeds, who auto-advance to round 2.
 */
export function buildKnockout({ teams, seededTeams }: BuildKnockoutParams): KnockoutResult {
  if (teams.length < 2) {
    throw new ScheduleValidationError("برای تولید براکت حذفی حداقل به ۲ تیم نیاز است.");
  }
  const unknownSeed = seededTeams.find((t) => !teams.includes(t));
  if (unknownSeed) {
    throw new ScheduleValidationError(`تیم شاخص «${unknownSeed}» در لیست تیم‌ها یافت نشد.`);
  }

  const bracketSize = nextPowerOfTwo(teams.length);
  const byes = bracketSize - teams.length;

  // Order teams: seeded teams first (in the priority given), then the rest
  // filling remaining seed slots. Unseeded teams are drawn randomly, so a
  // bracket with no seeding rules at all is a fully random draw.
  const rest = shuffle(teams.filter((t) => !seededTeams.includes(t)));
  const seedToTeam = new Map<number, string | null>();
  const orderedTeams = [...seededTeams, ...rest];
  for (let i = 0; i < bracketSize; i++) {
    seedToTeam.set(i + 1, orderedTeams[i] ?? null); // null = empty bracket slot
  }

  const order = seedOrder(bracketSize);
  // Byes go to the lowest-numbered seeds (the strongest seeds), so give the
  // BYE marker to the last `byes` real slots in bracket order, working from
  // the weakest (highest seed number) end that actually lacks an opponent.
  const slotTeams: (string | typeof BYE)[] = order.map((seed) => seedToTeam.get(seed) ?? BYE);

  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketRound[] = [];

  // Round 1: a missing side here is a *known* bye (BYE), never an unknown
  // TBD — that distinction matters for how the UI labels the empty slot.
  const round1Matches: BracketMatch[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const home = slotTeams[i * 2];
    const away = slotTeams[i * 2 + 1];
    const autoAdvance = home && !away ? home : !home && away ? away : null;
    round1Matches.push({
      id: `r1-m${i + 1}`,
      round: 1,
      slot: i,
      home: home ?? (autoAdvance ? "BYE" : null),
      away: away ?? (autoAdvance ? "BYE" : null),
      autoAdvance,
    });
  }
  rounds.push({ round: 1, label: roundLabel(totalRounds - 1), matches: round1Matches });

  // Subsequent rounds: winners are unknown at generation time (TBD) unless
  // a match auto-advanced via bye, in which case we can fill it in now.
  let previousMatches = round1Matches;
  for (let r = 2; r <= totalRounds; r++) {
    const matches: BracketMatch[] = [];
    for (let i = 0; i < previousMatches.length / 2; i++) {
      const feederA = previousMatches[i * 2];
      const feederB = previousMatches[i * 2 + 1];
      const home = feederA.autoAdvance ?? null;
      const away = feederB.autoAdvance ?? null;
      matches.push({
        id: `r${r}-m${i + 1}`,
        round: r,
        slot: i,
        home,
        away,
        autoAdvance: null,
      });
    }
    rounds.push({ round: r, label: roundLabel(totalRounds - r), matches });
    previousMatches = matches;
  }

  return { bracketSize, byes, rounds };
}
