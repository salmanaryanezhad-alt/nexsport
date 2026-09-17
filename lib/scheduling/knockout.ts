import { BracketMatch, BracketRound, KnockoutResult, ScheduleValidationError } from "./types";
import { shuffle } from "./shuffle";

const BYE = null;

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Classic tournament seeding order, e.g. for size 8: [1,8,4,5,2,7,3,6].
 * Keeps seed 1 and seed 2 on opposite halves of the bracket, and seeds
 * 1-4 apart from each other for as long as possible.
 */
export function seedOrder(size: number): number[] {
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

export const roundLabel = (roundsFromFinal: number): string => {
  if (roundsFromFinal === 0) return "فینال";
  if (roundsFromFinal === 1) return "نیمه‌نهایی";
  if (roundsFromFinal === 2) return "یک‌چهارم نهایی";
  if (roundsFromFinal === 3) return "یک‌هشتم نهایی";
  return `دور ${roundsFromFinal + 1} مانده به فینال`;
};

export interface MatchScore {
  home: number | null;
  away: number | null;
  winner?: string | null;
}

export function computeKnockoutWithScores(
  knockout: KnockoutResult,
  scores: Record<string, MatchScore>
): { knockout: KnockoutResult; champion: string | null } {
  const rounds: BracketRound[] = knockout.rounds.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < rounds.length; r++) {
    const currentRound = rounds[r];
    const prevRound = r > 0 ? rounds[r - 1] : null;

    for (let i = 0; i < currentRound.matches.length; i++) {
      const match = currentRound.matches[i];

      if (prevRound) {
        const feederA = prevRound.matches[i * 2];
        const feederB = prevRound.matches[i * 2 + 1];
        if (feederA) {
          match.home = feederA.winner ?? feederA.autoAdvance ?? null;
        }
        if (feederB) {
          match.away = feederB.winner ?? feederB.autoAdvance ?? null;
        }
      }

      const sc = scores[match.id];
      if (sc) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        if (sc.winner) {
          match.winner = sc.winner;
        } else if (
          sc.home !== null &&
          sc.away !== null &&
          !isNaN(Number(sc.home)) &&
          !isNaN(Number(sc.away))
        ) {
          if (Number(sc.home) > Number(sc.away)) {
            match.winner = match.home;
          } else if (Number(sc.away) > Number(sc.home)) {
            match.winner = match.away;
          } else {
            match.winner = null;
          }
        } else {
          match.winner = match.autoAdvance ?? null;
        }
      } else {
        match.winner = match.autoAdvance ?? null;
      }
    }
  }

  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const champion = finalMatch?.winner ?? null;

  return {
    knockout: {
      bracketSize: knockout.bracketSize,
      byes: knockout.byes,
      rounds,
    },
    champion,
  };
}

/**
 * Constructs a single-elimination bracket from an explicit list of slot teams
 * (length must be a power of 2 >= 2).
 */
export function buildKnockoutFromSlots(
  slotTeams: (string | null)[],
  byesCount?: number
): KnockoutResult {
  const bracketSize = slotTeams.length;
  if (bracketSize < 2 || (bracketSize & (bracketSize - 1)) !== 0) {
    throw new ScheduleValidationError("اندازه براکت باید توانی از ۲ باشد.");
  }
  const byes = byesCount ?? slotTeams.filter((t) => t === null).length;
  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketRound[] = [];

  // Round 1
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

  // Subsequent rounds
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
        sourceMatchHomeId: feederA.id,
        sourceMatchAwayId: feederB.id,
      });
    }
    rounds.push({ round: r, label: roundLabel(totalRounds - r), matches });
    previousMatches = matches;
  }

  return { bracketSize, byes, rounds };
}

export interface BuildKnockoutParams {
  teams: string[];
  seededTeams: string[];
}

