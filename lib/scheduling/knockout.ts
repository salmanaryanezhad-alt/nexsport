import {
  BracketMatch,
  BracketRound,
  KnockoutResult,
  ScheduleValidationError,
  GroupResult,
  PointsRule,
} from "./types";
import { shuffle } from "./shuffle";
import { calculateStandings, getLockedRanksForGroup, getBestThirdsRanking } from "./standings";
import { toEnglishDigits } from "../auth/utils";

const BYE = null;

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

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
  homePenalty?: number | null;
  awayPenalty?: number | null;
  winner?: string | null;
}

export function isPlaceholderTeam(name: string | null | undefined): boolean {
  if (!name) return true;
  const t = name.trim();
  const eng = toEnglishDigits(t);
  if (t === "" || t === "BYE" || t === "استراحت") return true;
  if (
    t.startsWith("قهرمان ") ||
    t.startsWith("نایب‌قهرمان ") ||
    t.startsWith("تیم اول ") ||
    t.startsWith("تیم دوم ") ||
    t.startsWith("تیم سوم ") ||
    t.startsWith("تیم ۴ ") ||
    t.startsWith("تیم 4 ") ||
    t.startsWith("تیم سوم برتر") ||
    t.startsWith("تیم برتر سوم") ||
    t.startsWith("برنده ") ||
    t.startsWith("بازنده ") ||
    t.startsWith("در انتظار") ||
    t.startsWith("نامشخص") ||
    t.startsWith("سید ")
  ) {
    return true;
  }
  if (
    t.includes("گروه") &&
    (t.includes("تیم") ||
      t.includes("اول") ||
      t.includes("دوم") ||
      t.includes("سوم") ||
      t.includes("قهرمان") ||
      t.includes("نایب"))
  ) {
    return true;
  }
  if (/^سید\s*\d+/.test(eng) || /^تیم\s*\d+\s+گروه/.test(eng)) {
    return true;
  }
  return false;
}

function isBestThirdSlot(text: string | null | undefined): boolean {
  if (!text) return false;
  const eng = toEnglishDigits(text);
  return eng.includes("تیم سوم برتر") || eng.includes("تیم برتر سوم");
}

function getBestThirdSlotIndex(text: string | null | undefined): number {
  if (!text) return 0;
  const eng = toEnglishDigits(text);
  const match = eng.match(/\d+/);
  return match ? parseInt(match[0], 10) - 1 : 0;
}

/**
 * Efficiently matches K candidate 3rd-place teams to K match slots in polynomial time O(K^2).
 * Scales smoothly to ANY number of groups (e.g. World Cup 12 groups with 8 best thirds, Euro 6 groups, etc.),
 * guarantees every candidate is assigned to exactly one slot (no duplicates),
 * and eliminates same-group clashes whenever mathematically possible.
 */
function assignBestThirdsToSlots(
  slots: Array<{ opponentGroup: string | null }>,
  candidates: Array<{ team: string; groupName: string }>
): number[] {
  const K = slots.length;
  const assigned = new Array<number>(K).fill(-1);
  const usedCandidates = new Set<number>();

  // Pass 1: Try natural priority order (candidate i to slot i) if no group clash
  for (let i = 0; i < K; i++) {
    if (candidates[i] && candidates[i].groupName !== slots[i].opponentGroup) {
      assigned[i] = i;
      usedCandidates.add(i);
    }
  }

  // Pass 2: Greedy assignment for remaining slots without group clashes
  for (let i = 0; i < K; i++) {
    if (assigned[i] !== -1) continue;
    for (let j = 0; j < K; j++) {
      if (!usedCandidates.has(j) && candidates[j].groupName !== slots[i].opponentGroup) {
        assigned[i] = j;
        usedCandidates.add(j);
        break;
      }
    }
  }

  // Pass 3: Augmenting swap — if a slot is blocked by its own group, swap with an assigned slot
  for (let i = 0; i < K; i++) {
    if (assigned[i] !== -1) continue;
    let unusedJ = -1;
    for (let j = 0; j < K; j++) {
      if (!usedCandidates.has(j)) {
        unusedJ = j;
        break;
      }
    }
    if (unusedJ === -1) break;

    let swapped = false;
    for (let k = 0; k < K; k++) {
      const curJ = assigned[k];
      if (curJ !== -1) {
        if (
          candidates[curJ].groupName !== slots[i].opponentGroup &&
          candidates[unusedJ].groupName !== slots[k].opponentGroup
        ) {
          assigned[i] = curJ;
          assigned[k] = unusedJ;
          usedCandidates.add(unusedJ);
          swapped = true;
          break;
        }
      }
    }

    if (!swapped) {
      assigned[i] = unusedJ;
      usedCandidates.add(unusedJ);
    }
  }

  // Pass 4: Safety guarantee — ensure all slots have a unique candidate
  for (let i = 0; i < K; i++) {
    if (assigned[i] === -1) {
      for (let j = 0; j < K; j++) {
        if (!usedCandidates.has(j)) {
          assigned[i] = j;
          usedCandidates.add(j);
          break;
        }
      }
    }
  }

  return assigned;
}

