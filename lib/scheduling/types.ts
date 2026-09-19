export type CompetitionFormat =
  | "league"
  | "double-league"
  | "groups"
  | "groups-knockout"
  | "knockout"
  | "double-knockout";

export interface Match {
  id?: string;
  home: string;
  away: string;
  isBye?: boolean;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string;
  time?: string;
  venue?: string;
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
  isBye?: boolean;
  autoAdvance?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  homePenalty?: number | null;
  awayPenalty?: number | null;
  winner?: string | null;
  sourceMatchHomeId?: string;
  sourceMatchAwayId?: string;
  date?: string;
  time?: string;
  venue?: string;
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
  thirdPlaceMatch?: BracketMatch | null;
}

export interface DoubleKnockoutResult {
  bracketSize: number;
  byes: number;
  winnersBracket: BracketRound[];
  losersBracket: BracketRound[];
  grandFinal: BracketMatch;
  bracketResetMatch?: BracketMatch | null;
}

export interface LeagueScheduleInput {
  format: "league" | "double-league";
  teams: string[];
  independentSecondLeg?: boolean;
  metadata?: TournamentMetadata;
}

export interface GroupsScheduleInput {
  format: "groups" | "groups-knockout";
  teams: string[];
  numGroups: number;
  seededTeams: string[];
  pot2Teams?: string[];
  pot3Teams?: string[];
  pot4Teams?: string[];
  pots?: string[][];
  qualifiersPerGroup: number;
  advanceBestThirds?: boolean;
  avoidPairs?: [string, string][];
  hasThirdPlace?: boolean;
  metadata?: TournamentMetadata;
}

export interface KnockoutScheduleInput {
  format: "knockout";
  teams: string[];
  seededTeams: string[];
  hasThirdPlace?: boolean;
  metadata?: TournamentMetadata;
}

export interface DoubleKnockoutScheduleInput {
  format: "double-knockout";
  teams: string[];
  seededTeams?: string[];
  hasResetFinal?: boolean;
  metadata?: TournamentMetadata;
}

export interface TournamentMetadata {
  title?: string;
  venue?: string;
  startDate?: string;
  matchIntervalDays?: number;
}

export type ScheduleInput =
  | LeagueScheduleInput
  | GroupsScheduleInput
  | KnockoutScheduleInput
  | DoubleKnockoutScheduleInput;

export type ScheduleResult =
  | {
      format: "league";
      rounds: RoundRobinRound[];
      metadata?: TournamentMetadata;
    }
  | {
      format: "double-league";
      rounds: RoundRobinRound[];
      metadata?: TournamentMetadata;
    }
  | {
      format: "groups";
      groups: GroupResult[];
      metadata?: TournamentMetadata;
    }
  | {
      format: "groups-knockout";
      groups: GroupResult[];
      knockout: KnockoutResult;
      metadata?: TournamentMetadata;
    }
  | {
      format: "knockout";
      knockout: KnockoutResult;
      metadata?: TournamentMetadata;
    }
  | {
      format: "double-knockout";
      doubleKnockout: DoubleKnockoutResult;
      metadata?: TournamentMetadata;
    };

export class ScheduleValidationError extends Error {}
