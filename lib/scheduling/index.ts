import { generateSingleRoundRobin, generateDoubleRoundRobin } from "./roundRobin";
import { buildGroups } from "./groups";
import { buildKnockout, buildGroupsKnockout } from "./knockout";
import { buildDoubleKnockout } from "./doubleKnockout";
import {
  ScheduleInput,
  ScheduleResult,
  ScheduleValidationError,
} from "./types";

export * from "./types";
export {
  buildKnockout,
  buildGroupsKnockout,
  computeKnockoutWithScores,
  findPlayedDownstreamMatch,
  nextPowerOfTwo,
  type MatchScore,
} from "./knockout";
export {
  buildDoubleKnockout,
  computeDoubleKnockoutWithScores,
} from "./doubleKnockout";
export { buildGroups, calculateDefaultNumGroups } from "./groups";
export { generateSingleRoundRobin, generateDoubleRoundRobin } from "./roundRobin";
export { calculateStandings, type TeamStanding } from "./standings";
export { formatScheduleAsText, exportScheduleToCsv, downloadCsvFile } from "./export";

function assertUniqueNonEmptyTeams(teams: string[]) {
  const trimmed = teams.map((t) => t.trim());
  if (trimmed.some((t) => t.length === 0)) {
    throw new ScheduleValidationError("نام همه تیم‌ها باید پر شده باشد.");
  }
  const unique = new Set(trimmed.map((t) => t.toLowerCase()));
  if (unique.size !== trimmed.length) {
    throw new ScheduleValidationError("نام تیم‌ها باید یکتا باشد؛ دو تیم هم‌نام وجود دارد.");
  }
}

export function generateSchedule(input: ScheduleInput): ScheduleResult {
  assertUniqueNonEmptyTeams(input.teams);

  switch (input.format) {
    case "league":
      return {
        format: "league",
        rounds: generateSingleRoundRobin(input.teams),
        metadata: input.metadata,
      };

    case "double-league":
      return {
        format: "double-league",
        rounds: generateDoubleRoundRobin(input.teams, {
          independentSecondLeg: input.independentSecondLeg,
        }),
        metadata: input.metadata,
      };

    case "groups": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
        pot2Teams: input.pot2Teams,
        pot3Teams: input.pot3Teams,
        pot4Teams: input.pot4Teams,
        pots: input.pots,
        avoidPairs: input.avoidPairs,
      });
      return { format: "groups", groups, metadata: input.metadata };
    }

    case "groups-knockout": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
        pot2Teams: input.pot2Teams,
        pot3Teams: input.pot3Teams,
        pot4Teams: input.pot4Teams,
        pots: input.pots,
        avoidPairs: input.avoidPairs,
      });

      const knockout = buildGroupsKnockout({
        groupNames: groups.map((g) => g.name),
        qualifiersPerGroup: input.qualifiersPerGroup,
        advanceBestThirds: input.advanceBestThirds,
        hasThirdPlace: input.hasThirdPlace,
      });

      return {
        format: "groups-knockout",
        groups,
        knockout,
        metadata: input.metadata,
      };
    }

    case "knockout": {
      const knockout = buildKnockout({
        teams: input.teams,
        seededTeams: input.seededTeams,
        hasThirdPlace: input.hasThirdPlace,
      });
      return { format: "knockout", knockout, metadata: input.metadata };
    }

    case "double-knockout": {
      const doubleKnockout = buildDoubleKnockout({
        teams: input.teams,
        seededTeams: input.seededTeams,
        hasResetFinal: input.hasResetFinal,
      });
      return {
        format: "double-knockout",
        doubleKnockout,
        metadata: input.metadata,
      };
    }

    default: {
      const _exhaustive: never = input;
      throw new ScheduleValidationError("فرمت مسابقه ناشناخته است.");
    }
  }
}