export function resolveWinner(
  home: string | null,
  away: string | null,
  sc?: MatchScore,
  autoAdvance?: string | null
): string | null {
  if (autoAdvance) {
    if (isPlaceholderTeam(autoAdvance)) return null;
    return autoAdvance;
  }

  // STRICT REQUIREMENT: If both competitors are not yet real resolved teams, NO WINNER CAN BE RESOLVED!
  if (!home || !away || isPlaceholderTeam(home) || isPlaceholderTeam(away)) {
    return null;
  }

  if (sc) {
    // 1. STRICT REQUIREMENT: If real scores are entered, THE SCORE ALWAYS DETERMINES THE WINNER!
    // A team with fewer goals can NEVER be declared winner over a team with more goals.
    if (
      sc.home !== null &&
      sc.away !== null &&
      sc.home !== undefined &&
      sc.away !== undefined &&
      !isNaN(Number(sc.home)) &&
      !isNaN(Number(sc.away))
    ) {
      const h = Number(sc.home);
      const a = Number(sc.away);
      if (h > a) return home;
      if (a > h) return away;

      // Draw: check penalties first
      if (
        sc.homePenalty !== null &&
        sc.homePenalty !== undefined &&
        sc.awayPenalty !== null &&
        sc.awayPenalty !== undefined &&
        !isNaN(Number(sc.homePenalty)) &&
        !isNaN(Number(sc.awayPenalty))
      ) {
        const hp = Number(sc.homePenalty);
        const ap = Number(sc.awayPenalty);
        if (hp > ap) return home;
        if (ap > hp) return away;
      }

      // If draw and penalties are equal or not entered, allow manual winner selection (e.g. shootout or coin toss)
      if (sc.winner && (sc.winner === home || sc.winner === away)) {
        return sc.winner;
      }

      return null;
    }

    // 2. If scores are not entered, manual winner selection (e.g. direct click, walkover) applies
    if (sc.winner && (sc.winner === home || sc.winner === away)) {
      return sc.winner;
    }
  }
  return null;
}

export function findPlayedDownstreamMatch(
  matchId: string,
  allMatches: any[],
  scores: Record<string, MatchScore>,
  visited: Set<string> = new Set()
): any | null {
  if (visited.has(matchId)) return null;
  visited.add(matchId);

  const directDependents = allMatches.filter(
    (m) => m && (m.sourceMatchHomeId === matchId || m.sourceMatchAwayId === matchId)
  );

  for (const dep of directDependents) {
    const sc = scores[dep.id];
    const isUserPlayed =
      Boolean(sc?.winner) ||
      (sc?.home !== null &&
        sc?.home !== undefined &&
        !isNaN(Number(sc.home)) &&
        sc?.away !== null &&
        sc?.away !== undefined &&
        !isNaN(Number(sc.away)));

    if (isUserPlayed) {
      return dep;
    }

    if (dep.isBye || dep.autoAdvance) {
      const recursivePlayed = findPlayedDownstreamMatch(
        dep.id,
        allMatches,
        scores,
        visited
      );
      if (recursivePlayed) {
        return recursivePlayed;
      }
    }
  }

  return null;
}

