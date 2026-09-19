import {
  BracketMatch,
  BracketRound,
  DoubleKnockoutResult,
  ScheduleValidationError,
} from "./types";
import { shuffle } from "./shuffle";
import { nextPowerOfTwo, seedOrder, MatchScore } from "./knockout";

const BYE = null;

function resolveWinner(
  home: string | null,
  away: string | null,
  sc?: MatchScore,
  autoAdvance?: string | null
): string | null {
  if (sc) {
    if (sc.winner) return sc.winner;
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

      // Draw: check penalties
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
    }
  }
  return autoAdvance ?? null;
}

export interface BuildDoubleKnockoutParams {
  teams: string[];
  seededTeams?: string[];
  hasResetFinal?: boolean;
}

export function buildDoubleKnockout({
  teams,
  seededTeams = [],
  hasResetFinal = false,
}: BuildDoubleKnockoutParams): DoubleKnockoutResult {
  if (teams.length < 3) {
    throw new ScheduleValidationError("برای تورنمنت دو حذفی حداقل به ۳ تیم نیاز است.");
  }

  const trimmed = teams.map((t) => t.trim());
  if (trimmed.some((t) => t.length === 0)) {
    throw new ScheduleValidationError("نام همه تیم‌ها باید پر شده باشد.");
  }
  const unique = new Set(trimmed.map((t) => t.toLowerCase()));
  if (unique.size !== trimmed.length) {
    throw new ScheduleValidationError("نام تیم‌ها باید یکتا باشد؛ دو تیم هم‌نام وجود دارد.");
  }

  const unknownSeed = seededTeams.find((t) => !teams.includes(t));
  if (unknownSeed) {
    throw new ScheduleValidationError(`تیم شاخص «${unknownSeed}» در لیست تیم‌ها یافت نشد.`);
  }

  const bracketSize = nextPowerOfTwo(teams.length);
  const byes = bracketSize - teams.length;
  const k = Math.round(Math.log2(bracketSize));

  // Seed allocation
  const rest = shuffle(teams.filter((t) => !seededTeams.includes(t)));
  const seedToTeam = new Map<number, string | null>();
  const orderedTeams = [...seededTeams, ...rest];
  for (let i = 0; i < bracketSize; i++) {
    seedToTeam.set(i + 1, orderedTeams[i] ?? null);
  }

  const order = seedOrder(bracketSize);
  const slotTeams: (string | null)[] = order.map((seed) => seedToTeam.get(seed) ?? BYE);

  // 1. Build Winners Bracket (WB)
  const winnersRounds: BracketRound[] = [];
  let currentMatchCount = bracketSize / 2;

  for (let r = 0; r < k; r++) {
    const roundsFromWbFinal = k - 1 - r;
    let label = `دور ${r + 1} جدول برندگان`;
    if (roundsFromWbFinal === 0) label = "فینال جدول برندگان";
    else if (roundsFromWbFinal === 1) label = "نیمه‌نهایی جدول برندگان";
    else if (roundsFromWbFinal === 2) label = "یک‌چهارم نهایی جدول برندگان";
    else if (roundsFromWbFinal === 3) label = "یک‌هشتم نهایی جدول برندگان";

    const matches: BracketMatch[] = [];

    for (let m = 0; m < currentMatchCount; m++) {
      const matchId = `wb-r${r + 1}-m${m + 1}`;

      if (r === 0) {
        const home = slotTeams[m * 2] ?? null;
        const away = slotTeams[m * 2 + 1] ?? null;
        const autoAdvance =
          home === BYE && away !== BYE
            ? away
            : away === BYE && home !== BYE
            ? home
            : null;

        const isBye =
          (home === BYE && away !== BYE) || (away === BYE && home !== BYE);

        matches.push({
          id: matchId,
          round: r + 1,
          slot: m + 1,
          home,
          away,
          isBye,
          autoAdvance,
        });
      } else {
        const feederHomeId = `wb-r${r}-m${m * 2 + 1}`;
        const feederAwayId = `wb-r${r}-m${m * 2 + 2}`;

        matches.push({
          id: matchId,
          round: r + 1,
          slot: m + 1,
          home: `برنده ${feederHomeId.toUpperCase()}`,
          away: `برنده ${feederAwayId.toUpperCase()}`,
          sourceMatchHomeId: feederHomeId,
          sourceMatchAwayId: feederAwayId,
        });
      }
    }

    winnersRounds.push({
      round: r + 1,
      label,
      matches,
    });

    currentMatchCount = Math.max(1, Math.floor(currentMatchCount / 2));
  }

  // 2. Build Losers Bracket (LB)
  const losersRounds: BracketRound[] = [];
  const totalLbRounds = Math.max(1, 2 * (k - 1));

  if (k === 1) {
    // 2 teams: WB has 1 match, simple 1 round
  } else {
    let lbMatchCount = bracketSize / 4;

    for (let r = 0; r < totalLbRounds; r++) {
      const roundNum = r + 1;
      const isFinal = roundNum === totalLbRounds;
      const isSemi = roundNum === totalLbRounds - 1;

      let label = `دور ${roundNum} شانس مجدد (بازندگان)`;
      if (isFinal) label = "فینال جدول بازندگان (تعیین فینالیست دوم)";
      else if (isSemi && totalLbRounds > 2) label = "نیمه‌نهایی جدول بازندگان";

      const matches: BracketMatch[] = [];

      if (roundNum === 1) {
        // Round 1: takes losers of WB Round 1
        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `wb-r1-m${m * 2 + 1}`;
          const feederAwayId = `wb-r1-m${m * 2 + 2}`;

          matches.push({
            id: `lb-r1-m${m + 1}`,
            round: 1,
            slot: m + 1,
            home: `بازنده ${feederHomeId.toUpperCase()}`,
            away: `بازنده ${feederAwayId.toUpperCase()}`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
          });
        }
      } else if (roundNum % 2 === 0) {
        // Even round: winners of previous LB round meet drop-down losers from corresponding WB round
        // wbRound = roundNum / 2 + 1
        const wbRound = Math.floor(roundNum / 2) + 1;
        const wbMatchesCount = winnersRounds[wbRound - 1]?.matches.length ?? lbMatchCount;

        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `lb-r${roundNum - 1}-m${m + 1}`;
          // Cross-pair WB losers to avoid early rematches
          const wbMatchSlot = wbMatchesCount - m;
          const feederAwayId = `wb-r${wbRound}-m${wbMatchSlot}`;

          matches.push({
            id: `lb-r${roundNum}-m${m + 1}`,
            round: roundNum,
            slot: m + 1,
            home: `برنده ${feederHomeId.toUpperCase()}`,
            away: `بازنده ${feederAwayId.toUpperCase()}`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
          });
        }
      } else {
        // Odd round (> 1): winners of previous LB round play each other
        for (let m = 0; m < lbMatchCount; m++) {
          const feederHomeId = `lb-r${roundNum - 1}-m${m * 2 + 1}`;
          const feederAwayId = `lb-r${roundNum - 1}-m${m * 2 + 2}`;

          matches.push({
            id: `lb-r${roundNum}-m${m + 1}`,
            round: roundNum,
            slot: m + 1,
            home: `برنده ${feederHomeId.toUpperCase()}`,
            away: `برنده ${feederAwayId.toUpperCase()}`,
            sourceMatchHomeId: feederHomeId,
            sourceMatchAwayId: feederAwayId,
          });
        }
      }

      losersRounds.push({
        round: roundNum,
        label,
        matches,
      });

      // Update match count for next LB round
      if (roundNum % 2 === 0) {
        lbMatchCount = Math.max(1, Math.floor(lbMatchCount / 2));
      }
    }
  }

  // 3. Build Grand Final
  const wbFinalId = winnersRounds[winnersRounds.length - 1]?.matches[0]?.id ?? "wb-r1-m1";
  const lbFinalId = losersRounds[losersRounds.length - 1]?.matches[0]?.id ?? wbFinalId;

  const grandFinal: BracketMatch = {
    id: "gf-m1",
    round: 1,
    slot: 1,
    home: "قهرمان جدول برندگان",
    away: "قهرمان جدول بازندگان",
    sourceMatchHomeId: wbFinalId,
    sourceMatchAwayId: lbFinalId,
  };

  const bracketResetMatch: BracketMatch | null = hasResetFinal
    ? {
        id: "gf-reset",
        round: 2,
        slot: 1,
        home: "قهرمان جدول برندگان",
        away: "قهرمان جدول بازندگان",
        sourceMatchHomeId: "gf-m1",
        sourceMatchAwayId: "gf-m1",
      }
    : null;

  return {
    bracketSize,
    byes,
    winnersBracket: winnersRounds,
    losersBracket: losersRounds,
    grandFinal,
    bracketResetMatch,
  };
}