/**
 * Builds a single-elimination bracket. Teams beyond the ordered
 * `seededTeams` list fill the remaining seed slots in their given order.
 * Byes are awarded to the top seeds.
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

  const rest = shuffle(teams.filter((t) => !seededTeams.includes(t)));
  const seedToTeam = new Map<number, string | null>();
  const orderedTeams = [...seededTeams, ...rest];
  for (let i = 0; i < bracketSize; i++) {
    seedToTeam.set(i + 1, orderedTeams[i] ?? null);
  }

  const order = seedOrder(bracketSize);
  const slotTeams: (string | typeof BYE)[] = order.map((seed) => seedToTeam.get(seed) ?? BYE);

  return buildKnockoutFromSlots(slotTeams, byes);
}

/**
 * Builds a crossover knockout bracket from group stage qualifiers.
 * For 2 qualifiers per group:
 * Guarantees that the 1st and 2nd place from the SAME group are placed
 * in opposite halves of the bracket (they cannot meet before the Final),
 * and round 1 pairs 1st of one group against 2nd of another group.
 */
export function buildGroupsKnockout({
  groupNames,
  qualifiersPerGroup,
}: {
  groupNames: string[];
  qualifiersPerGroup: number;
}): KnockoutResult {
  const totalQualifiers = groupNames.length * qualifiersPerGroup;
  if (totalQualifiers < 2) {
    throw new ScheduleValidationError("برای مرحله حذفی حداقل به ۲ تیم صعودکننده نیاز است.");
  }

  const bracketSize = nextPowerOfTwo(totalQualifiers);
  const byes = bracketSize - totalQualifiers;
  const numMatches = bracketSize / 2;

  const matches: { home: string | null; away: string | null }[] = Array.from(
    { length: numMatches },
    () => ({ home: null, away: null })
  );

  if (qualifiersPerGroup === 2) {
    const halfMatches = Math.max(1, Math.floor(numMatches / 2));
    const numPairs = Math.floor(groupNames.length / 2);

    for (let k = 0; k < numPairs; k++) {
      const g1 = groupNames[2 * k];
      const g2 = groupNames[2 * k + 1];
      const upperIdx = k % halfMatches;
      const lowerIdx = halfMatches + (k % halfMatches);

      matches[upperIdx].home = `قهرمان ${g1}`;
      matches[upperIdx].away = `نایب‌قهرمان ${g2}`;

      matches[lowerIdx].home = `قهرمان ${g2}`;
      matches[lowerIdx].away = `نایب‌قهرمان ${g1}`;
    }

    if (groupNames.length % 2 !== 0) {
      const lastGroup = groupNames[groupNames.length - 1];
      const upperIdx = numPairs % halfMatches;
      const lowerIdx = halfMatches + (numPairs % halfMatches);

      matches[upperIdx].home = `قهرمان ${lastGroup}`;
      matches[lowerIdx].away = `نایب‌قهرمان ${lastGroup}`;
    }
  } else if (qualifiersPerGroup === 1) {
    for (let i = 0; i < groupNames.length; i++) {
      const matchIdx = Math.floor(i / 2);
      if (matchIdx < numMatches) {
        if (i % 2 === 0) {
          matches[matchIdx].home = `قهرمان ${groupNames[i]}`;
        } else {
          matches[matchIdx].away = `قهرمان ${groupNames[i]}`;
        }
      }
    }
  } else {
    // 3 or more qualifiers per group
    const teamList: string[] = [];
    for (let pos = 1; pos <= qualifiersPerGroup; pos++) {
      const posLabel = pos === 1 ? "قهرمان" : pos === 2 ? "نایب‌قهرمان" : `تیم ${pos}`;
      for (const g of groupNames) {
        teamList.push(`${posLabel} ${g}`);
      }
    }
    for (let i = 0; i < teamList.length; i++) {
      const matchIdx = Math.floor(i / 2) % numMatches;
      if (!matches[matchIdx].home) {
        matches[matchIdx].home = teamList[i];
      } else if (!matches[matchIdx].away) {
        matches[matchIdx].away = teamList[i];
      }
    }
  }

  const slotTeams: (string | null)[] = [];
  for (let i = 0; i < numMatches; i++) {
    slotTeams.push(matches[i].home);
    slotTeams.push(matches[i].away);
  }

  return buildKnockoutFromSlots(slotTeams, byes);
}