export function resolveGroupsIntoKnockout(
  rounds: BracketRound[],
  groups: GroupResult[],
  scores: Record<string, MatchScore>,
  pointsRule?: PointsRule
): void {
  if (!rounds || rounds.length === 0 || !groups || groups.length === 0) return;

  const groupLockedMap = new Map<string, Map<number, string>>();
  const teamToGroupMap = new Map<string, string>();

  for (const g of groups) {
    for (const t of g.teams) {
      teamToGroupMap.set(t, g.name);
    }
    const gMatches = g.rounds.flatMap((r) => r.matches).filter((m) => !m.isBye && m.home && m.away);
    const lockedRanks = getLockedRanksForGroup(g.teams, gMatches, scores, pointsRule);
    groupLockedMap.set(g.name, lockedRanks);
  }

  const { allCompleted, rankedThirds } = getBestThirdsRanking(groups, scores, pointsRule);

  function resolveSlotString(slotText: string | null | undefined): { team: string | null; placeholder: string } {
    if (!slotText) return { team: null, placeholder: "در انتظار حریف" };
    const text = slotText.trim();
    const engText = toEnglishDigits(text);

    // Check Best 3rd pattern:
    if (isBestThirdSlot(engText)) {
      const idx = getBestThirdSlotIndex(engText);
      if (allCompleted && idx >= 0 && idx < rankedThirds.length) {
        return { team: rankedThirds[idx].team, placeholder: text };
      }
      return { team: null, placeholder: text };
    }

    // Check Group Winners / Runners-up / Specific Ranks:
    for (const g of groups) {
      if (text.includes(g.name)) {
        const locked = groupLockedMap.get(g.name);
        // Check 2nd place FIRST so "نایب‌قهرمان" is not mistakenly matched by "قهرمان"
        if (
          text.startsWith("نایب‌قهرمان") ||
          text.startsWith("تیم دوم") ||
          text.includes("نایب‌قهرمان") ||
          text.includes("تیم دوم") ||
          text.startsWith("دوم ")
        ) {
          const team = locked?.get(2) ?? null;
          return { team, placeholder: `تیم دوم ${g.name}` };
        }
        if (
          text.startsWith("قهرمان") ||
          text.startsWith("تیم اول") ||
          text.includes("قهرمان") ||
          text.includes("تیم اول") ||
          text.startsWith("اول ")
        ) {
          const team = locked?.get(1) ?? null;
          return { team, placeholder: `تیم اول ${g.name}` };
        }
        const numMatch = engText.match(/تیم\s*(\d+)/);
        if (numMatch) {
          const rank = parseInt(numMatch[1], 10);
          const team = locked?.get(rank) ?? null;
          return { team, placeholder: `تیم ${rank} ${g.name}` };
        }
      }
    }

    // If already a real team name
    if (!isPlaceholderTeam(text)) {
      return { team: text, placeholder: text };
    }

    return { team: null, placeholder: text };
  }

  // Resolve Round 1 matches
  const round1 = rounds[0];
  if (round1) {
    for (const m of round1.matches) {
      if (m.isBye || m.autoAdvance) continue;

      const rawHome = m.homePlaceholder || m.home;
      const rawAway = m.awayPlaceholder || m.away;

      const resHome = resolveSlotString(rawHome);
      const resAway = resolveSlotString(rawAway);

      m.home = resHome.team;
      m.homePlaceholder = resHome.placeholder;

      m.away = resAway.team;
      m.awayPlaceholder = resAway.placeholder;
    }

    // Euro-style smart assignment for best 3rd-place slots to guarantee distinct teams and avoid same-group rematches
    const thirdTargets: Array<{
      match: BracketMatch;
      side: "home" | "away";
      opponentGroup: string | null;
      rawSlot: string;
      slotIndex: number;
    }> = [];

    function findOpponentGroup(team: string | null, placeholder: string | null | undefined): string | null {
      if (team && teamToGroupMap.has(team)) {
        return teamToGroupMap.get(team)!;
      }
      if (placeholder) {
        for (const g of groups) {
          if (placeholder.includes(g.name)) return g.name;
        }
      }
      return null;
    }

    for (const m of round1.matches) {
      if (m.isBye || m.autoAdvance) continue;
      const rawHome = m.homePlaceholder || m.home || "";
      const rawAway = m.awayPlaceholder || m.away || "";

      if (isBestThirdSlot(rawHome)) {
        thirdTargets.push({
          match: m,
          side: "home",
          opponentGroup: findOpponentGroup(m.away, rawAway),
          rawSlot: rawHome,
          slotIndex: getBestThirdSlotIndex(rawHome),
        });
      }
      if (isBestThirdSlot(rawAway)) {
        thirdTargets.push({
          match: m,
          side: "away",
          opponentGroup: findOpponentGroup(m.home, rawHome),
          rawSlot: rawAway,
          slotIndex: getBestThirdSlotIndex(rawAway),
        });
      }
    }

    if (thirdTargets.length > 0) {
      if (allCompleted && rankedThirds.length >= thirdTargets.length) {
        const K = thirdTargets.length;
        const candidates = rankedThirds.slice(0, K);
        const bestP = assignBestThirdsToSlots(thirdTargets, candidates);

        for (let i = 0; i < K; i++) {
          const target = thirdTargets[i];
          const assigned = candidates[bestP[i]];
          if (target.side === "home") {
            target.match.home = assigned.team;
            target.match.homePlaceholder = target.rawSlot;
          } else {
            target.match.away = assigned.team;
            target.match.awayPlaceholder = target.rawSlot;
          }
        }
      } else if (!allCompleted) {
        // If not all groups are completed, reset placeholder slots to null team
        for (const target of thirdTargets) {
          if (target.side === "home") {
            target.match.home = null;
            target.match.homePlaceholder = target.rawSlot;
          } else {
            target.match.away = null;
            target.match.awayPlaceholder = target.rawSlot;
          }
        }
      }
    }
  }
}

