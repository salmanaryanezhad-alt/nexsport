import { generateSingleRoundRobin, generateDoubleRoundRobin } from "./roundRobin";
import { buildGroups } from "./groups";
import { buildKnockout, buildGroupsKnockout } from "./knockout";
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
  type MatchScore,
} from "./knockout";
export { buildGroups } from "./groups";
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
      return { format: "league", rounds: generateSingleRoundRobin(input.teams) };

    case "double-league":
      return { format: "double-league", rounds: generateDoubleRoundRobin(input.teams) };

    case "groups": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
      });
      return { format: "groups", groups };
    }

    case "groups-knockout": {
      const groups = buildGroups({
        teams: input.teams,
        numGroups: input.numGroups,
        seededTeams: input.seededTeams,
      });

      const knockout = buildGroupsKnockout({
        groupNames: groups.map((g) => g.name),
        qualifiersPerGroup: input.qualifiersPerGroup,
      });

      return { format: "groups-knockout", groups, knockout };
    }

    case "knockout": {
      const knockout = buildKnockout({ teams: input.teams, seededTeams: input.seededTeams });
      return { format: "knockout", knockout };
    }

    default: {
      const _exhaustive: never = input;
      throw new ScheduleValidationError("فرمت مسابقه ناشناخته است.");
    }
  }
}
