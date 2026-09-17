export type CompetitionFormat =
  | "league"
  | "double-league"
  | "groups"
  | "groups-knockout"
  | "knockout";

export interface Match {
  home: string;
  away: string;
  /** BYE matches are generated internally for odd team counts and filtered before display */
  isBye?: boolean;
}

export interface RoundRobinRound {
  round: number;
  matches: Match[];
}

export interface GroupResult {
  name: string;
  teams: string[];
  rounds: RoundRobinRound[];
}

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  home: string | null;
  away: string | null;
  /** true when one side is a BYE and the other auto-advances */
  autoAdvance?: string | null;
}

export interface BracketRound {
  round: number;
  label: string;
  matches: BracketMatch[];
}

export interface KnockoutResult {
  bracketSize: number;
  byes: number;
  rounds: BracketRound[];
}

export interface LeagueScheduleInput {
  format: "league" | "double-league";
  teams: string[];
}

export interface GroupsScheduleInput {
  format: "groups" | "groups-knockout";
  teams: string[];
  numGroups: number;
  seededTeams: string[];
  qualifiersPerGroup: number;
}

export interface KnockoutScheduleInput {
  format: "knockout";
  teams: string[];
  seededTeams: string[];
}

export type ScheduleInput =
  | LeagueScheduleInput
  | GroupsScheduleInput
  | KnockoutScheduleInput;

export type ScheduleResult =
  | {
      format: "league";
      rounds: RoundRobinRound[];
    }
  | {
      format: "double-league";
      rounds: RoundRobinRound[];
    }
  | {
      format: "groups";
      groups: GroupResult[];
    }
  | {
      format: "groups-knockout";
      groups: GroupResult[];
      knockout: KnockoutResult;
    }
  | {
      format: "knockout";
      knockout: KnockoutResult;
    };

export class ScheduleValidationError extends Error {}