export function computeKnockoutWithScores(
  knockout: KnockoutResult,
  scores: Record<string, MatchScore>,
  groups?: GroupResult[],
  pointsRule?: PointsRule
): {
  knockout: KnockoutResult;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
} {
  const rounds: BracketRound[] = knockout.rounds.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  // If this is groups-knockout, resolve round 1 slots from group standings
  if (groups && groups.length > 0) {
    resolveGroupsIntoKnockout(rounds, groups, scores, pointsRule);
  } else {
    // If groups not supplied, ensure round 1 matches with placeholder strings don't act as real teams
    const round1 = rounds[0];
    if (round1) {
      for (const m of round1.matches) {
        if (m.isBye || m.autoAdvance) continue;
        if (m.home && isPlaceholderTeam(m.home)) {
          m.homePlaceholder = m.home;
          m.home = null;
        }
        if (m.away && isPlaceholderTeam(m.away)) {
          m.awayPlaceholder = m.away;
          m.away = null;
        }
      }
    }
  }

  for (let r = 0; r < rounds.length; r++) {
    const currentRound = rounds[r];
    const prevRound = r > 0 ? rounds[r - 1] : null;

    for (let i = 0; i < currentRound.matches.length; i++) {
      const match = currentRound.matches[i];

      if (prevRound) {
        const feederA = prevRound.matches[i * 2];
        const feederB = prevRound.matches[i * 2 + 1];
        if (feederA) {
          const advA = feederA.winner ?? (feederA.autoAdvance && !isPlaceholderTeam(feederA.autoAdvance) ? feederA.autoAdvance : null);
          match.home = advA;
          if (advA) {
            match.homePlaceholder = advA;
          }
        }
        if (feederB) {
          const advB = feederB.winner ?? (feederB.autoAdvance && !isPlaceholderTeam(feederB.autoAdvance) ? feederB.autoAdvance : null);
          match.away = advB;
          if (advB) {
            match.awayPlaceholder = advB;
          }
        }
      }

      const isAutoAdvance = Boolean(
        match.autoAdvance && !isPlaceholderTeam(match.autoAdvance)
      );
      const isReadyToPlay =
        Boolean(match.home && match.away) &&
        !isPlaceholderTeam(match.home) &&
        !isPlaceholderTeam(match.away);

      const sc = scores[match.id];
      if (sc && isReadyToPlay) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        match.homePenalty = sc.homePenalty;
        match.awayPenalty = sc.awayPenalty;
      } else {
        match.homeScore = undefined;
        match.awayScore = undefined;
        match.homePenalty = undefined;
        match.awayPenalty = undefined;
      }
      match.winner = isAutoAdvance
        ? match.autoAdvance
        : isReadyToPlay
        ? (resolveWinner(match.home, match.away, sc, match.autoAdvance) ?? null)
        : null;
    }
  }

  // Champion and Runner Up from final
  const finalRound = rounds[rounds.length - 1];
  const finalMatch = finalRound?.matches[0];
  const champion = finalMatch?.winner ?? null;
  const runnerUp =
    champion && finalMatch?.home && finalMatch?.away
      ? champion === finalMatch.home
        ? finalMatch.away
        : finalMatch.home
      : null;

  // Third Place Match
  let thirdPlaceMatch: BracketMatch | null = null;
  let thirdPlace: string | null = null;

  if (knockout.thirdPlaceMatch && rounds.length >= 2) {
    const semiRound = rounds[rounds.length - 2];
    const sf1 = semiRound.matches[0];
    const sf2 = semiRound.matches[1];

    const loser1 =
      sf1?.winner && sf1.home && sf1.away
        ? sf1.winner === sf1.home
          ? sf1.away
          : sf1.home
        : null;

    const loser2 =
      sf2?.winner && sf2.home && sf2.away
        ? sf2.winner === sf2.home
          ? sf2.away
          : sf2.home
        : null;

    const sc = scores[knockout.thirdPlaceMatch.id];
    const isTpReady = Boolean(
      loser1 && loser2 && !isPlaceholderTeam(loser1) && !isPlaceholderTeam(loser2)
    );

    thirdPlaceMatch = {
      ...knockout.thirdPlaceMatch,
      matchCode: "رده‌بندی",
      home: loser1,
      away: loser2,
      homePlaceholder: loser1 ?? "بازنده نیمه‌نهایی ۱",
      awayPlaceholder: loser2 ?? "بازنده نیمه‌نهایی ۲",
      homeScore: isTpReady ? sc?.home ?? null : null,
      awayScore: isTpReady ? sc?.away ?? null : null,
      homePenalty: isTpReady ? sc?.homePenalty ?? null : null,
      awayPenalty: isTpReady ? sc?.awayPenalty ?? null : null,
      winner: isTpReady ? (resolveWinner(loser1, loser2, sc, null) ?? null) : null,
      sourceMatchHomeId: sf1?.id,
      sourceMatchAwayId: sf2?.id,
    };

    thirdPlace = thirdPlaceMatch.winner ?? null;
  }

  return {
    knockout: {
      bracketSize: knockout.bracketSize,
      byes: knockout.byes,
      rounds,
      thirdPlaceMatch,
    },
    champion,
    runnerUp,
    thirdPlace,
  };
}