export function computeDoubleKnockoutWithScores(
  doubleKnockout: DoubleKnockoutResult,
  scores: Record<string, MatchScore>
): {
  doubleKnockout: DoubleKnockoutResult;
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
} {
  const matchWinners = new Map<string, string | null>();
  const matchLosers = new Map<string, string | null>();

  // 1. Process Winners Bracket
  const winnersBracket: BracketRound[] = doubleKnockout.winnersBracket.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < winnersBracket.length; r++) {
    const round = winnersBracket[r];

    for (const match of round.matches) {
      if (r > 0 && match.sourceMatchHomeId && match.sourceMatchAwayId) {
        match.home = matchWinners.get(match.sourceMatchHomeId) ?? null;
        match.away = matchWinners.get(match.sourceMatchAwayId) ?? null;
      }

      const sc = scores[match.id];
      if (sc) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        match.homePenalty = sc.homePenalty;
        match.awayPenalty = sc.awayPenalty;
      }

      match.winner = resolveWinner(match.home, match.away, sc, match.autoAdvance);

      if (match.winner) {
        matchWinners.set(match.id, match.winner);
        if (match.home && match.away) {
          const loser = match.winner === match.home ? match.away : match.home;
          matchLosers.set(match.id, loser);
        } else {
          // If match had a BYE, no actual loser dropped
          matchLosers.set(match.id, null);
        }
      }
    }
  }

  // 2. Process Losers Bracket
  const losersBracket: BracketRound[] = doubleKnockout.losersBracket.map((round) => ({
    round: round.round,
    label: round.label,
    matches: round.matches.map((m) => ({ ...m })),
  }));

  for (let r = 0; r < losersBracket.length; r++) {
    const round = losersBracket[r];

    for (const match of round.matches) {
      // Resolve home participant
      if (match.sourceMatchHomeId) {
        if (match.sourceMatchHomeId.startsWith("wb-")) {
          match.home = matchLosers.get(match.sourceMatchHomeId) ?? null;
        } else {
          match.home = matchWinners.get(match.sourceMatchHomeId) ?? null;
        }
      }

      // Resolve away participant
      if (match.sourceMatchAwayId) {
        if (match.sourceMatchAwayId.startsWith("wb-")) {
          match.away = matchLosers.get(match.sourceMatchAwayId) ?? null;
        } else {
          match.away = matchWinners.get(match.sourceMatchAwayId) ?? null;
        }
      }

      // Handle automatic advance in Losers Bracket if one side was empty due to WB Bye
      let autoAdvance: string | null = null;
      if (match.home && !match.away && match.sourceMatchAwayId?.startsWith("wb-")) {
        const wbAwayLoser = matchLosers.get(match.sourceMatchAwayId);
        if (wbAwayLoser === null && matchWinners.has(match.sourceMatchAwayId)) {
          // The WB match was a Bye, so home team advances automatically in LB!
          autoAdvance = match.home;
        }
      } else if (!match.home && match.away && match.sourceMatchHomeId?.startsWith("wb-")) {
        const wbHomeLoser = matchLosers.get(match.sourceMatchHomeId);
        if (wbHomeLoser === null && matchWinners.has(match.sourceMatchHomeId)) {
          autoAdvance = match.away;
        }
      }

      const sc = scores[match.id];
      if (sc) {
        match.homeScore = sc.home;
        match.awayScore = sc.away;
        match.homePenalty = sc.homePenalty;
        match.awayPenalty = sc.awayPenalty;
      }

      match.winner = resolveWinner(match.home, match.away, sc, autoAdvance);

      if (match.winner) {
        matchWinners.set(match.id, match.winner);
        if (match.home && match.away) {
          const loser = match.winner === match.home ? match.away : match.home;
          matchLosers.set(match.id, loser);
        }
      }
    }
  }

  // 3. Process Grand Final
  const wbFinalId = winnersBracket[winnersBracket.length - 1]?.matches[0]?.id;
  const lbFinalId = losersBracket[losersBracket.length - 1]?.matches[0]?.id;

  const grandFinal: BracketMatch = { ...doubleKnockout.grandFinal };
  if (wbFinalId) {
    grandFinal.home = matchWinners.get(wbFinalId) ?? null;
  }
  if (lbFinalId) {
    grandFinal.away = matchWinners.get(lbFinalId) ?? null;
  }

  const gfSc = scores[grandFinal.id];
  if (gfSc) {
    grandFinal.homeScore = gfSc.home;
    grandFinal.awayScore = gfSc.away;
    grandFinal.homePenalty = gfSc.homePenalty;
    grandFinal.awayPenalty = gfSc.awayPenalty;
  }
  grandFinal.winner = resolveWinner(grandFinal.home, grandFinal.away, gfSc);

  // 4. Process Bracket Reset Match (if applicable)
  let bracketResetMatch: BracketMatch | null = null;
  let champion: string | null = null;
  let runnerUp: string | null = null;

  if (doubleKnockout.bracketResetMatch) {
    bracketResetMatch = { ...doubleKnockout.bracketResetMatch };
    const lbChampion = grandFinal.away;
    const wbChampion = grandFinal.home;

    // Reset match is only required if the Losers Bracket winner won the Grand Final match
    if (grandFinal.winner && lbChampion && grandFinal.winner === lbChampion) {
      bracketResetMatch.home = wbChampion;
      bracketResetMatch.away = lbChampion;

      const resetSc = scores[bracketResetMatch.id];
      if (resetSc) {
        bracketResetMatch.homeScore = resetSc.home;
        bracketResetMatch.awayScore = resetSc.away;
        bracketResetMatch.homePenalty = resetSc.homePenalty;
        bracketResetMatch.awayPenalty = resetSc.awayPenalty;
      }
      bracketResetMatch.winner = resolveWinner(
        bracketResetMatch.home,
        bracketResetMatch.away,
        resetSc
      );

      if (bracketResetMatch.winner) {
        champion = bracketResetMatch.winner;
        runnerUp =
          champion === bracketResetMatch.home
            ? bracketResetMatch.away
            : bracketResetMatch.home;
      }
    } else if (grandFinal.winner && wbChampion && grandFinal.winner === wbChampion) {
      // Winners bracket champion won Grand Final! Tournament over, no reset needed.
      champion = wbChampion;
      runnerUp = lbChampion;
    }
  } else {
    // Single Grand Final mode
    if (grandFinal.winner) {
      champion = grandFinal.winner;
      runnerUp =
        champion === grandFinal.home ? grandFinal.away : grandFinal.home;
    }
  }

  // Third place is the team that lost the Losers Bracket Final
  const thirdPlace = lbFinalId ? matchLosers.get(lbFinalId) ?? null : null;

  return {
    doubleKnockout: {
      bracketSize: doubleKnockout.bracketSize,
      byes: doubleKnockout.byes,
      winnersBracket,
      losersBracket,
      grandFinal,
      bracketResetMatch,
    },
    champion,
    runnerUp,
    thirdPlace,
  };
}