export interface BuildKnockoutParams {
  teams: string[];
  seededTeams: string[];
  hasThirdPlace?: boolean;
}

export function buildKnockoutFromSlots(
  slotTeams: (string | null)[],
  byesCount?: number,
  hasThirdPlace = false
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
    const isBye = Boolean(autoAdvance);
    const matchCode = `بازی ${i + 1}`;
    round1Matches.push({
      id: `r1-m${i + 1}`,
      round: 1,
      slot: i,
      matchCode,
      home: home ?? (autoAdvance ? "BYE" : null),
      away: away ?? (autoAdvance ? "BYE" : null),
      homePlaceholder: home ?? (isBye ? "قرعه استراحت (Bye)" : `تیم ${i * 2 + 1}`),
      awayPlaceholder: away ?? (isBye ? "قرعه استراحت (Bye)" : `تیم ${i * 2 + 2}`),
      isBye,
      autoAdvance,
    });
  }
  rounds.push({ round: 1, label: roundLabel(totalRounds - 1), matches: round1Matches });

  // Subsequent rounds
  let previousMatches = round1Matches;
  let matchCounter = bracketSize / 2 + 1;
  for (let r = 2; r <= totalRounds; r++) {
    const matches: BracketMatch[] = [];
    const isFinalRound = r === totalRounds;
    const isSemiRound = r === totalRounds - 1;

    for (let i = 0; i < previousMatches.length / 2; i++) {
      const feederA = previousMatches[i * 2];
      const feederB = previousMatches[i * 2 + 1];
      const home = feederA.autoAdvance ?? null;
      const away = feederB.autoAdvance ?? null;

      const matchCode = isFinalRound
        ? "فینال"
        : isSemiRound
        ? `نیمه‌نهایی ${i + 1}`
        : `بازی ${matchCounter++}`;

      const feederACode = feederA.matchCode || `بازی ${feederA.slot + 1}`;
      const feederBCode = feederB.matchCode || `بازی ${feederB.slot + 1}`;

      matches.push({
        id: `r${r}-m${i + 1}`,
        round: r,
        slot: i,
        matchCode,
        home,
        away,
        homePlaceholder: feederA.autoAdvance ? feederA.autoAdvance : `برنده ${feederACode}`,
        awayPlaceholder: feederB.autoAdvance ? feederB.autoAdvance : `برنده ${feederBCode}`,
        autoAdvance: null,
        sourceMatchHomeId: feederA.id,
        sourceMatchAwayId: feederB.id,
      });
    }
    rounds.push({ round: r, label: roundLabel(totalRounds - r), matches });
    previousMatches = matches;
  }

  let thirdPlaceMatch: BracketMatch | null = null;
  if (hasThirdPlace && bracketSize >= 4) {
    const semiRound = rounds[rounds.length - 2];
    thirdPlaceMatch = {
      id: "m-third-place",
      round: totalRounds,
      slot: 1,
      matchCode: "رده‌بندی",
      home: null,
      away: null,
      homePlaceholder: "بازنده نیمه‌نهایی ۱",
      awayPlaceholder: "بازنده نیمه‌نهایی ۲",
      autoAdvance: null,
      sourceMatchHomeId: semiRound?.matches[0]?.id,
      sourceMatchAwayId: semiRound?.matches[1]?.id,
    };
  }

  return { bracketSize, byes, rounds, thirdPlaceMatch };
}

export function buildKnockout({
  teams,
  seededTeams,
  hasThirdPlace = false,
}: BuildKnockoutParams): KnockoutResult {
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

  return buildKnockoutFromSlots(slotTeams, byes, hasThirdPlace);
}

/**
 * Builds standard UEFA Euro / World Cup style knockout matchups where
 * extra best 3rd-placed teams advance to complete a full power-of-2 bracket
 * without BYEs.
 */
function buildEuroStyleMatches(
  groupNames: string[],
  bracketSize: number,
  extraThirds: number
): { home: string | null; away: string | null }[] {
  const numMatches = bracketSize / 2;
  const matches: { home: string | null; away: string | null }[] = Array.from(
    { length: numMatches },
    () => ({ home: null, away: null })
  );

  const G = groupNames.length;
  const E = extraThirds;

  if (G === 6 && E === 4) {
    // Standard UEFA Euro 24-team bracket mapping (Matches 0..3 Upper Half, 4..7 Lower Half)
    matches[0] = { home: `قهرمان ${groupNames[0]}`, away: `نایب‌قهرمان ${groupNames[1]}` };
    matches[1] = { home: `قهرمان ${groupNames[2]}`, away: `تیم سوم برتر ۱` };
    matches[2] = { home: `نایب‌قهرمان ${groupNames[3]}`, away: `نایب‌قهرمان ${groupNames[4]}` };
    matches[3] = { home: `قهرمان ${groupNames[1]}`, away: `تیم سوم برتر ۲` };

    matches[4] = { home: `قهرمان ${groupNames[3]}`, away: `نایب‌قهرمان ${groupNames[2]}` };
    matches[5] = { home: `قهرمان ${groupNames[4]}`, away: `تیم سوم برتر ۳` };
    matches[6] = { home: `نایب‌قهرمان ${groupNames[0]}`, away: `نایب‌قهرمان ${groupNames[5]}` };
    matches[7] = { home: `قهرمان ${groupNames[5]}`, away: `تیم سوم برتر ۴` };
    return matches;
  }

  if (G === 3 && E === 2) {
    // 12 teams, 3 groups of 4 (Quarter-finals 8 teams)
    matches[0] = { home: `قهرمان ${groupNames[0]}`, away: `تیم سوم برتر ۱` };
    matches[1] = { home: `نایب‌قهرمان ${groupNames[1]}`, away: `نایب‌قهرمان ${groupNames[2]}` };
    matches[2] = { home: `قهرمان ${groupNames[1]}`, away: `نایب‌قهرمان ${groupNames[0]}` };
    matches[3] = { home: `قهرمان ${groupNames[2]}`, away: `تیم سوم برتر ۲` };
    return matches;
  }

  // General algorithm for G groups with E extra best-thirds:
  // 1. Assign E group winners to face the E best 3rd-placed teams
  const bestThirdMatches: { home: string; away: string }[] = [];
  for (let i = 0; i < E; i++) {
    bestThirdMatches.push({
      home: `قهرمان ${groupNames[i]}`,
      away: `تیم سوم برتر ${i + 1}`,
    });
  }

  // 2. Assign remaining G - E group winners to face runners-up from other groups
  const winnerVsRuMatches: { home: string; away: string }[] = [];
  for (let i = E; i < G; i++) {
    const ruGroup = groupNames[(i - 1 + G) % G];
    winnerVsRuMatches.push({
      home: `قهرمان ${groupNames[i]}`,
      away: `نایب‌قهرمان ${ruGroup}`,
    });
  }

  // 3. The remaining runners-up play each other in runner-up vs runner-up matches
  const usedRuGroups = new Set(winnerVsRuMatches.map((m) => m.away.replace("نایب‌قهرمان ", "")));
  const remainingRuGroups = groupNames.filter((g) => !usedRuGroups.has(g));
  const ruVsRuMatches: { home: string; away: string }[] = [];
  for (let i = 0; i < remainingRuGroups.length; i += 2) {
    const gA = remainingRuGroups[i];
    const gB = remainingRuGroups[i + 1] ?? remainingRuGroups[0];
    ruVsRuMatches.push({
      home: `نایب‌قهرمان ${gA}`,
      away: `نایب‌قهرمان ${gB}`,
    });
  }

  // Distribute matches symmetrically across upper and lower halves of bracket
  const upperHalf: { home: string | null; away: string | null }[] = [];
  const lowerHalf: { home: string | null; away: string | null }[] = [];

  const addPair = (m: { home: string | null; away: string | null }, idx: number) => {
    if (idx % 2 === 0) {
      upperHalf.push(m);
    } else {
      lowerHalf.push(m);
    }
  };

  winnerVsRuMatches.forEach(addPair);
  bestThirdMatches.forEach(addPair);
  ruVsRuMatches.forEach(addPair);

  const allPairs = [...upperHalf, ...lowerHalf];
  for (let i = 0; i < numMatches; i++) {
    if (i < allPairs.length) {
      matches[i] = allPairs[i];
    }
  }

  return matches;
}

export function buildGroupsKnockout({
  groupNames,
  qualifiersPerGroup,
  advanceBestThirds = true,
  hasThirdPlace = false,
}: {
  groupNames: string[];
  qualifiersPerGroup: number;
  advanceBestThirds?: boolean;
  hasThirdPlace?: boolean;
}): KnockoutResult {
  const baseQualifiers = groupNames.length * qualifiersPerGroup;
  if (baseQualifiers < 2) {
    throw new ScheduleValidationError("برای مرحله حذفی حداقل به ۲ تیم صعودکننده نیاز است.");
  }

  const bracketSize = nextPowerOfTwo(baseQualifiers);
  const G = groupNames.length;
  const extraNeeded = bracketSize - baseQualifiers;

  // Euro / World Cup style: If 2 teams qualify per group and bracket size is not a power of 2,
  // advance the missing teams from the best 3rd-placed teams to form a full power-of-2 bracket!
  const useBestThirds =
    qualifiersPerGroup === 2 &&
    advanceBestThirds &&
    extraNeeded > 0 &&
    extraNeeded <= G;

  const totalQualifiers = useBestThirds ? baseQualifiers + extraNeeded : baseQualifiers;
  const finalBracketSize = nextPowerOfTwo(totalQualifiers);
  const byes = finalBracketSize - totalQualifiers;
  const numMatches = finalBracketSize / 2;

  let matches: { home: string | null; away: string | null }[] = Array.from(
    { length: numMatches },
    () => ({ home: null, away: null })
  );

  if (useBestThirds) {
    matches = buildEuroStyleMatches(groupNames, finalBracketSize, extraNeeded);
  } else if (qualifiersPerGroup === 2) {
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

  return buildKnockoutFromSlots(slotTeams, byes, hasThirdPlace);
}
