import { Pool as PgPool } from "pg";
import mysql, { Pool as MySqlPool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import crypto from "crypto";
import { generateShortId } from "../shortId";
import { hasUnlimitedPlanning, isSuperAdminEmail, toEnglishDigits } from "../auth/utils";
import { hashPassword } from "../auth/password";
import {
  createSignedSessionToken,
  parseSessionToken,
  snapshotFromPayload,
  SessionUserSnapshot,
} from "../auth/sessionToken";
import {
  DEFAULT_PRICING_SETTINGS,
  DiscountAppliesTo,
  DiscountItemType,
  PricingSettings,
  discountAppliesToItem,
  mismatchDiscountMessage,
  sanitizePricingSettings,
  serializeAppliesTo,
} from "../payment/pricing";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password_hash: string;
  is_verified: boolean;
  role: string;
  planning_credits?: number;
  free_link_used?: boolean;
  vip_expires_at?: Date | null;
  club_pro_expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GuestUsageRecord {
  ip: string;
  count: number;
  last_used_at: Date;
  created_at: Date;
}

export interface DiscountCodeRecord {
  id: string;
  code: string;
  discount_percent: number;
  applies_to: DiscountAppliesTo;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by?: string | null;
}

export interface EmailVerificationRecord {
  id: string;
  user_id: string;
  email: string;
  code: string;
  expires_at: Date;
  created_at: Date;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  device_type?: "desktop" | "mobile";
  expires_at: Date;
  last_active_at?: Date;
  created_at: Date;
  user_snapshot?: SessionUserSnapshot;
}

export interface PasswordResetRecord {
  id: string;
  user_id: string;
  email: string;
  code: string;
  expires_at: Date;
  created_at: Date;
}

export type TicketStatus = "unanswered" | "answered";
export type TicketSender = "user" | "admin";

export interface TicketRecord {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  user_has_unread: boolean;
  last_preview: string;
  last_message_at: Date;
  created_at: Date;
  updated_at: Date;
  user_name?: string;
  user_email?: string;
  user_mobile?: string;
}

export interface TicketMessageRecord {
  id: string;
  ticket_id: string;
  sender: TicketSender;
  body: string;
  created_at: Date;
}

export interface TournamentRecord {
  id: string;
  user_id: string;
  title: string;
  format: string;
  sport: string | null;
  team_count: number;
  state: any;
  created_at: Date;
  updated_at: Date;
}

export interface TeamRecord {
  id: string;
  user_id: string;
  name: string;
  short_name: string;
  sport: string;
  city: string;
  founded_year: string;
  kit_home: string;
  kit_away: string;
  coach: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  player_count?: number;
  owner_name?: string;
  owner_email?: string;
  is_public?: boolean;
}

export interface PlayerRecord {
  id: string;
  team_id: string;
  name: string;
  jersey_number: string;
  position: string;
  birth_date: string;
  mobile: string;
  national_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface RegistrationPlayerSnapshot {
  name: string;
  jersey_number: string;
  position: string;
  birth_date: string;
  mobile: string;
  national_id: string;
}

export interface RegistrationRecord {
  id: string;
  tournament_id: string;
  team_name: string;
  short_name: string;
  city: string;
  coach: string;
  contact_name: string;
  mobile: string;
  notes: string;
  status: RegistrationStatus;
  library_team_id: string;
  reject_reason: string;
  roster: RegistrationPlayerSnapshot[];
  created_at: Date;
  updated_at: Date;
}

export type ClubMemberRole = "owner" | "manager" | "coach" | "member";
export type ClubMemberStatus = "pending" | "active";

export interface ClubRecord {
  id: string;
  owner_id: string;
  name: string;
  short_name: string;
  sport: string;
  city: string;
  founded_year: string;
  venue: string;
  description: string;
  contact_name: string;
  mobile: string;
  page_paid?: boolean;
  page_paid_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  member_count?: number;
  team_count?: number;
  my_role?: ClubMemberRole;
  my_status?: ClubMemberStatus;
}

export interface ClubMemberRecord {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubMemberRole;
  status: ClubMemberStatus;
  created_at: Date;
  name?: string;
  email?: string;
  mobile?: string;
}

export interface ClubCoachRecord {
  id: string;
  club_id: string;
  name: string;
  title: string;
  mobile: string;
  notes: string;
  created_at: Date;
}

export interface AdminTournamentListItem {
  id: string;
  user_id: string;
  title: string;
  format: string;
  sport: string | null;
  team_count: number;
  created_at: Date;
  updated_at: Date;
  linkActive: boolean;
  owner: {
    id: string;
    name: string;
    email: string;
    mobile: string;
  };
}

function tournamentLinkActive(state: unknown): boolean {
  try {
    const parsed = typeof state === "string" ? JSON.parse(state) : state;
    return Boolean((parsed as { payment?: { isPaid?: boolean } } | null)?.payment?.isPaid);
  } catch {
    return false;
  }
}

const rawConnectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.MYSQL_URL;

const connectionString = rawConnectionString?.trim();

// Detect MySQL Configuration
const mysqlHost = process.env.MYSQL_HOST || process.env.DB_HOST || "localhost";
const mysqlPort = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || "3306", 10);
const mysqlUser = process.env.MYSQL_USER || process.env.DB_USER;
const mysqlPassword = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD;
const mysqlDatabase = process.env.MYSQL_DATABASE || process.env.DB_NAME;

const isMySql =
  process.env.DB_TYPE === "mysql" ||
  Boolean(mysqlDatabase) ||
  (connectionString && (connectionString.startsWith("mysql://") || connectionString.startsWith("mysql2://")));

let mysqlPool: MySqlPool | null = null;
let pgPool: PgPool | null = null;
let tablesInitialized = false;

const runningOnVercel = Boolean(process.env.VERCEL);
const mysqlHostIsLoopback =
  mysqlHost === "localhost" || mysqlHost === "127.0.0.1" || mysqlHost === "::1";

if (isMySql) {
  try {
    const mysqlUrl =
      connectionString &&
      (connectionString.startsWith("mysql://") || connectionString.startsWith("mysql2://"));
    if (mysqlUrl) {
      mysqlPool = mysql.createPool(connectionString);
    } else if (mysqlDatabase && mysqlUser && !(runningOnVercel && mysqlHostIsLoopback)) {
      mysqlPool = mysql.createPool({
        host: mysqlHost,
        port: mysqlPort,
        user: mysqlUser,
        password: mysqlPassword || "",
        database: mysqlDatabase,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        charset: "utf8mb4",
      });
    } else if (runningOnVercel && mysqlHostIsLoopback) {
      console.warn("[NexSport DB] Skipping localhost MySQL on Vercel; sessions use signed cookies.");
    }
  } catch (err) {
    console.warn("[NexSport DB] MySQL pool creation warning:", err);
  }
} else if (connectionString && (connectionString.startsWith("postgres://") || connectionString.startsWith("postgresql://"))) {
  try {
    const isLocalhost =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1");
    pgPool = new PgPool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  } catch (err) {
    console.warn("[NexSport DB] Postgres pool creation warning:", err);
  }
}

// In-memory fallback store when no database connection is configured
const memoryStore = {
  users: new Map<string, UserRecord>(),
  verifications: new Map<string, EmailVerificationRecord>(),
  sessions: new Map<string, SessionRecord>(),
  passwordResets: new Map<string, PasswordResetRecord>(),
  tournaments: new Map<string, TournamentRecord>(),
  guestUsage: new Map<string, GuestUsageRecord>(),
  discountCodes: new Map<string, DiscountCodeRecord>(),
  orders: new Map<string, any>(),
  settings: new Map<string, string>(),
  tickets: new Map<string, TicketRecord>(),
  ticketMessages: new Map<string, TicketMessageRecord>(),
  teams: new Map<string, TeamRecord>(),
  players: new Map<string, PlayerRecord>(),
  registrations: new Map<string, RegistrationRecord>(),
  clubs: new Map<string, ClubRecord>(),
  clubMembers: new Map<string, ClubMemberRecord>(),
  clubCoaches: new Map<string, ClubCoachRecord>(),
  clubTeams: new Map<string, { club_id: string; team_id: string }>(),
  clubTournaments: new Map<string, { club_id: string; tournament_id: string }>(),
  follows: new Map<string, { user_id: string; tournament_id: string; created_at: Date }>(),
  notifications: new Map<string, {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    is_read: boolean;
    created_at: Date;
  }>(),
  serviceListings: new Map<string, {
    id: string;
    user_id: string;
    category: string;
    title: string;
    body: string;
    city: string;
    sport: string;
    contact_name: string;
    mobile: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  }>(),
  communityPromos: new Map<string, {
    id: string;
    kind: string;
    target_id: string;
    user_id: string;
    expires_at: Date;
    created_at: Date;
  }>(),
};

function normalizeDiscountRow(row: any): DiscountCodeRecord {
  return {
    id: row.id,
    code: String(row.code || "").trim().toUpperCase(),
    discount_percent: Number(row.discount_percent),
    applies_to: (row.applies_to || "all") as DiscountAppliesTo,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    is_active: Boolean(row.is_active),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function normalizeUserRow(row: any): UserRecord {
  const isSuperAdmin = isSuperAdminEmail(row.email);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    password_hash: row.password_hash,
    is_verified: Boolean(row.is_verified),
    role: isSuperAdmin ? "admin" : (row.role || "user"),
    planning_credits:
      row.planning_credits !== undefined && row.planning_credits !== null
        ? Number(row.planning_credits)
        : 5,
    free_link_used: Boolean(row.free_link_used),
    vip_expires_at: row.vip_expires_at ? new Date(row.vip_expires_at) : null,
    club_pro_expires_at: row.club_pro_expires_at ? new Date(row.club_pro_expires_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function normalizeTicketRow(row: any): TicketRecord {
  const status: TicketStatus = row.status === "answered" ? "answered" : "unanswered";
  return {
    id: row.id,
    user_id: row.user_id,
    subject: String(row.subject || "").trim(),
    status,
    user_has_unread: Boolean(row.user_has_unread),
    last_preview: String(row.last_preview || "").trim(),
    last_message_at: new Date(row.last_message_at || row.created_at),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at || row.created_at),
    user_name: row.user_name || undefined,
    user_email: row.user_email || undefined,
    user_mobile: row.user_mobile || undefined,
  };
}

function normalizeTicketMessageRow(row: any): TicketMessageRecord {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    sender: row.sender === "admin" ? "admin" : "user",
    body: String(row.body || ""),
    created_at: new Date(row.created_at),
  };
}

function previewTicketBody(body: string): string {
  const clean = String(body || "").replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
}

async function initTablesIfRealDb() {
  if (tablesInitialized) return;

  if (mysqlPool) {
    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`users\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`email\` VARCHAR(150) NOT NULL,
          \`mobile\` VARCHAR(20) NOT NULL,
          \`password_hash\` TEXT NOT NULL,
          \`is_verified\` TINYINT(1) DEFAULT 0,
          \`role\` VARCHAR(20) DEFAULT 'user',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_users_email\` (\`email\`),
          UNIQUE KEY \`uniq_users_mobile\` (\`mobile\`),
          KEY \`idx_users_email\` (\`email\`),
          KEY \`idx_users_mobile\` (\`mobile\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`email_verifications\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`email\` VARCHAR(150) NOT NULL,
          \`code\` VARCHAR(6) NOT NULL,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_verifications_user_id\` (\`user_id\`),
          KEY \`idx_verifications_lookup\` (\`email\`, \`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`sessions\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`device_type\` VARCHAR(20) DEFAULT 'desktop',
          \`expires_at\` TIMESTAMP NOT NULL,
          \`last_active_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_sessions_user_id\` (\`user_id\`),
          KEY \`idx_sessions_device\` (\`user_id\`, \`device_type\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      try {
        await mysqlPool.query("SELECT `device_type` FROM `sessions` LIMIT 1");
      } catch {
        await mysqlPool.query("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
      }

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`password_resets\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`email\` VARCHAR(150) NOT NULL,
          \`code\` VARCHAR(6) NOT NULL,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_resets_user_id\` (\`user_id\`),
          KEY \`idx_resets_lookup\` (\`email\`, \`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`tournaments\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`title\` VARCHAR(200) NOT NULL,
          \`format\` VARCHAR(50) NOT NULL,
          \`sport\` VARCHAR(50) DEFAULT NULL,
          \`team_count\` INT NOT NULL,
          \`state\` LONGTEXT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_tournaments_user_id\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      try {
        await mysqlPool.query("ALTER TABLE `users` ADD COLUMN `planning_credits` INT DEFAULT 5");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `users` ADD COLUMN `free_link_used` TINYINT(1) DEFAULT 0");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `users` ADD COLUMN `vip_expires_at` TIMESTAMP NULL DEFAULT NULL");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `users` ADD COLUMN `club_pro_expires_at` TIMESTAMP NULL DEFAULT NULL");
      } catch {}

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`guest_usage\` (
          \`ip\` VARCHAR(64) NOT NULL,
          \`count\` INT DEFAULT 0,
          \`last_used_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`ip\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`payment_orders\` (
          \`id\` VARCHAR(64) NOT NULL,
          \`item_type\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`tournament_id\` VARCHAR(36) DEFAULT NULL,
          \`item_quantity\` INT DEFAULT NULL,
          \`item_duration_months\` INT DEFAULT NULL,
          \`amount_tomans\` INT NOT NULL,
          \`gateway\` VARCHAR(30) NOT NULL,
          \`status\` VARCHAR(20) NOT NULL,
          \`authority\` VARCHAR(100) DEFAULT NULL,
          \`ref_id\` VARCHAR(100) DEFAULT NULL,
          \`description\` TEXT,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`paid_at\` TIMESTAMP NULL DEFAULT NULL,
          PRIMARY KEY (\`id\`),
          KEY \`idx_orders_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`discount_codes\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`code\` VARCHAR(50) NOT NULL,
          \`discount_percent\` INT NOT NULL,
          \`applies_to\` VARCHAR(200) DEFAULT 'all',
          \`expires_at\` TIMESTAMP NULL DEFAULT NULL,
          \`is_active\` TINYINT(1) DEFAULT 1,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_discount_code\` (\`code\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`site_settings\` (
          \`setting_key\` VARCHAR(50) NOT NULL,
          \`setting_value\` TEXT NOT NULL,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`setting_key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`tickets\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`subject\` VARCHAR(200) NOT NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'unanswered',
          \`user_has_unread\` TINYINT(1) DEFAULT 0,
          \`last_preview\` VARCHAR(180) DEFAULT '',
          \`last_message_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_tickets_user\` (\`user_id\`),
          KEY \`idx_tickets_status\` (\`status\`, \`last_message_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`ticket_messages\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`ticket_id\` VARCHAR(36) NOT NULL,
          \`sender\` VARCHAR(10) NOT NULL,
          \`body\` TEXT NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_ticket_messages_ticket\` (\`ticket_id\`, \`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`teams\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`name\` VARCHAR(80) NOT NULL,
          \`short_name\` VARCHAR(16) DEFAULT '',
          \`sport\` VARCHAR(40) DEFAULT 'فوتبال',
          \`city\` VARCHAR(60) DEFAULT '',
          \`founded_year\` VARCHAR(4) DEFAULT '',
          \`kit_home\` VARCHAR(40) DEFAULT '',
          \`kit_away\` VARCHAR(40) DEFAULT '',
          \`coach\` VARCHAR(80) DEFAULT '',
          \`description\` VARCHAR(500) DEFAULT '',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_teams_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`players\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`team_id\` VARCHAR(36) NOT NULL,
          \`name\` VARCHAR(80) NOT NULL,
          \`jersey_number\` VARCHAR(3) DEFAULT '',
          \`position\` VARCHAR(40) DEFAULT '',
          \`birth_date\` VARCHAR(10) DEFAULT '',
          \`mobile\` VARCHAR(20) DEFAULT '',
          \`national_id\` VARCHAR(10) DEFAULT '',
          \`status\` VARCHAR(20) DEFAULT 'active',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_players_team\` (\`team_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`registrations\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`tournament_id\` VARCHAR(36) NOT NULL,
          \`team_name\` VARCHAR(80) NOT NULL,
          \`short_name\` VARCHAR(16) DEFAULT '',
          \`city\` VARCHAR(60) DEFAULT '',
          \`coach\` VARCHAR(80) DEFAULT '',
          \`contact_name\` VARCHAR(80) DEFAULT '',
          \`mobile\` VARCHAR(20) DEFAULT '',
          \`notes\` VARCHAR(500) DEFAULT '',
          \`status\` VARCHAR(20) DEFAULT 'pending',
          \`library_team_id\` VARCHAR(36) DEFAULT '',
          \`reject_reason\` VARCHAR(300) DEFAULT '',
          \`roster\` LONGTEXT,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_registrations_tournament\` (\`tournament_id\`, \`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`clubs\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`owner_id\` VARCHAR(36) NOT NULL,
          \`name\` VARCHAR(80) NOT NULL,
          \`short_name\` VARCHAR(16) DEFAULT '',
          \`sport\` VARCHAR(40) DEFAULT 'فوتبال',
          \`city\` VARCHAR(60) DEFAULT '',
          \`founded_year\` VARCHAR(4) DEFAULT '',
          \`venue\` VARCHAR(80) DEFAULT '',
          \`description\` VARCHAR(500) DEFAULT '',
          \`contact_name\` VARCHAR(80) DEFAULT '',
          \`mobile\` VARCHAR(20) DEFAULT '',
          \`page_paid\` TINYINT(1) DEFAULT 0,
          \`page_paid_at\` TIMESTAMP NULL DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_clubs_owner\` (\`owner_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      try {
        await mysqlPool.query("ALTER TABLE `clubs` ADD COLUMN `page_paid` TINYINT(1) DEFAULT 0");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `clubs` ADD COLUMN `page_paid_at` TIMESTAMP NULL DEFAULT NULL");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `payment_orders` ADD COLUMN `club_id` VARCHAR(36) DEFAULT NULL");
      } catch {}
      try {
        await mysqlPool.query("ALTER TABLE `discount_codes` MODIFY `applies_to` VARCHAR(200) DEFAULT 'all'");
      } catch {}
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`club_members\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`club_id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`role\` VARCHAR(20) DEFAULT 'member',
          \`status\` VARCHAR(20) DEFAULT 'pending',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uniq_club_user\` (\`club_id\`, \`user_id\`),
          KEY \`idx_club_members_user\` (\`user_id\`, \`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`club_coaches\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`club_id\` VARCHAR(36) NOT NULL,
          \`name\` VARCHAR(80) NOT NULL,
          \`title\` VARCHAR(40) DEFAULT '',
          \`mobile\` VARCHAR(20) DEFAULT '',
          \`notes\` VARCHAR(300) DEFAULT '',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_club_coaches_club\` (\`club_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`club_teams\` (
          \`club_id\` VARCHAR(36) NOT NULL,
          \`team_id\` VARCHAR(36) NOT NULL,
          PRIMARY KEY (\`club_id\`, \`team_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`club_tournaments\` (
          \`club_id\` VARCHAR(36) NOT NULL,
          \`tournament_id\` VARCHAR(36) NOT NULL,
          PRIMARY KEY (\`club_id\`, \`tournament_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      try {
        await mysqlPool.query("ALTER TABLE `teams` ADD COLUMN `is_public` TINYINT(1) DEFAULT 0");
      } catch {}
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`tournament_follows\` (
          \`user_id\` VARCHAR(36) NOT NULL,
          \`tournament_id\` VARCHAR(36) NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`user_id\`, \`tournament_id\`),
          KEY \`idx_follows_tournament\` (\`tournament_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`notifications\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`type\` VARCHAR(40) DEFAULT 'info',
          \`title\` VARCHAR(200) NOT NULL,
          \`body\` VARCHAR(500) DEFAULT '',
          \`link\` VARCHAR(200) DEFAULT '',
          \`is_read\` TINYINT(1) DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_notifications_user\` (\`user_id\`, \`is_read\`, \`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`service_listings\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`category\` VARCHAR(40) NOT NULL,
          \`title\` VARCHAR(80) NOT NULL,
          \`body\` TEXT,
          \`city\` VARCHAR(60) DEFAULT '',
          \`sport\` VARCHAR(40) DEFAULT '',
          \`contact_name\` VARCHAR(80) DEFAULT '',
          \`mobile\` VARCHAR(20) DEFAULT '',
          \`is_active\` TINYINT(1) DEFAULT 1,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_services_cat\` (\`category\`, \`is_active\`),
          KEY \`idx_services_user\` (\`user_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS \`community_promos\` (
          \`id\` VARCHAR(36) NOT NULL,
          \`kind\` VARCHAR(40) NOT NULL,
          \`target_id\` VARCHAR(36) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`expires_at\` TIMESTAMP NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`idx_promos_kind\` (\`kind\`, \`expires_at\`),
          KEY \`idx_promos_target\` (\`kind\`, \`target_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      tablesInitialized = true;
    } catch (err) {
      console.warn("[NexSport DB] MySQL table auto-init warning:", err);
    }
    return;
  }

  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          mobile VARCHAR(20) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_verified BOOLEAN DEFAULT FALSE,
          role VARCHAR(20) DEFAULT 'user',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);

        CREATE TABLE IF NOT EXISTS email_verifications (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          email VARCHAR(150) NOT NULL,
          code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_email_verifications_lookup ON email_verifications(email, code);

        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

        CREATE TABLE IF NOT EXISTS password_resets (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          email VARCHAR(150) NOT NULL,
          code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_password_resets_lookup ON password_resets(email, code);

        CREATE TABLE IF NOT EXISTS tournaments (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(200) NOT NULL,
          format VARCHAR(50) NOT NULL,
          sport VARCHAR(50),
          team_count INT NOT NULL,
          state JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);

        ALTER TABLE users ADD COLUMN IF NOT EXISTS planning_credits INT DEFAULT 5;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS free_link_used BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS club_pro_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

        CREATE TABLE IF NOT EXISTS guest_usage (
          ip VARCHAR(64) PRIMARY KEY,
          count INT DEFAULT 0,
          last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS payment_orders (
          id VARCHAR(64) PRIMARY KEY,
          item_type VARCHAR(50) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          tournament_id VARCHAR(36),
          item_quantity INT,
          item_duration_months INT,
          amount_tomans INT NOT NULL,
          gateway VARCHAR(30) NOT NULL,
          status VARCHAR(20) NOT NULL,
          authority VARCHAR(100),
          ref_id VARCHAR(100),
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          paid_at TIMESTAMP WITH TIME ZONE
        );
        CREATE INDEX IF NOT EXISTS idx_orders_user ON payment_orders(user_id);

        CREATE TABLE IF NOT EXISTS discount_codes (
          id VARCHAR(36) PRIMARY KEY,
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_percent INT NOT NULL,
          applies_to VARCHAR(200) DEFAULT 'all',
          expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_discount_code ON discount_codes(code);

        CREATE TABLE IF NOT EXISTS site_settings (
          setting_key VARCHAR(50) PRIMARY KEY,
          setting_value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tickets (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          subject VARCHAR(200) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'unanswered',
          user_has_unread BOOLEAN DEFAULT FALSE,
          last_preview VARCHAR(180) DEFAULT '',
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, last_message_at);

        CREATE TABLE IF NOT EXISTS ticket_messages (
          id VARCHAR(36) PRIMARY KEY,
          ticket_id VARCHAR(36) NOT NULL,
          sender VARCHAR(10) NOT NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

        CREATE TABLE IF NOT EXISTS teams (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(80) NOT NULL,
          short_name VARCHAR(16) DEFAULT '',
          sport VARCHAR(40) DEFAULT 'فوتبال',
          city VARCHAR(60) DEFAULT '',
          founded_year VARCHAR(4) DEFAULT '',
          kit_home VARCHAR(40) DEFAULT '',
          kit_away VARCHAR(40) DEFAULT '',
          coach VARCHAR(80) DEFAULT '',
          description VARCHAR(500) DEFAULT '',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_teams_user ON teams(user_id);

        CREATE TABLE IF NOT EXISTS players (
          id VARCHAR(36) PRIMARY KEY,
          team_id VARCHAR(36) NOT NULL,
          name VARCHAR(80) NOT NULL,
          jersey_number VARCHAR(3) DEFAULT '',
          position VARCHAR(40) DEFAULT '',
          birth_date VARCHAR(10) DEFAULT '',
          mobile VARCHAR(20) DEFAULT '',
          national_id VARCHAR(10) DEFAULT '',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

        CREATE TABLE IF NOT EXISTS registrations (
          id VARCHAR(36) PRIMARY KEY,
          tournament_id VARCHAR(36) NOT NULL,
          team_name VARCHAR(80) NOT NULL,
          short_name VARCHAR(16) DEFAULT '',
          city VARCHAR(60) DEFAULT '',
          coach VARCHAR(80) DEFAULT '',
          contact_name VARCHAR(80) DEFAULT '',
          mobile VARCHAR(20) DEFAULT '',
          notes VARCHAR(500) DEFAULT '',
          status VARCHAR(20) DEFAULT 'pending',
          library_team_id VARCHAR(36) DEFAULT '',
          reject_reason VARCHAR(300) DEFAULT '',
          roster TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON registrations(tournament_id, status);

        CREATE TABLE IF NOT EXISTS clubs (
          id VARCHAR(36) PRIMARY KEY,
          owner_id VARCHAR(36) NOT NULL,
          name VARCHAR(80) NOT NULL,
          short_name VARCHAR(16) DEFAULT '',
          sport VARCHAR(40) DEFAULT 'فوتبال',
          city VARCHAR(60) DEFAULT '',
          founded_year VARCHAR(4) DEFAULT '',
          venue VARCHAR(80) DEFAULT '',
          description VARCHAR(500) DEFAULT '',
          contact_name VARCHAR(80) DEFAULT '',
          mobile VARCHAR(20) DEFAULT '',
          page_paid BOOLEAN DEFAULT FALSE,
          page_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_clubs_owner ON clubs(owner_id);
        ALTER TABLE clubs ADD COLUMN IF NOT EXISTS page_paid BOOLEAN DEFAULT FALSE;
        ALTER TABLE clubs ADD COLUMN IF NOT EXISTS page_paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS club_id VARCHAR(36) DEFAULT NULL;
        ALTER TABLE discount_codes ALTER COLUMN applies_to TYPE VARCHAR(200);

        CREATE TABLE IF NOT EXISTS club_members (
          id VARCHAR(36) PRIMARY KEY,
          club_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          role VARCHAR(20) DEFAULT 'member',
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (club_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id, status);

        CREATE TABLE IF NOT EXISTS club_coaches (
          id VARCHAR(36) PRIMARY KEY,
          club_id VARCHAR(36) NOT NULL,
          name VARCHAR(80) NOT NULL,
          title VARCHAR(40) DEFAULT '',
          mobile VARCHAR(20) DEFAULT '',
          notes VARCHAR(300) DEFAULT '',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_club_coaches_club ON club_coaches(club_id);

        CREATE TABLE IF NOT EXISTS club_teams (
          club_id VARCHAR(36) NOT NULL,
          team_id VARCHAR(36) NOT NULL,
          PRIMARY KEY (club_id, team_id)
        );
        CREATE TABLE IF NOT EXISTS club_tournaments (
          club_id VARCHAR(36) NOT NULL,
          tournament_id VARCHAR(36) NOT NULL,
          PRIMARY KEY (club_id, tournament_id)
        );
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

        CREATE TABLE IF NOT EXISTS tournament_follows (
          user_id VARCHAR(36) NOT NULL,
          tournament_id VARCHAR(36) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, tournament_id)
        );
        CREATE INDEX IF NOT EXISTS idx_follows_tournament ON tournament_follows(tournament_id);

        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(40) DEFAULT 'info',
          title VARCHAR(200) NOT NULL,
          body VARCHAR(500) DEFAULT '',
          link VARCHAR(200) DEFAULT '',
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);

        CREATE TABLE IF NOT EXISTS service_listings (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          category VARCHAR(40) NOT NULL,
          title VARCHAR(80) NOT NULL,
          body TEXT,
          city VARCHAR(60) DEFAULT '',
          sport VARCHAR(40) DEFAULT '',
          contact_name VARCHAR(80) DEFAULT '',
          mobile VARCHAR(20) DEFAULT '',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_services_cat ON service_listings(category, is_active);
        CREATE INDEX IF NOT EXISTS idx_services_user ON service_listings(user_id);

        CREATE TABLE IF NOT EXISTS community_promos (
          id VARCHAR(36) PRIMARY KEY,
          kind VARCHAR(40) NOT NULL,
          target_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_promos_kind ON community_promos(kind, expires_at);
        CREATE INDEX IF NOT EXISTS idx_promos_target ON community_promos(kind, target_id);
      `);
      tablesInitialized = true;
    } catch (err) {
      console.warn("[NexSport DB] Postgres table init warning:", err);
    }
  }
}

function requireStoredSessionLookup(): boolean {
  // Vercel instances (and any half-connected remote DB) cannot share RAM.
  // A valid HMAC cookie must keep the user signed in even if MySQL lookup misses.
  if (process.env.VERCEL) return false;
  return true;
}

let vercelTestAdminPromise: Promise<void> | null = null;

async function ensureVercelTestAdmin(): Promise<void> {
  if (!process.env.VERCEL || process.env.NEXT_EXPORT === "true") return;
  if (!vercelTestAdminPromise) {
    vercelTestAdminPromise = (async () => {
      const email = "test@gmail.com";
      const mobile = "09112223344";
      const name = "تست";
      const passwordHash = hashPassword("12341234");
      const now = new Date();
      try {
        if (mysqlPool) {
          await initTablesIfRealDb();
          const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            "SELECT id FROM `users` WHERE LOWER(email) = ? OR mobile = ? LIMIT 1",
            [email, mobile]
          );
          if (rows[0]) {
            await mysqlPool.execute(
              "UPDATE `users` SET name = ?, password_hash = ?, is_verified = 1, role = 'admin' WHERE id = ?",
              [name, passwordHash, rows[0].id]
            );
          } else {
            await mysqlPool.execute(
              `INSERT INTO \`users\` (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, 'admin', ?, ?)`,
              [crypto.randomUUID(), name, email, mobile, passwordHash, now, now]
            );
          }
          return;
        }
        if (pgPool) {
          await initTablesIfRealDb();
          const res = await pgPool.query(
            "SELECT id FROM users WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1",
            [email, mobile]
          );
          if (res.rows[0]) {
            await pgPool.query(
              "UPDATE users SET name = $1, password_hash = $2, is_verified = TRUE, role = 'admin' WHERE id = $3",
              [name, passwordHash, res.rows[0].id]
            );
          } else {
            await pgPool.query(
              `INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, TRUE, 'admin', $6, $7)`,
              [crypto.randomUUID(), name, email, mobile, passwordHash, now, now]
            );
          }
          return;
        }
        let found: UserRecord | undefined;
        for (const u of memoryStore.users.values()) {
          if (u.email === email || u.mobile === mobile) {
            found = u;
            break;
          }
        }
        if (found) {
          found.name = name;
          found.password_hash = passwordHash;
          found.is_verified = true;
          found.role = "admin";
          memoryStore.users.set(found.id, found);
        } else {
          const id = crypto.randomUUID();
          memoryStore.users.set(id, {
            id,
            name,
            email,
            mobile,
            password_hash: passwordHash,
            is_verified: true,
            role: "admin",
            planning_credits: 5,
            free_link_used: false,
            created_at: now,
            updated_at: now,
          });
        }
      } catch (err) {
        console.warn("[NexSport] Vercel preview admin seed skipped:", err);
        vercelTestAdminPromise = null;
      }
    })();
  }
  await vercelTestAdminPromise;
}

function sessionRecordFromPayload(
  parsed: NonNullable<ReturnType<typeof parseSessionToken>>,
  now: Date,
  rollingExpiresAt: Date
): SessionRecord {
  return {
    id: parsed.sid,
    user_id: parsed.u,
    device_type: parsed.d === "mobile" ? "mobile" : "desktop",
    expires_at: rollingExpiresAt,
    last_active_at: now,
    created_at: now,
    user_snapshot: snapshotFromPayload(parsed),
  };
}

export const db = {
  isConfigured: Boolean(mysqlPool || pgPool),
  driver: mysqlPool ? "mysql" : pgPool ? "postgres" : "memory",
  hasSharedSessionStore(): boolean {
    return Boolean(mysqlPool || pgPool);
  },

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    await ensureVercelTestAdmin();
    const cleanEmail = email.trim().toLowerCase();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `users` WHERE LOWER(email) = ? LIMIT 1",
        [cleanEmail]
      );
      return rows[0] ? normalizeUserRow(rows[0]) : null;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1", [cleanEmail]);
      return res.rows[0] ? normalizeUserRow(res.rows[0]) : null;
    }

    for (const u of memoryStore.users.values()) {
      if (u.email.toLowerCase() === cleanEmail) return normalizeUserRow(u);
    }
    return null;
  },

  async findUserByMobile(mobile: string): Promise<UserRecord | null> {
    await ensureVercelTestAdmin();
    const cleanMobile = mobile.trim();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `users` WHERE mobile = ? LIMIT 1",
        [cleanMobile]
      );
      return rows[0] ? normalizeUserRow(rows[0]) : null;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT * FROM users WHERE mobile = $1 LIMIT 1", [cleanMobile]);
      return res.rows[0] ? normalizeUserRow(res.rows[0]) : null;
    }

    for (const u of memoryStore.users.values()) {
      if (u.mobile === cleanMobile) return normalizeUserRow(u);
    }
    return null;
  },

  async findUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const clean = identifier.trim();
    if (clean.includes("@")) {
      return this.findUserByEmail(clean);
    }
    const byMobile = await this.findUserByMobile(clean);
    if (byMobile) return byMobile;
    return this.findUserByEmail(clean);
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT * FROM `users` WHERE id = ? LIMIT 1",
          [id]
        );
        return rows[0] ? normalizeUserRow(rows[0]) : null;
      }

      if (pgPool) {
        await initTablesIfRealDb();
        const res = await pgPool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
        return res.rows[0] ? normalizeUserRow(res.rows[0]) : null;
      }
    } catch (err) {
      console.warn("[NexSport DB] findUserById failed:", err);
    }
    const u = memoryStore.users.get(id);
    return u ? normalizeUserRow(u) : null;
  },

  async listAllUsers(): Promise<Omit<UserRecord, "password_hash">[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT id, name, email, mobile, is_verified, role, planning_credits, free_link_used, vip_expires_at, club_pro_expires_at, created_at, updated_at FROM `users` ORDER BY created_at DESC"
      );
      return rows.map((r) => {
        const u = normalizeUserRow(r);
        const { password_hash, ...safeUser } = u;
        return safeUser;
      });
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT id, name, email, mobile, is_verified, role, planning_credits, free_link_used, vip_expires_at, club_pro_expires_at, created_at, updated_at FROM users ORDER BY created_at DESC"
      );
      return res.rows.map((r) => {
        const u = normalizeUserRow(r);
        const { password_hash, ...safeUser } = u;
        return safeUser;
      });
    }

    return Array.from(memoryStore.users.values())
      .map((u) => {
        const normalized = normalizeUserRow(u);
        const { password_hash, ...safeUser } = normalized;
        return safeUser;
      })
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  },

  async listLastActiveByUser(): Promise<Record<string, Date>> {
    const map: Record<string, Date> = {};
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT user_id, MAX(last_active_at) AS last_active_at FROM `sessions` GROUP BY user_id"
      );
      for (const r of rows) {
        if (r.user_id && r.last_active_at) map[String(r.user_id)] = new Date(r.last_active_at);
      }
      return map;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT user_id, MAX(last_active_at) AS last_active_at FROM sessions GROUP BY user_id"
      );
      for (const r of res.rows) {
        if (r.user_id && r.last_active_at) map[String(r.user_id)] = new Date(r.last_active_at);
      }
      return map;
    }
    for (const s of memoryStore.sessions.values()) {
      const at = s.last_active_at || s.created_at;
      if (!at) continue;
      const prev = map[s.user_id];
      if (!prev || at.getTime() > prev.getTime()) map[s.user_id] = at;
    }
    return map;
  },

  async createUser(data: {
    name: string;
    email: string;
    mobile: string;
    password_hash?: string;
    passwordHash?: string;
    is_verified?: boolean;
    isVerified?: boolean;
    role?: string;
  }): Promise<UserRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.trim();
    const isSuperAdmin = isSuperAdminEmail(cleanEmail);
    const role = isSuperAdmin ? "admin" : (data.role ?? "user");
    const isVerified = Boolean(data.is_verified ?? data.isVerified);
    const passwordHash = data.password_hash || data.passwordHash || "";
    const initialCredits = (await this.getPricingSettings()).userFreePlannings;

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`users\` (id, name, email, mobile, password_hash, is_verified, role, planning_credits, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name.trim(), cleanEmail, cleanMobile, passwordHash, isVerified ? 1 : 0, role, initialCredits, now, now]
      );
      return {
        id,
        name: data.name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password_hash: passwordHash,
        is_verified: isVerified,
        role,
        planning_credits: initialCredits,
        created_at: now,
        updated_at: now,
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, planning_credits, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id,
          data.name.trim(),
          cleanEmail,
          cleanMobile,
          passwordHash,
          isVerified,
          role,
          initialCredits,
          now,
          now,
        ]
      );
      return normalizeUserRow(res.rows[0]);
    }

    const record: UserRecord = {
      id,
      name: data.name.trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      password_hash: passwordHash,
      is_verified: isVerified,
      role,
      planning_credits: initialCredits,
      created_at: now,
      updated_at: now,
    };
    memoryStore.users.set(id, record);
    return record;
  },

  async markUserVerified(userId: string): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        "UPDATE `users` SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [userId]
      );
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        "UPDATE users SET is_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [userId]
      );
      return;
    }

    const u = memoryStore.users.get(userId);
    if (u) {
      u.is_verified = true;
      u.updated_at = new Date();
    }
  },

  async deleteUnverifiedUser(userId: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user) return false;
    // Protect verified users
    if (user.is_verified) {
      throw new Error("تنها کاربران تایید‌نشده قابل حذف هستند.");
    }

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `email_verifications` WHERE user_id = ?", [userId]);
      await mysqlPool.execute("DELETE FROM `password_resets` WHERE user_id = ?", [userId]);
      await mysqlPool.execute("DELETE FROM `sessions` WHERE user_id = ?", [userId]);
      await mysqlPool.execute("DELETE FROM `tournaments` WHERE user_id = ?", [userId]);
      const [res]: any = await mysqlPool.execute("DELETE FROM `users` WHERE id = ? AND is_verified = 0", [userId]);
      return res.affectedRows > 0;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      await pgPool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
      await pgPool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await pgPool.query("DELETE FROM tournaments WHERE user_id = $1", [userId]);
      const res = await pgPool.query("DELETE FROM users WHERE id = $1 AND is_verified = FALSE", [userId]);
      return (res.rowCount ?? 0) > 0;
    }

    // In-memory
    for (const [k, v] of memoryStore.verifications.entries()) {
      if (v.user_id === userId) memoryStore.verifications.delete(k);
    }
    for (const [k, v] of memoryStore.passwordResets.entries()) {
      if (v.user_id === userId) memoryStore.passwordResets.delete(k);
    }
    for (const [token, s] of memoryStore.sessions.entries()) {
      if (s.user_id === userId) memoryStore.sessions.delete(token);
    }
    for (const [id, t] of memoryStore.tournaments.entries()) {
      if (t.user_id === userId) memoryStore.tournaments.delete(id);
    }
    return memoryStore.users.delete(userId);
  },

  async saveVerificationCode(userId: string, email: string, code: string, expiresMinutes = 15): Promise<EmailVerificationRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000);
    const cleanEmail = email.trim().toLowerCase();

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `email_verifications` WHERE user_id = ?", [userId]);
      await mysqlPool.execute(
        `INSERT INTO \`email_verifications\` (id, user_id, email, code, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, cleanEmail, code, expiresAt, now]
      );
      return { id, user_id: userId, email: cleanEmail, code, expires_at: expiresAt, created_at: now };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      const res = await pgPool.query(
        `INSERT INTO email_verifications (id, user_id, email, code, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, userId, cleanEmail, code, expiresAt, now]
      );
      return res.rows[0];
    }

    for (const [k, v] of memoryStore.verifications.entries()) {
      if (v.user_id === userId) {
        memoryStore.verifications.delete(k);
      }
    }
    const record: EmailVerificationRecord = {
      id,
      user_id: userId,
      email: cleanEmail,
      code,
      expires_at: expiresAt,
      created_at: now,
    };
    memoryStore.verifications.set(id, record);
    return record;
  },

  async verifyCode(email: string, code: string): Promise<EmailVerificationRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const now = new Date();

    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `email_verifications` WHERE LOWER(email) = ? AND code = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
        [cleanEmail, cleanCode, now]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        user_id: rows[0].user_id,
        email: rows[0].email,
        code: rows[0].code,
        expires_at: new Date(rows[0].expires_at),
        created_at: new Date(rows[0].created_at),
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM email_verifications WHERE LOWER(email) = $1 AND code = $2 AND expires_at > $3 ORDER BY created_at DESC LIMIT 1",
        [cleanEmail, cleanCode, now]
      );
      return res.rows[0] || null;
    }

    for (const v of memoryStore.verifications.values()) {
      if (
        v.email.toLowerCase() === cleanEmail &&
        v.code === cleanCode &&
        v.expires_at > now
      ) {
        return v;
      }
    }
    return null;
  },

  async deleteVerificationCodesForUser(userId: string): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `email_verifications` WHERE user_id = ?", [userId]);
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      return;
    }

    for (const [k, v] of memoryStore.verifications.entries()) {
      if (v.user_id === userId) {
        memoryStore.verifications.delete(k);
      }
    }
  },

  async createSession(userId: string, hours = 48, deviceType: "desktop" | "mobile" = "desktop"): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
    let snapshotUser: UserRecord | null = null;
    try {
      snapshotUser = await this.findUserById(userId);
    } catch {
      snapshotUser = null;
    }
    const signed = createSignedSessionToken({
      userId,
      name: snapshotUser?.name,
      email: snapshotUser?.email,
      mobile: snapshotUser?.mobile,
      role: snapshotUser?.role,
      isVerified: snapshotUser?.is_verified,
      deviceType,
      hours,
    });
    const token = signed.token;
    const sid = signed.sid;
    const record: SessionRecord = {
      id: sid,
      user_id: userId,
      device_type: deviceType,
      expires_at: expiresAt,
      last_active_at: now,
      created_at: now,
      user_snapshot: snapshotFromPayload(signed.payload),
    };

    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        try {
          await mysqlPool.execute(
            `INSERT INTO \`sessions\` (id, user_id, device_type, expires_at, last_active_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [sid, userId, deviceType, expiresAt, now, now]
          );
        } catch {
          await mysqlPool.query("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
          await mysqlPool.execute(
            `INSERT INTO \`sessions\` (id, user_id, device_type, expires_at, last_active_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [sid, userId, deviceType, expiresAt, now, now]
          ).catch(async () => {
            await mysqlPool!.execute(
              `INSERT INTO \`sessions\` (id, user_id, expires_at, last_active_at, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [sid, userId, expiresAt, now, now]
            );
          });
        }
        await mysqlPool.execute("UPDATE `users` SET updated_at = ? WHERE id = ?", [now, userId]).catch(() => {});
        return token;
      }

      if (pgPool) {
        await initTablesIfRealDb();
        await pgPool.query(
          `INSERT INTO sessions (id, user_id, device_type, expires_at, last_active_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sid, userId, deviceType, expiresAt, now, now]
        );
        await pgPool.query("UPDATE users SET updated_at = $1 WHERE id = $2", [now, userId]).catch(() => {});
        return token;
      }
    } catch (err) {
      console.warn("[NexSport DB] createSession persist failed; using signed cookie only:", err);
    }

    memoryStore.sessions.set(sid, record);
    return token;
  },

  async findActiveSessionByDevice(userId: string, deviceType: "desktop" | "mobile"): Promise<SessionRecord | null> {
    const now = new Date();
    if (mysqlPool) {
      await initTablesIfRealDb();
      try {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT * FROM `sessions` WHERE user_id = ? AND device_type = ? AND expires_at > ? ORDER BY last_active_at DESC LIMIT 1",
          [userId, deviceType, now]
        );
        const session = rows[0];
        if (session) {
          return {
            id: session.id,
            user_id: session.user_id,
            device_type: session.device_type,
            expires_at: new Date(session.expires_at),
            last_active_at: new Date(session.last_active_at),
            created_at: new Date(session.created_at),
          };
        }
        return null;
      } catch {
        // Auto-migrate column on existing database if missing
        await mysqlPool.query("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
        return null;
      }
    }

    if (pgPool) {
      await initTablesIfRealDb();
      try {
        const res = await pgPool.query(
          "SELECT * FROM sessions WHERE user_id = $1 AND device_type = $2 AND expires_at > $3 ORDER BY last_active_at DESC LIMIT 1",
          [userId, deviceType, now]
        );
        const session = res.rows[0];
        if (session) {
          return {
            id: session.id,
            user_id: session.user_id,
            device_type: session.device_type,
            expires_at: new Date(session.expires_at),
            last_active_at: new Date(session.last_active_at),
            created_at: new Date(session.created_at),
          };
        }
        return null;
      } catch {
        await pgPool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
        return null;
      }
    }

    for (const s of memoryStore.sessions.values()) {
      if (s.user_id === userId && (s.device_type || "desktop") === deviceType && s.expires_at > now) {
        return s;
      }
    }
    return null;
  },

  async deleteSessionsByDevice(userId: string, deviceType: "desktop" | "mobile"): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      try {
        await mysqlPool.execute("DELETE FROM `sessions` WHERE user_id = ? AND device_type = ?", [userId, deviceType]);
      } catch {
        await mysqlPool.query("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
        await mysqlPool.execute("DELETE FROM `sessions` WHERE user_id = ? AND device_type = ?", [userId, deviceType]).catch(() => {});
      }
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      try {
        await pgPool.query("DELETE FROM sessions WHERE user_id = $1 AND device_type = $2", [userId, deviceType]);
      } catch {
        await pgPool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
        await pgPool.query("DELETE FROM sessions WHERE user_id = $1 AND device_type = $2", [userId, deviceType]).catch(() => {});
      }
      return;
    }

    for (const [token, s] of memoryStore.sessions.entries()) {
      if (s.user_id === userId && (s.device_type || "desktop") === deviceType) {
        memoryStore.sessions.delete(token);
      }
    }
  },

  async findSession(token: string): Promise<SessionRecord | null> {
    const now = new Date();
    const rollingExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const parsed = parseSessionToken(token);
    const lookupId = parsed?.sid || token;
    const snapshot = parsed ? snapshotFromPayload(parsed) : undefined;

    const withMeta = (session: SessionRecord): SessionRecord => ({
      ...session,
      expires_at: rollingExpiresAt,
      last_active_at: now,
      user_snapshot: snapshot || session.user_snapshot,
    });

    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT * FROM `sessions` WHERE id = ? AND expires_at > ? LIMIT 1",
          [lookupId, now]
        );
        const session = rows[0];
        if (session) {
          mysqlPool.execute(
            "UPDATE `sessions` SET expires_at = ?, last_active_at = ? WHERE id = ?",
            [rollingExpiresAt, now, lookupId]
          ).catch(() => {});
          mysqlPool.execute("UPDATE `users` SET updated_at = ? WHERE id = ?", [now, session.user_id]).catch(() => {});
          return withMeta({
            id: session.id,
            user_id: session.user_id,
            device_type: session.device_type,
            expires_at: rollingExpiresAt,
            last_active_at: now,
            created_at: new Date(session.created_at),
          });
        }
        if (parsed && requireStoredSessionLookup()) return null;
        if (parsed) return sessionRecordFromPayload(parsed, now, rollingExpiresAt);
        return null;
      }

      if (pgPool) {
        await initTablesIfRealDb();
        const res = await pgPool.query(
          "SELECT * FROM sessions WHERE id = $1 AND expires_at > $2 LIMIT 1",
          [lookupId, now]
        );
        const session = res.rows[0];
        if (session) {
          pgPool.query(
            "UPDATE sessions SET expires_at = $1, last_active_at = $2 WHERE id = $3",
            [rollingExpiresAt, now, lookupId]
          ).catch(() => {});
          pgPool.query("UPDATE users SET updated_at = $1 WHERE id = $2", [now, session.user_id]).catch(() => {});
          return withMeta({
            id: session.id,
            user_id: session.user_id,
            device_type: session.device_type,
            expires_at: rollingExpiresAt,
            last_active_at: now,
            created_at: new Date(session.created_at),
          });
        }
        if (parsed && requireStoredSessionLookup()) return null;
        if (parsed) return sessionRecordFromPayload(parsed, now, rollingExpiresAt);
        return null;
      }
    } catch (err) {
      console.warn("[NexSport DB] findSession store failed:", err);
      if (parsed) return sessionRecordFromPayload(parsed, now, rollingExpiresAt);
      return null;
    }

    const s = memoryStore.sessions.get(lookupId) || memoryStore.sessions.get(token);
    if (s && s.expires_at > now) {
      s.expires_at = rollingExpiresAt;
      s.last_active_at = now;
      if (snapshot) s.user_snapshot = snapshot;
      return withMeta(s);
    }
    if (parsed && !requireStoredSessionLookup()) {
      return sessionRecordFromPayload(parsed, now, rollingExpiresAt);
    }
    return null;
  },

  async deleteSession(token: string): Promise<void> {
    const parsed = parseSessionToken(token);
    const ids = Array.from(new Set([token, parsed?.sid].filter(Boolean) as string[]));
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        for (const id of ids) {
          await mysqlPool.execute("DELETE FROM `sessions` WHERE id = ?", [id]).catch(() => {});
        }
        return;
      }

      if (pgPool) {
        await initTablesIfRealDb();
        for (const id of ids) {
          await pgPool.query("DELETE FROM sessions WHERE id = $1", [id]).catch(() => {});
        }
        return;
      }
    } catch (err) {
      console.warn("[NexSport DB] deleteSession failed:", err);
    }
    for (const id of ids) {
      memoryStore.sessions.delete(id);
    }
  },

  /* --- Password Reset Operations --- */

  async savePasswordResetCode(userId: string, email: string, code: string, expiresMinutes = 15): Promise<PasswordResetRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000);
    const cleanEmail = email.trim().toLowerCase();

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `password_resets` WHERE user_id = ?", [userId]);
      await mysqlPool.execute(
        `INSERT INTO \`password_resets\` (id, user_id, email, code, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, cleanEmail, code, expiresAt, now]
      );
      return { id, user_id: userId, email: cleanEmail, code, expires_at: expiresAt, created_at: now };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
      const res = await pgPool.query(
        `INSERT INTO password_resets (id, user_id, email, code, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, userId, cleanEmail, code, expiresAt, now]
      );
      return res.rows[0];
    }

    for (const [k, v] of memoryStore.passwordResets.entries()) {
      if (v.user_id === userId) {
        memoryStore.passwordResets.delete(k);
      }
    }
    const record: PasswordResetRecord = {
      id,
      user_id: userId,
      email: cleanEmail,
      code,
      expires_at: expiresAt,
      created_at: now,
    };
    memoryStore.passwordResets.set(id, record);
    return record;
  },

  async verifyPasswordResetCode(email: string, code: string): Promise<PasswordResetRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const now = new Date();

    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `password_resets` WHERE LOWER(email) = ? AND code = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
        [cleanEmail, cleanCode, now]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        user_id: rows[0].user_id,
        email: rows[0].email,
        code: rows[0].code,
        expires_at: new Date(rows[0].expires_at),
        created_at: new Date(rows[0].created_at),
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM password_resets WHERE LOWER(email) = $1 AND code = $2 AND expires_at > $3 ORDER BY created_at DESC LIMIT 1",
        [cleanEmail, cleanCode, now]
      );
      return res.rows[0] || null;
    }

    for (const v of memoryStore.passwordResets.values()) {
      if (
        v.email.toLowerCase() === cleanEmail &&
        v.code === cleanCode &&
        v.expires_at > now
      ) {
        return v;
      }
    }
    return null;
  },

  async deletePasswordResetCodesForUser(userId: string): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `password_resets` WHERE user_id = ?", [userId]);
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
      return;
    }

    for (const [k, v] of memoryStore.passwordResets.entries()) {
      if (v.user_id === userId) {
        memoryStore.passwordResets.delete(k);
      }
    }
  },

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        "UPDATE `users` SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [passwordHash, userId]
      );
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [passwordHash, userId]
      );
      return;
    }

    const u = memoryStore.users.get(userId);
    if (u) {
      u.password_hash = passwordHash;
      u.updated_at = new Date();
    }
  },

  async updateUserProfile(userId: string, name: string): Promise<UserRecord | null> {
    const cleanName = name.trim();
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        "UPDATE `users` SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [cleanName, userId]
      );
      return this.findUserById(userId);
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        [cleanName, userId]
      );
      return res.rows[0] ? normalizeUserRow(res.rows[0]) : null;
    }

    const u = memoryStore.users.get(userId);
    if (u) {
      u.name = cleanName;
      u.updated_at = new Date();
      return u;
    }
    return null;
  },

  /* --- Tournament Cloud Storage Operations --- */

  async saveTournament(data: {
    id?: string;
    userId: string;
    title: string;
    format: string;
    sport?: string;
    teamCount: number;
    state: any;
  }): Promise<TournamentRecord> {
    const id = data.id || generateShortId(8);
    const now = new Date();
    const title = data.title.trim();
    const format = data.format;
    const sport = data.sport || null;
    const teamCount = data.teamCount;

    // Preserve existing payment status if client didn't supply it
    let mergedState = data.state;
    if (data.id && (!mergedState || !mergedState.payment || !mergedState.registrationPayment || !mergedState.registration)) {
      try {
        const existing = await this.getTournament(data.id, data.userId);
        if (existing?.state?.payment && !mergedState?.payment) {
          mergedState = {
            ...mergedState,
            payment: existing.state.payment,
          };
        }
        if (existing?.state?.registrationPayment && !mergedState?.registrationPayment) {
          mergedState = {
            ...mergedState,
            registrationPayment: existing.state.registrationPayment,
          };
        }
        if (existing?.state?.registration && !mergedState?.registration) {
          mergedState = {
            ...mergedState,
            registration: existing.state.registration,
          };
        }
      } catch {
        // Fallback gracefully
      }
    }
    const stateJson = JSON.stringify(mergedState);

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`tournaments\` (id, user_id, title, format, sport, team_count, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           format = VALUES(format),
           sport = VALUES(sport),
           team_count = VALUES(team_count),
           state = VALUES(state),
           updated_at = VALUES(updated_at)`,
        [id, data.userId, title, format, sport, teamCount, stateJson, now, now]
      );
      return {
        id,
        user_id: data.userId,
        title,
        format,
        sport,
        team_count: teamCount,
        state: mergedState,
        created_at: now,
        updated_at: now,
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `INSERT INTO tournaments (id, user_id, title, format, sport, team_count, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           format = EXCLUDED.format,
           sport = EXCLUDED.sport,
           team_count = EXCLUDED.team_count,
           state = EXCLUDED.state,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          id,
          data.userId,
          title,
          format,
          sport,
          teamCount,
          stateJson,
          now,
          now,
        ]
      );
      const row = res.rows[0];
      return {
        ...row,
        state: typeof row.state === "string" ? JSON.parse(row.state) : row.state,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
      };
    }

    const record: TournamentRecord = {
      id,
      user_id: data.userId,
      title,
      format,
      sport,
      team_count: teamCount,
      state: mergedState,
      created_at: memoryStore.tournaments.get(id)?.created_at || now,
      updated_at: now,
    };
    memoryStore.tournaments.set(id, record);
    return record;
  },

  async listTournaments(userId: string): Promise<TournamentRecord[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT id, user_id, title, format, sport, team_count, created_at, updated_at FROM `tournaments` WHERE user_id = ? ORDER BY updated_at DESC",
        [userId]
      );
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        format: r.format,
        sport: r.sport,
        team_count: r.team_count,
        state: null,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      }));
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT id, user_id, title, format, sport, team_count, created_at, updated_at FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId]
      );
      return res.rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      }));
    }

    const list: TournamentRecord[] = [];
    for (const t of memoryStore.tournaments.values()) {
      if (t.user_id === userId) {
        list.push(t);
      }
    }
    return list.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async listTournamentsFull(userId: string): Promise<TournamentRecord[]> {
    await initTablesIfRealDb();
    const mapRow = (r: any): TournamentRecord => ({
      id: r.id,
      user_id: r.user_id,
      title: r.title,
      format: r.format,
      sport: r.sport,
      team_count: r.team_count,
      state: typeof r.state === "string" ? JSON.parse(r.state) : r.state,
      created_at: r.created_at instanceof Date ? r.created_at : new Date(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
    });
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `tournaments` WHERE user_id = ? ORDER BY updated_at DESC",
        [userId]
      );
      return rows.map(mapRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        "SELECT * FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId]
      );
      return res.rows.map(mapRow);
    }
    return this.listTournaments(userId);
  },

  async countUserLibrary(userId: string): Promise<{ teams: number; players: number }> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [teamRows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `teams` WHERE user_id = ?",
        [userId]
      );
      const [playerRows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `players` p INNER JOIN `teams` t ON t.id = p.team_id WHERE t.user_id = ?",
        [userId]
      );
      return { teams: Number(teamRows[0]?.c || 0), players: Number(playerRows[0]?.c || 0) };
    }
    if (pgPool) {
      const teams = await pgPool.query("SELECT COUNT(*)::int AS c FROM teams WHERE user_id = $1", [userId]);
      const players = await pgPool.query(
        "SELECT COUNT(*)::int AS c FROM players p INNER JOIN teams t ON t.id = p.team_id WHERE t.user_id = $1",
        [userId]
      );
      return { teams: teams.rows[0]?.c || 0, players: players.rows[0]?.c || 0 };
    }
    const teams = Array.from(memoryStore.teams.values()).filter((t) => t.user_id === userId);
    const teamIds = new Set(teams.map((t) => t.id));
    const players = Array.from(memoryStore.players.values()).filter((p) => teamIds.has(p.team_id));
    return { teams: teams.length, players: players.length };
  },

  async listLinkedTournaments(
    userId: string,
    teamId: string,
    teamName: string
  ): Promise<{ id: string; title: string; format: string; updated_at: Date }[]> {
    const parseState = (state: any) => {
      if (!state) return {} as any;
      if (typeof state === "string") {
        try {
          return JSON.parse(state);
        } catch {
          return {};
        }
      }
      return state;
    };
    const matches = (state: any) => {
      const s = parseState(state);
      const ids: string[] = Array.isArray(s.libraryTeamIds) ? s.libraryTeamIds.filter(Boolean) : [];
      const names: string[] = Array.isArray(s.teamNames) ? s.teamNames : [];
      return ids.includes(teamId) || names.includes(teamName);
    };
    const mapRow = (r: any) => ({
      id: r.id,
      title: r.title,
      format: r.format,
      updated_at: r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at),
    });

    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT id, title, format, state, updated_at FROM `tournaments` WHERE user_id = ? ORDER BY updated_at DESC",
        [userId]
      );
      return rows.filter((r) => matches(r.state)).map(mapRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT id, title, format, state, updated_at FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId]
      );
      return res.rows.filter((r) => matches(r.state)).map(mapRow);
    }
    return Array.from(memoryStore.tournaments.values())
      .filter((t) => t.user_id === userId && matches(t.state))
      .map(mapRow)
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async listAdminUserTournaments(userId?: string): Promise<AdminTournamentListItem[]> {
    const wantedUserId = userId?.trim() || "";

    if (mysqlPool) {
      await initTablesIfRealDb();
      const sql = wantedUserId
        ? `SELECT t.id, t.user_id, t.title, t.format, t.sport, t.team_count, t.state, t.created_at, t.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.mobile AS owner_mobile
           FROM \`tournaments\` t
           INNER JOIN \`users\` u ON u.id = t.user_id
           WHERE t.user_id = ? AND t.user_id <> 'public'
           ORDER BY t.updated_at DESC`
        : `SELECT t.id, t.user_id, t.title, t.format, t.sport, t.team_count, t.state, t.created_at, t.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.mobile AS owner_mobile
           FROM \`tournaments\` t
           INNER JOIN \`users\` u ON u.id = t.user_id
           WHERE t.user_id <> 'public'
           ORDER BY t.updated_at DESC`;
      const [rows] = wantedUserId
        ? await mysqlPool.execute<RowDataPacket[]>(sql, [wantedUserId])
        : await mysqlPool.execute<RowDataPacket[]>(sql);
      return rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        format: r.format,
        sport: r.sport,
        team_count: Number(r.team_count) || 0,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
        linkActive: tournamentLinkActive(r.state),
        owner: {
          id: r.user_id,
          name: r.owner_name || "",
          email: r.owner_email || "",
          mobile: r.owner_mobile || "",
        },
      }));
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const sql = wantedUserId
        ? `SELECT t.id, t.user_id, t.title, t.format, t.sport, t.team_count, t.state, t.created_at, t.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.mobile AS owner_mobile
           FROM tournaments t
           INNER JOIN users u ON u.id = t.user_id
           WHERE t.user_id = $1 AND t.user_id <> 'public'
           ORDER BY t.updated_at DESC`
        : `SELECT t.id, t.user_id, t.title, t.format, t.sport, t.team_count, t.state, t.created_at, t.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.mobile AS owner_mobile
           FROM tournaments t
           INNER JOIN users u ON u.id = t.user_id
           WHERE t.user_id <> 'public'
           ORDER BY t.updated_at DESC`;
      const res = wantedUserId ? await pgPool.query(sql, [wantedUserId]) : await pgPool.query(sql);
      return res.rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        format: r.format,
        sport: r.sport,
        team_count: Number(r.team_count) || 0,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
        linkActive: tournamentLinkActive(r.state),
        owner: {
          id: r.user_id,
          name: r.owner_name || "",
          email: r.owner_email || "",
          mobile: r.owner_mobile || "",
        },
      }));
    }

    const items: AdminTournamentListItem[] = [];
    for (const t of memoryStore.tournaments.values()) {
      if (!t.user_id || t.user_id === "public" || t.user_id === "guest") continue;
      if (wantedUserId && t.user_id !== wantedUserId) continue;
      const owner = memoryStore.users.get(t.user_id);
      if (!owner) continue;
      items.push({
        id: t.id,
        user_id: t.user_id,
        title: t.title,
        format: t.format,
        sport: t.sport,
        team_count: t.team_count,
        created_at: t.created_at,
        updated_at: t.updated_at,
        linkActive: tournamentLinkActive(t.state),
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          mobile: owner.mobile,
        },
      });
    }
    return items.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async getTournament(id: string, userId: string): Promise<TournamentRecord | null> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `tournaments` WHERE id = ? AND user_id = ? LIMIT 1",
        [id, userId]
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        format: r.format,
        sport: r.sport,
        team_count: r.team_count,
        state: typeof r.state === "string" ? JSON.parse(r.state) : r.state,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM tournaments WHERE id = $1 AND user_id = $2 LIMIT 1",
        [id, userId]
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0];
      return {
        ...r,
        state: typeof r.state === "string" ? JSON.parse(r.state) : r.state,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      };
    }

    const t = memoryStore.tournaments.get(id);
    if (t && t.user_id === userId) {
      return t;
    }
    return null;
  },

  async getPublicTournament(id: string): Promise<TournamentRecord | null> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `tournaments` WHERE id = ? LIMIT 1",
        [id]
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        id: r.id,
        user_id: r.user_id,
        title: r.title,
        format: r.format,
        sport: r.sport,
        team_count: r.team_count,
        state: typeof r.state === "string" ? JSON.parse(r.state) : r.state,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM tournaments WHERE id = $1 LIMIT 1",
        [id]
      );
      if (!res.rows[0]) return null;
      const r = res.rows[0];
      return {
        ...r,
        state: typeof r.state === "string" ? JSON.parse(r.state) : r.state,
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
      };
    }

    const t = memoryStore.tournaments.get(id);
    return t || null;
  },

  async deleteTournament(id: string, userId: string): Promise<boolean> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [res] = await mysqlPool.execute<ResultSetHeader>(
        "DELETE FROM `tournaments` WHERE id = ? AND user_id = ?",
        [id, userId]
      );
      return (res.affectedRows ?? 0) > 0;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "DELETE FROM tournaments WHERE id = $1 AND user_id = $2",
        [id, userId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const t = memoryStore.tournaments.get(id);
    if (t && t.user_id === userId) {
      memoryStore.tournaments.delete(id);
      return true;
    }
    return false;
  },

  /* --- Guest IP & Quota Operations --- */

  async guestTournamentLimit(): Promise<number> {
    try {
      const s = await this.getPricingSettings();
      return Math.max(0, Number(s.guestMaxTournaments) || 0);
    } catch {
      return DEFAULT_PRICING_SETTINGS.guestMaxTournaments;
    }
  },

  async getGuestUsage(ip: string): Promise<{ ip: string; count: number; remaining: number; limit: number }> {
    const cleanIp = (ip || "127.0.0.1").trim();
    const limit = await this.guestTournamentLimit();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT ip, count FROM `guest_usage` WHERE ip = ? LIMIT 1",
        [cleanIp]
      );
      const count = rows[0]?.count ? Number(rows[0].count) : 0;
      return { ip: cleanIp, count, remaining: Math.max(0, limit - count), limit };
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT ip, count FROM guest_usage WHERE ip = $1 LIMIT 1",
        [cleanIp]
      );
      const count = res.rows[0]?.count ? Number(res.rows[0].count) : 0;
      return { ip: cleanIp, count, remaining: Math.max(0, limit - count), limit };
    }
    const record = memoryStore.guestUsage.get(cleanIp);
    const count = record ? record.count : 0;
    return { ip: cleanIp, count, remaining: Math.max(0, limit - count), limit };
  },

  async recordGuestUsage(ip: string): Promise<{ success: boolean; count: number; remaining: number; limit: number }> {
    const cleanIp = (ip || "127.0.0.1").trim();
    const current = await this.getGuestUsage(cleanIp);
    const limit = current.limit;
    if (current.count >= limit) {
      return { success: false, count: current.count, remaining: 0, limit };
    }
    const newCount = current.count + 1;
    const now = new Date();

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`guest_usage\` (ip, count, last_used_at, created_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE count = ?, last_used_at = ?`,
        [cleanIp, newCount, now, now, newCount, now]
      );
      return { success: true, count: newCount, remaining: Math.max(0, limit - newCount), limit };
    }
    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO guest_usage (ip, count, last_used_at, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ip) DO UPDATE SET count = $2, last_used_at = $3`,
        [cleanIp, newCount, now, now]
      );
      return { success: true, count: newCount, remaining: Math.max(0, limit - newCount), limit };
    }
    memoryStore.guestUsage.set(cleanIp, { ip: cleanIp, count: newCount, last_used_at: now, created_at: now });
    return { success: true, count: newCount, remaining: Math.max(0, limit - newCount), limit };
  },

  async getUserQuota(userId: string): Promise<{
    isVip: boolean;
    vipExpiresAt: Date | null;
    isClubPro: boolean;
    clubProExpiresAt: Date | null;
    planningCredits: number;
    freeLinkAvailable: boolean;
    unlimitedPlanning: boolean;
    role: string;
  }> {
    const user = await this.findUserById(userId);
    if (!user) {
      return {
        isVip: false,
        vipExpiresAt: null,
        isClubPro: false,
        clubProExpiresAt: null,
        planningCredits: 0,
        freeLinkAvailable: false,
        unlimitedPlanning: false,
        role: "guest",
      };
    }
    const isVip = Boolean(
      user.vip_expires_at && new Date(user.vip_expires_at).getTime() > Date.now()
    );
    const isClubPro = Boolean(
      hasUnlimitedPlanning(user) ||
        (user.club_pro_expires_at && new Date(user.club_pro_expires_at).getTime() > Date.now())
    );
    const unlimitedPlanning = isVip || hasUnlimitedPlanning(user);
    const pricing = await this.getPricingSettings();
    return {
      isVip,
      vipExpiresAt: user.vip_expires_at || null,
      isClubPro,
      clubProExpiresAt: user.club_pro_expires_at || null,
      planningCredits: unlimitedPlanning
        ? 999999
        : user.planning_credits !== undefined
        ? Number(user.planning_credits)
        : pricing.userFreePlannings,
      freeLinkAvailable: pricing.userFreeLinks > 0 && !user.free_link_used,
      unlimitedPlanning,
      role: user.role,
    };
  },

  async consumePlanningCredit(userId: string): Promise<{
    success: boolean;
    isVip: boolean;
    remainingCredits: number;
    unlimitedPlanning?: boolean;
    error?: string;
  }> {
    const user = await this.findUserById(userId);
    if (!user) {
      return { success: false, isVip: false, remainingCredits: 0, error: "کاربر یافت نشد." };
    }
    const isVip = Boolean(
      user.vip_expires_at && new Date(user.vip_expires_at).getTime() > Date.now()
    );
    if (isVip || hasUnlimitedPlanning(user)) {
      return { success: true, isVip, remainingCredits: 999999, unlimitedPlanning: true };
    }
    const currentCredits =
      user.planning_credits !== undefined
        ? Number(user.planning_credits)
        : (await this.getPricingSettings()).userFreePlannings;
    if (currentCredits <= 0) {
      return {
        success: false,
        isVip: false,
        remainingCredits: 0,
        error: "اعتبار برنامه‌ریزی مسابقات شما به پایان رسیده است. جهت ادامه، لطفاً بسته اعتباری تهیه فرمایید یا به کاربر ویژه ارتقا دهید.",
      };
    }
    const newCredits = currentCredits - 1;
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("UPDATE `users` SET planning_credits = ? WHERE id = ?", [
        newCredits,
        userId,
      ]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("UPDATE users SET planning_credits = $1 WHERE id = $2", [
        newCredits,
        userId,
      ]);
    } else {
      user.planning_credits = newCredits;
      memoryStore.users.set(userId, user);
    }
    return { success: true, isVip: false, remainingCredits: newCredits };
  },

  async consumePlanningCredits(
    userId: string,
    count: number
  ): Promise<{
    success: boolean;
    remainingCredits: number;
    charged: number;
    error?: string;
  }> {
    const charge = Math.max(1, Math.floor(Number(count) || 0));
    const user = await this.findUserById(userId);
    if (!user) {
      return { success: false, remainingCredits: 0, charged: 0, error: "کاربر یافت نشد." };
    }
    if (hasUnlimitedPlanning(user)) {
      return { success: true, remainingCredits: 999999, charged: 0 };
    }
    const currentCredits =
      user.planning_credits !== undefined
        ? Number(user.planning_credits)
        : (await this.getPricingSettings()).userFreePlannings;
    if (currentCredits < charge) {
      return {
        success: false,
        remainingCredits: currentCredits,
        charged: 0,
        error: `برای این کار به ${charge} سهمیه برنامه‌سازی نیاز است. سهمیه فعلی شما کافی نیست.`,
      };
    }
    const newCredits = currentCredits - charge;
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("UPDATE `users` SET planning_credits = ? WHERE id = ?", [newCredits, userId]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("UPDATE users SET planning_credits = $1 WHERE id = $2", [newCredits, userId]);
    } else {
      user.planning_credits = newCredits;
      memoryStore.users.set(userId, user);
    }
    return { success: true, remainingCredits: newCredits, charged: charge };
  },

  async useFreeLink(userId: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user) return false;
    if (user.free_link_used) return false;
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("UPDATE `users` SET free_link_used = 1 WHERE id = ?", [userId]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("UPDATE users SET free_link_used = TRUE WHERE id = $1", [userId]);
    } else {
      user.free_link_used = true;
      memoryStore.users.set(userId, user);
    }
    return true;
  },

  async addPlanningCredits(userId: string, count: number): Promise<number> {
    const add = Math.max(1, Math.floor(Number(count) || 0));
    // Always ADD to the current balance — never replace it with the pack size.
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [result] = await mysqlPool.execute<any>(
        "UPDATE `users` SET planning_credits = COALESCE(planning_credits, 5) + ? WHERE id = ?",
        [add, userId]
      );
      if (result?.affectedRows) {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT planning_credits FROM `users` WHERE id = ? LIMIT 1",
          [userId]
        );
        if (rows[0]) {
          const total = Number(rows[0].planning_credits);
          const mem = memoryStore.users.get(userId);
          if (mem) {
            mem.planning_credits = total;
            memoryStore.users.set(userId, mem);
          }
          return total;
        }
      }
    } else if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "UPDATE users SET planning_credits = COALESCE(planning_credits, 5) + $1 WHERE id = $2 RETURNING planning_credits",
        [add, userId]
      );
      if (res.rows[0]) {
        const total = Number(res.rows[0].planning_credits);
        const mem = memoryStore.users.get(userId);
        if (mem) {
          mem.planning_credits = total;
          memoryStore.users.set(userId, mem);
        }
        return total;
      }
    }
    const user = await this.findUserById(userId);
    if (!user) return 0;
    const currentCredits =
      user.planning_credits !== undefined && user.planning_credits !== null
        ? Number(user.planning_credits)
        : (await this.getPricingSettings()).userFreePlannings;
    const newCredits = currentCredits + add;
    user.planning_credits = newCredits;
    memoryStore.users.set(userId, user);
    return newCredits;
  },

  async activateVipSubscription(userId: string, months: number): Promise<Date> {
    const user = await this.findUserById(userId);
    const now = new Date();
    let currentExp =
      user?.vip_expires_at && new Date(user.vip_expires_at).getTime() > now.getTime()
        ? new Date(user.vip_expires_at)
        : now;
    const newExp = new Date(currentExp);
    newExp.setMonth(newExp.getMonth() + Math.max(1, months));

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("UPDATE `users` SET vip_expires_at = ? WHERE id = ?", [
        newExp,
        userId,
      ]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("UPDATE users SET vip_expires_at = $1 WHERE id = $2", [newExp, userId]);
    } else if (user) {
      user.vip_expires_at = newExp;
      memoryStore.users.set(userId, user);
    }
    return newExp;
  },

  async activateClubProSubscription(userId: string, months: number): Promise<Date> {
    const user = await this.findUserById(userId);
    const now = new Date();
    let currentExp =
      user?.club_pro_expires_at && new Date(user.club_pro_expires_at).getTime() > now.getTime()
        ? new Date(user.club_pro_expires_at)
        : now;
    const newExp = new Date(currentExp);
    newExp.setMonth(newExp.getMonth() + Math.max(1, months));

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("UPDATE `users` SET club_pro_expires_at = ? WHERE id = ?", [newExp, userId]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("UPDATE users SET club_pro_expires_at = $1 WHERE id = $2", [newExp, userId]);
    } else if (user) {
      user.club_pro_expires_at = newExp;
      memoryStore.users.set(userId, user);
    }
    return newExp;
  },

  async markClubPagePaid(clubId: string): Promise<ClubRecord | null> {
    const existing = await this.getClub(clubId);
    if (!existing) return null;
    const now = new Date();
    const updated: ClubRecord = { ...existing, page_paid: true, page_paid_at: now, updated_at: now };
    if (mysqlPool) {
      await mysqlPool.execute("UPDATE `clubs` SET page_paid = 1, page_paid_at = ?, updated_at = ? WHERE id = ?", [
        now,
        now,
        clubId,
      ]);
    } else if (pgPool) {
      await pgPool.query("UPDATE clubs SET page_paid = TRUE, page_paid_at = $1, updated_at = $2 WHERE id = $3", [
        now,
        now,
        clubId,
      ]);
    }
    memoryStore.clubs.set(clubId, updated);
    return updated;
  },

  async countOwnedClubs(userId: string): Promise<number> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM `clubs` WHERE owner_id = ?",
        [userId]
      );
      return Number(rows[0]?.n || 0);
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT COUNT(*)::int AS n FROM clubs WHERE owner_id = $1", [userId]);
      return Number(res.rows[0]?.n || 0);
    }
    return Array.from(memoryStore.clubs.values()).filter((c) => c.owner_id === userId).length;
  },

  async countClubPlayers(clubId: string): Promise<number> {
    const teamIds = await this.listClubTeamIds(clubId);
    let n = 0;
    for (const tid of teamIds) {
      const roster = await this.listPlayers(tid);
      n += roster.length;
    }
    return n;
  },

  async listClubIdsForTeam(teamId: string): Promise<string[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT club_id FROM `club_teams` WHERE team_id = ?",
        [teamId]
      );
      return rows.map((r) => String(r.club_id));
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT club_id FROM club_teams WHERE team_id = $1", [teamId]);
      return res.rows.map((r) => String(r.club_id));
    }
    return Array.from(memoryStore.clubTeams.values())
      .filter((x) => x.team_id === teamId)
      .map((x) => x.club_id);
  },

  async savePaymentOrder(order: any): Promise<any> {
    const id = order.id || `ord_${Date.now()}`;
    const now = new Date();
    const orderData = {
      ...order,
      id,
      created_at: order.createdAt || order.created_at || now,
    };
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`payment_orders\` (id, item_type, user_id, tournament_id, item_quantity, item_duration_months, amount_tomans, gateway, status, authority, ref_id, description, created_at, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), ref_id = VALUES(ref_id), paid_at = VALUES(paid_at)`,
        [
          id,
          order.itemType || "tournament_link",
          order.userId,
          order.tournamentId || null,
          order.itemQuantity || null,
          order.itemDurationMonths || null,
          order.amountTomans || 0,
          order.gateway || "mock",
          order.status || "pending",
          order.authority || null,
          order.refId || null,
          order.description || null,
          orderData.created_at,
          order.paidAt ? new Date(order.paidAt) : null,
        ]
      );
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO payment_orders (id, item_type, user_id, tournament_id, item_quantity, item_duration_months, amount_tomans, gateway, status, authority, ref_id, description, created_at, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET status = $9, ref_id = $11, paid_at = $14`,
        [
          id,
          order.itemType || "tournament_link",
          order.userId,
          order.tournamentId || null,
          order.itemQuantity || null,
          order.itemDurationMonths || null,
          order.amountTomans || 0,
          order.gateway || "mock",
          order.status || "pending",
          order.authority || null,
          order.refId || null,
          order.description || null,
          orderData.created_at,
          order.paidAt ? new Date(order.paidAt) : null,
        ]
      );
    } else {
      memoryStore.orders.set(id, orderData);
    }
    return orderData;
  },

  async getPaymentOrder(orderId: string): Promise<any | null> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `payment_orders` WHERE id = ? LIMIT 1",
        [orderId]
      );
      return rows[0] || null;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT * FROM payment_orders WHERE id = $1 LIMIT 1", [orderId]);
      return res.rows[0] || null;
    }
    return memoryStore.orders.get(orderId) || null;
  },

  /* --- Discount Codes Operations --- */

  async listDiscountCodes(): Promise<DiscountCodeRecord[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `discount_codes` ORDER BY created_at DESC"
      );
      return rows.map(normalizeDiscountRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT * FROM discount_codes ORDER BY created_at DESC");
      return res.rows.map(normalizeDiscountRow);
    }
    return Array.from(memoryStore.discountCodes.values())
      .map(normalizeDiscountRow)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  },

  async createDiscountCode(data: {
    code: string;
    discountPercent: number;
    appliesTo: DiscountAppliesTo;
    expiresAt?: Date | null;
    isActive?: boolean;
    createdBy?: string;
  }): Promise<DiscountCodeRecord> {
    const id = crypto.randomUUID();
    const cleanCode = toEnglishDigits(data.code).trim().toUpperCase();
    const discountPercent = Math.min(
      100,
      Math.max(1, Math.round(Number(data.discountPercent) || 10))
    );
    const appliesTo = serializeAppliesTo(data.appliesTo || "all");
    const expiresAt = data.expiresAt || null;
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : true;
    const now = new Date();

    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        await mysqlPool.execute(
          `INSERT INTO \`discount_codes\` (id, code, discount_percent, applies_to, expires_at, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, cleanCode, discountPercent, appliesTo, expiresAt, isActive ? 1 : 0, now, now]
        );
      } else if (pgPool) {
        await initTablesIfRealDb();
        await pgPool.query(
          `INSERT INTO discount_codes (id, code, discount_percent, applies_to, expires_at, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, cleanCode, discountPercent, appliesTo, expiresAt, isActive, now, now]
        );
      }
    } catch (err) {
      console.warn("[NexSport DB] createDiscountCode persist failed:", err);
    }

    const record: DiscountCodeRecord = {
      id,
      code: cleanCode,
      discount_percent: discountPercent,
      applies_to: appliesTo,
      expires_at: expiresAt,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    };
    memoryStore.discountCodes.set(id, record);
    return record;
  },

  async toggleDiscountCode(id: string, desiredActive?: boolean): Promise<DiscountCodeRecord | null> {
    const now = new Date();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `discount_codes` WHERE id = ? LIMIT 1",
        [id]
      );
      if (!rows[0]) return null;
      const newActive = desiredActive !== undefined ? (desiredActive ? 1 : 0) : (rows[0].is_active ? 0 : 1);
      await mysqlPool.execute(
        "UPDATE `discount_codes` SET is_active = ?, updated_at = ? WHERE id = ?",
        [newActive, now, id]
      );
      const [updated] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `discount_codes` WHERE id = ? LIMIT 1",
        [id]
      );
      return normalizeDiscountRow(updated[0]);
    }

    if (pgPool) {
      await initTablesIfRealDb();
      if (desiredActive !== undefined) {
        const res = await pgPool.query(
          "UPDATE discount_codes SET is_active = $1, updated_at = $2 WHERE id = $3 RETURNING *",
          [desiredActive, now, id]
        );
        return res.rows[0] ? normalizeDiscountRow(res.rows[0]) : null;
      }
      const res = await pgPool.query(
        "UPDATE discount_codes SET is_active = NOT is_active, updated_at = $1 WHERE id = $2 RETURNING *",
        [now, id]
      );
      return res.rows[0] ? normalizeDiscountRow(res.rows[0]) : null;
    }

    const record = memoryStore.discountCodes.get(id);
    if (!record) return null;
    record.is_active = desiredActive !== undefined ? Boolean(desiredActive) : !record.is_active;
    record.updated_at = now;
    memoryStore.discountCodes.set(id, record);
    return normalizeDiscountRow(record);
  },

  async deleteDiscountCode(id: string): Promise<boolean> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [res] = await mysqlPool.execute<ResultSetHeader>(
        "DELETE FROM `discount_codes` WHERE id = ?",
        [id]
      );
      return (res.affectedRows ?? 0) > 0;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("DELETE FROM discount_codes WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    }
    return memoryStore.discountCodes.delete(id);
  },

  async validateDiscountCode(
    code: string,
    itemType: DiscountItemType | "planning",
    extraRecords: DiscountCodeRecord[] = []
  ): Promise<{
    valid: boolean;
    discount?: DiscountCodeRecord;
    discountPercent?: number;
    error?: string;
  }> {
    const cleanCode = toEnglishDigits(String(code || "")).trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, error: "لطفاً کد تخفیف را وارد فرمایید." };
    }

    let record: DiscountCodeRecord | null = null;
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT * FROM `discount_codes` WHERE code = ? LIMIT 1",
          [cleanCode]
        );
        if (rows[0]) record = normalizeDiscountRow(rows[0]);
      } else if (pgPool) {
        await initTablesIfRealDb();
        const res = await pgPool.query(
          "SELECT * FROM discount_codes WHERE code = $1 LIMIT 1",
          [cleanCode]
        );
        if (res.rows[0]) record = normalizeDiscountRow(res.rows[0]);
      }
    } catch (err) {
      console.warn("[NexSport DB] validateDiscountCode store failed:", err);
    }
    if (!record) {
      for (const d of memoryStore.discountCodes.values()) {
        if (String(d.code || "").trim().toUpperCase() === cleanCode) {
          record = normalizeDiscountRow(d);
          break;
        }
      }
    }
    if (!record) {
      for (const d of extraRecords) {
        if (String(d.code || "").trim().toUpperCase() === cleanCode) {
          record = normalizeDiscountRow(d);
          break;
        }
      }
    }

    if (!record) {
      return { valid: false, error: "کد تخفیف وارد شده معتبر نیست." };
    }

    if (!record.is_active) {
      return { valid: false, error: "این کد تخفیف در حال حاضر غیرفعال است." };
    }

    if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
      return { valid: false, error: "مهلت استفاده از این کد تخفیف به پایان رسیده است." };
    }

    if (!discountAppliesToItem(record.applies_to, itemType)) {
      return {
        valid: false,
        error: mismatchDiscountMessage(record.applies_to),
      };
    }

    return {
      valid: true,
      discount: record,
      discountPercent: record.discount_percent,
    };
  },

  async getPricingSettings(): Promise<PricingSettings> {
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
          "SELECT `setting_value` FROM `site_settings` WHERE `setting_key` = ? LIMIT 1",
          ["pricing"]
        );
        if (rows[0]?.setting_value) {
          return sanitizePricingSettings(JSON.parse(String(rows[0].setting_value)));
        }
      } else if (pgPool) {
        await initTablesIfRealDb();
        const res = await pgPool.query(
          "SELECT setting_value FROM site_settings WHERE setting_key = $1 LIMIT 1",
          ["pricing"]
        );
        if (res.rows[0]?.setting_value) {
          return sanitizePricingSettings(JSON.parse(String(res.rows[0].setting_value)));
        }
      } else {
        const raw = memoryStore.settings.get("pricing");
        if (raw) return sanitizePricingSettings(JSON.parse(raw));
      }
    } catch (err) {
      console.warn("[NexSport DB] getPricingSettings warning:", err);
    }
    return { ...DEFAULT_PRICING_SETTINGS };
  },

  async savePricingSettings(input: Partial<PricingSettings>): Promise<PricingSettings> {
    const settings = sanitizePricingSettings(input);
    const payload = JSON.stringify(settings);
    const now = new Date();

    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        await mysqlPool.execute(
          `INSERT INTO \`site_settings\` (\`setting_key\`, \`setting_value\`, \`updated_at\`)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`), \`updated_at\` = VALUES(\`updated_at\`)`,
          ["pricing", payload, now]
        );
      } else if (pgPool) {
        await initTablesIfRealDb();
        await pgPool.query(
          `INSERT INTO site_settings (setting_key, setting_value, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at`,
          ["pricing", payload, now]
        );
      }
    } catch (err) {
      console.warn("[NexSport DB] savePricingSettings persist failed:", err);
    }

    memoryStore.settings.set("pricing", payload);
    return settings;
  },

  async createTicket(data: {
    userId: string;
    subject: string;
    body: string;
  }): Promise<{ ticket: TicketRecord; message: TicketMessageRecord }> {
    const now = new Date();
    const ticketId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const subject = String(data.subject || "").trim().slice(0, 200);
    const body = String(data.body || "").trim().slice(0, 4000);
    const preview = previewTicketBody(body);

    const ticket: TicketRecord = {
      id: ticketId,
      user_id: data.userId,
      subject,
      status: "unanswered",
      user_has_unread: false,
      last_preview: preview,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    };
    const message: TicketMessageRecord = {
      id: messageId,
      ticket_id: ticketId,
      sender: "user",
      body,
      created_at: now,
    };

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`tickets\` (id, user_id, subject, status, user_has_unread, last_preview, last_message_at, created_at, updated_at)
         VALUES (?, ?, ?, 'unanswered', 0, ?, ?, ?, ?)`,
        [ticketId, data.userId, subject, preview, now, now, now]
      );
      await mysqlPool.execute(
        `INSERT INTO \`ticket_messages\` (id, ticket_id, sender, body, created_at) VALUES (?, ?, 'user', ?, ?)`,
        [messageId, ticketId, body, now]
      );
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO tickets (id, user_id, subject, status, user_has_unread, last_preview, last_message_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'unanswered', FALSE, $4, $5, $6, $7)`,
        [ticketId, data.userId, subject, preview, now, now, now]
      );
      await pgPool.query(
        `INSERT INTO ticket_messages (id, ticket_id, sender, body, created_at) VALUES ($1, $2, 'user', $3, $4)`,
        [messageId, ticketId, body, now]
      );
    }

    memoryStore.tickets.set(ticketId, ticket);
    memoryStore.ticketMessages.set(messageId, message);
    return { ticket, message };
  },

  async listUserTickets(userId: string): Promise<TicketRecord[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `tickets` WHERE user_id = ? ORDER BY last_message_at DESC",
        [userId]
      );
      return rows.map(normalizeTicketRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM tickets WHERE user_id = $1 ORDER BY last_message_at DESC",
        [userId]
      );
      return res.rows.map(normalizeTicketRow);
    }
    return Array.from(memoryStore.tickets.values())
      .filter((t) => t.user_id === userId)
      .map(normalizeTicketRow)
      .sort((a, b) => b.last_message_at.getTime() - a.last_message_at.getTime());
  },

  async listAdminTickets(): Promise<TicketRecord[]> {
    const attachUser = async (tickets: TicketRecord[]) => {
      return Promise.all(
        tickets.map(async (t) => {
          if (t.user_name) return t;
          const user = await db.findUserById(t.user_id);
          return {
            ...t,
            user_name: user?.name,
            user_email: user?.email,
            user_mobile: user?.mobile,
          };
        })
      );
    };

    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile
         FROM \`tickets\` t
         LEFT JOIN \`users\` u ON u.id = t.user_id
         ORDER BY CASE WHEN t.status = 'unanswered' THEN 0 ELSE 1 END, t.last_message_at DESC`
      );
      return rows.map(normalizeTicketRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `SELECT t.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile
         FROM tickets t
         LEFT JOIN users u ON u.id = t.user_id
         ORDER BY CASE WHEN t.status = 'unanswered' THEN 0 ELSE 1 END, t.last_message_at DESC`
      );
      return res.rows.map(normalizeTicketRow);
    }
    const list = Array.from(memoryStore.tickets.values())
      .map(normalizeTicketRow)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "unanswered" ? -1 : 1;
        return b.last_message_at.getTime() - a.last_message_at.getTime();
      });
    return attachUser(list);
  },

  async getTicket(id: string): Promise<TicketRecord | null> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile
         FROM \`tickets\` t LEFT JOIN \`users\` u ON u.id = t.user_id WHERE t.id = ? LIMIT 1`,
        [id]
      );
      return rows[0] ? normalizeTicketRow(rows[0]) : null;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `SELECT t.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile
         FROM tickets t LEFT JOIN users u ON u.id = t.user_id WHERE t.id = $1 LIMIT 1`,
        [id]
      );
      return res.rows[0] ? normalizeTicketRow(res.rows[0]) : null;
    }
    const ticket = memoryStore.tickets.get(id);
    if (!ticket) return null;
    const user = memoryStore.users.get(ticket.user_id);
    return {
      ...normalizeTicketRow(ticket),
      user_name: user?.name,
      user_email: user?.email,
      user_mobile: user?.mobile,
    };
  },

  async listTicketMessages(ticketId: string): Promise<TicketMessageRecord[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `ticket_messages` WHERE ticket_id = ? ORDER BY created_at ASC",
        [ticketId]
      );
      return rows.map(normalizeTicketMessageRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC",
        [ticketId]
      );
      return res.rows.map(normalizeTicketMessageRow);
    }
    return Array.from(memoryStore.ticketMessages.values())
      .filter((m) => m.ticket_id === ticketId)
      .map(normalizeTicketMessageRow)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  },

  async addTicketMessage(data: {
    ticketId: string;
    sender: TicketSender;
    body: string;
  }): Promise<TicketMessageRecord | null> {
    const ticket = await db.getTicket(data.ticketId);
    if (!ticket) return null;

    const now = new Date();
    const messageId = crypto.randomUUID();
    const body = String(data.body || "").trim().slice(0, 4000);
    const preview = previewTicketBody(body);
    const nextStatus: TicketStatus = data.sender === "admin" ? "answered" : "unanswered";
    const userHasUnread = data.sender === "admin";

    const message: TicketMessageRecord = {
      id: messageId,
      ticket_id: data.ticketId,
      sender: data.sender,
      body,
      created_at: now,
    };

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`ticket_messages\` (id, ticket_id, sender, body, created_at) VALUES (?, ?, ?, ?, ?)`,
        [messageId, data.ticketId, data.sender, body, now]
      );
      await mysqlPool.execute(
        `UPDATE \`tickets\` SET status = ?, user_has_unread = ?, last_preview = ?, last_message_at = ?, updated_at = ? WHERE id = ?`,
        [nextStatus, userHasUnread ? 1 : 0, preview, now, now, data.ticketId]
      );
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO ticket_messages (id, ticket_id, sender, body, created_at) VALUES ($1, $2, $3, $4, $5)`,
        [messageId, data.ticketId, data.sender, body, now]
      );
      await pgPool.query(
        `UPDATE tickets SET status = $1, user_has_unread = $2, last_preview = $3, last_message_at = $4, updated_at = $5 WHERE id = $6`,
        [nextStatus, userHasUnread, preview, now, now, data.ticketId]
      );
    }

    const stored = memoryStore.tickets.get(data.ticketId) || ticket;
    memoryStore.tickets.set(data.ticketId, {
      ...stored,
      status: nextStatus,
      user_has_unread: userHasUnread,
      last_preview: preview,
      last_message_at: now,
      updated_at: now,
    });
    memoryStore.ticketMessages.set(messageId, message);
    return message;
  },

  async markTicketReadByUser(ticketId: string, userId: string): Promise<TicketRecord | null> {
    const ticket = await db.getTicket(ticketId);
    if (!ticket || ticket.user_id !== userId) return null;
    if (!ticket.user_has_unread) return ticket;

    const now = new Date();
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        "UPDATE `tickets` SET user_has_unread = 0, updated_at = ? WHERE id = ? AND user_id = ?",
        [now, ticketId, userId]
      );
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        "UPDATE tickets SET user_has_unread = FALSE, updated_at = $1 WHERE id = $2 AND user_id = $3",
        [now, ticketId, userId]
      );
    }

    const stored = memoryStore.tickets.get(ticketId) || ticket;
    const updated = { ...stored, user_has_unread: false, updated_at: now };
    memoryStore.tickets.set(ticketId, updated);
    return { ...ticket, user_has_unread: false, updated_at: now };
  },

  async countUnansweredTickets(): Promise<number> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `tickets` WHERE status = 'unanswered'"
      );
      return Number(rows[0]?.c || 0);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT COUNT(*)::int AS c FROM tickets WHERE status = 'unanswered'");
      return Number(res.rows[0]?.c || 0);
    }
    return Array.from(memoryStore.tickets.values()).filter((t) => t.status === "unanswered").length;
  },

  async countUserUnreadTickets(userId: string): Promise<number> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `tickets` WHERE user_id = ? AND user_has_unread = 1",
        [userId]
      );
      return Number(rows[0]?.c || 0);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT COUNT(*)::int AS c FROM tickets WHERE user_id = $1 AND user_has_unread = TRUE",
        [userId]
      );
      return Number(res.rows[0]?.c || 0);
    }
    return Array.from(memoryStore.tickets.values()).filter(
      (t) => t.user_id === userId && t.user_has_unread
    ).length;
  },

  async listTeams(userId: string): Promise<TeamRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, (SELECT COUNT(*) FROM \`players\` p WHERE p.team_id = t.id) AS player_count
         FROM \`teams\` t WHERE t.user_id = ? ORDER BY t.updated_at DESC`,
        [userId]
      );
      return rows.map(normalizeTeamRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT t.*, (SELECT COUNT(*)::int FROM players p WHERE p.team_id = t.id) AS player_count
         FROM teams t WHERE t.user_id = $1 ORDER BY t.updated_at DESC`,
        [userId]
      );
      return res.rows.map(normalizeTeamRow);
    }
    return Array.from(memoryStore.teams.values())
      .filter((t) => t.user_id === userId)
      .map((t) => ({
        ...t,
        player_count: Array.from(memoryStore.players.values()).filter((p) => p.team_id === t.id).length,
      }))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async listAllTeams(): Promise<TeamRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*) FROM \`players\` p WHERE p.team_id = t.id) AS player_count
         FROM \`teams\` t INNER JOIN \`users\` u ON u.id = t.user_id
         ORDER BY t.updated_at DESC`
      );
      return rows.map(normalizeTeamRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT t.*, u.name AS owner_name, u.email AS owner_email,
                (SELECT COUNT(*)::int FROM players p WHERE p.team_id = t.id) AS player_count
         FROM teams t INNER JOIN users u ON u.id = t.user_id
         ORDER BY t.updated_at DESC`
      );
      return res.rows.map(normalizeTeamRow);
    }
    const usersById = memoryStore.users;
    return Array.from(memoryStore.teams.values())
      .map((t) => {
        const owner = usersById.get(t.user_id);
        return {
          ...t,
          owner_name: owner?.name || "",
          owner_email: owner?.email || "",
          player_count: Array.from(memoryStore.players.values()).filter((p) => p.team_id === t.id).length,
        };
      })
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async getTeam(id: string): Promise<TeamRecord | null> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, (SELECT COUNT(*) FROM \`players\` p WHERE p.team_id = t.id) AS player_count
         FROM \`teams\` t WHERE t.id = ? LIMIT 1`,
        [id]
      );
      return rows[0] ? normalizeTeamRow(rows[0]) : null;
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT t.*, (SELECT COUNT(*)::int FROM players p WHERE p.team_id = t.id) AS player_count
         FROM teams t WHERE t.id = $1 LIMIT 1`,
        [id]
      );
      return res.rows[0] ? normalizeTeamRow(res.rows[0]) : null;
    }
    const t = memoryStore.teams.get(id);
    if (!t) return null;
    return {
      ...t,
      player_count: Array.from(memoryStore.players.values()).filter((p) => p.team_id === t.id).length,
    };
  },

  async createTeam(userId: string, data: Omit<TeamRecord, "id" | "user_id" | "created_at" | "updated_at" | "player_count" | "owner_name" | "owner_email">): Promise<TeamRecord> {
    await initTablesIfRealDb();
    const now = new Date();
    const team: TeamRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...data,
      is_public: Boolean((data as TeamRecord).is_public),
      created_at: now,
      updated_at: now,
      player_count: 0,
    };
    if (mysqlPool) {
      await mysqlPool.execute(
        `INSERT INTO \`teams\` (id, user_id, name, short_name, sport, city, founded_year, kit_home, kit_away, coach, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [team.id, userId, team.name, team.short_name, team.sport, team.city, team.founded_year, team.kit_home, team.kit_away, team.coach, team.description, now, now]
      );
    } else if (pgPool) {
      await pgPool.query(
        `INSERT INTO teams (id, user_id, name, short_name, sport, city, founded_year, kit_home, kit_away, coach, description, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [team.id, userId, team.name, team.short_name, team.sport, team.city, team.founded_year, team.kit_home, team.kit_away, team.coach, team.description, now, now]
      );
    }
    memoryStore.teams.set(team.id, team);
    return team;
  },

  async updateTeam(id: string, data: Omit<TeamRecord, "id" | "user_id" | "created_at" | "updated_at" | "player_count" | "owner_name" | "owner_email">): Promise<TeamRecord | null> {
    const existing = await this.getTeam(id);
    if (!existing) return null;
    const now = new Date();
    const updated: TeamRecord = { ...existing, ...data, updated_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        `UPDATE \`teams\` SET name=?, short_name=?, sport=?, city=?, founded_year=?, kit_home=?, kit_away=?, coach=?, description=?, updated_at=? WHERE id=?`,
        [updated.name, updated.short_name, updated.sport, updated.city, updated.founded_year, updated.kit_home, updated.kit_away, updated.coach, updated.description, now, id]
      );
    } else if (pgPool) {
      await pgPool.query(
        `UPDATE teams SET name=$1, short_name=$2, sport=$3, city=$4, founded_year=$5, kit_home=$6, kit_away=$7, coach=$8, description=$9, updated_at=$10 WHERE id=$11`,
        [updated.name, updated.short_name, updated.sport, updated.city, updated.founded_year, updated.kit_home, updated.kit_away, updated.coach, updated.description, now, id]
      );
    }
    memoryStore.teams.set(id, updated);
    return updated;
  },

  async deleteTeam(id: string): Promise<boolean> {
    const existing = await this.getTeam(id);
    if (!existing) return false;
    if (mysqlPool) {
      await mysqlPool.execute("DELETE FROM `players` WHERE team_id = ?", [id]);
      await mysqlPool.execute("DELETE FROM `teams` WHERE id = ?", [id]);
    } else if (pgPool) {
      await pgPool.query("DELETE FROM players WHERE team_id = $1", [id]);
      await pgPool.query("DELETE FROM teams WHERE id = $1", [id]);
    }
    for (const [pid, p] of memoryStore.players) {
      if (p.team_id === id) memoryStore.players.delete(pid);
    }
    memoryStore.teams.delete(id);
    return true;
  },

  async listPlayers(teamId: string): Promise<PlayerRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `players` WHERE team_id = ? ORDER BY jersey_number ASC, name ASC",
        [teamId]
      );
      return rows.map(normalizePlayerRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        "SELECT * FROM players WHERE team_id = $1 ORDER BY jersey_number ASC, name ASC",
        [teamId]
      );
      return res.rows.map(normalizePlayerRow);
    }
    return Array.from(memoryStore.players.values())
      .filter((p) => p.team_id === teamId)
      .map((p) => ({ ...p }))
      .sort((a, b) => Number(a.jersey_number || 999) - Number(b.jersey_number || 999) || a.name.localeCompare(b.name, "fa"));
  },

  async createPlayer(teamId: string, data: Omit<PlayerRecord, "id" | "team_id" | "created_at" | "updated_at">): Promise<PlayerRecord | { error: string }> {
    const roster = await this.listPlayers(teamId);
    if (data.jersey_number && roster.some((p) => p.jersey_number && p.jersey_number === data.jersey_number)) {
      return { error: "این شماره پیراهن در این تیم قبلاً ثبت شده است." };
    }
    const now = new Date();
    const player: PlayerRecord = {
      id: crypto.randomUUID(),
      team_id: teamId,
      ...data,
      created_at: now,
      updated_at: now,
    };
    if (mysqlPool) {
      await mysqlPool.execute(
        `INSERT INTO \`players\` (id, team_id, name, jersey_number, position, birth_date, mobile, national_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [player.id, teamId, player.name, player.jersey_number, player.position, player.birth_date, player.mobile, player.national_id, player.status, now, now]
      );
    } else if (pgPool) {
      await pgPool.query(
        `INSERT INTO players (id, team_id, name, jersey_number, position, birth_date, mobile, national_id, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [player.id, teamId, player.name, player.jersey_number, player.position, player.birth_date, player.mobile, player.national_id, player.status, now, now]
      );
    }
    memoryStore.players.set(player.id, player);
    return player;
  },

  async updatePlayer(playerId: string, data: Omit<PlayerRecord, "id" | "team_id" | "created_at" | "updated_at">): Promise<PlayerRecord | { error: string } | null> {
    const current = await this.getPlayer(playerId);
    if (!current) return null;
    const roster = await this.listPlayers(current.team_id);
    if (data.jersey_number && roster.some((p) => p.id !== playerId && p.jersey_number && p.jersey_number === data.jersey_number)) {
      return { error: "این شماره پیراهن در این تیم قبلاً ثبت شده است." };
    }
    const now = new Date();
    const updated: PlayerRecord = { ...current, ...data, updated_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        `UPDATE \`players\` SET name=?, jersey_number=?, position=?, birth_date=?, mobile=?, national_id=?, status=?, updated_at=? WHERE id=?`,
        [updated.name, updated.jersey_number, updated.position, updated.birth_date, updated.mobile, updated.national_id, updated.status, now, playerId]
      );
    } else if (pgPool) {
      await pgPool.query(
        `UPDATE players SET name=$1, jersey_number=$2, position=$3, birth_date=$4, mobile=$5, national_id=$6, status=$7, updated_at=$8 WHERE id=$9`,
        [updated.name, updated.jersey_number, updated.position, updated.birth_date, updated.mobile, updated.national_id, updated.status, now, playerId]
      );
    }
    memoryStore.players.set(playerId, updated);
    return updated;
  },

  async getPlayer(playerId: string): Promise<PlayerRecord | null> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>("SELECT * FROM `players` WHERE id = ? LIMIT 1", [playerId]);
      return rows[0] ? normalizePlayerRow(rows[0]) : null;
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT * FROM players WHERE id = $1 LIMIT 1", [playerId]);
      return res.rows[0] ? normalizePlayerRow(res.rows[0]) : null;
    }
    return memoryStore.players.get(playerId) || null;
  },

  async deletePlayer(playerId: string): Promise<boolean> {
    const existing = await this.getPlayer(playerId);
    if (!existing) return false;
    if (mysqlPool) {
      await mysqlPool.execute("DELETE FROM `players` WHERE id = ?", [playerId]);
    } else if (pgPool) {
      await pgPool.query("DELETE FROM players WHERE id = $1", [playerId]);
    }
    memoryStore.players.delete(playerId);
    return true;
  },

  async listRegistrations(tournamentId: string): Promise<RegistrationRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `registrations` WHERE tournament_id = ? ORDER BY created_at ASC",
        [tournamentId]
      );
      return rows.map(normalizeRegistrationRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        "SELECT * FROM registrations WHERE tournament_id = $1 ORDER BY created_at ASC",
        [tournamentId]
      );
      return res.rows.map(normalizeRegistrationRow);
    }
    return Array.from(memoryStore.registrations.values())
      .filter((r) => r.tournament_id === tournamentId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  },

  async listRegistrationsByUser(userId: string): Promise<(RegistrationRecord & { tournament_title: string })[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT r.*, t.title AS tournament_title
         FROM \`registrations\` r
         INNER JOIN \`tournaments\` t ON t.id = r.tournament_id
         WHERE t.user_id = ?
         ORDER BY r.created_at DESC`,
        [userId]
      );
      return rows.map((row) => ({ ...normalizeRegistrationRow(row), tournament_title: String(row.tournament_title || "") }));
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT r.*, t.title AS tournament_title
         FROM registrations r
         INNER JOIN tournaments t ON t.id = r.tournament_id
         WHERE t.user_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      );
      return res.rows.map((row) => ({ ...normalizeRegistrationRow(row), tournament_title: String(row.tournament_title || "") }));
    }
    const mine = await this.listTournaments(userId);
    const byId = new Map(mine.map((t) => [t.id, t.title]));
    return Array.from(memoryStore.registrations.values())
      .filter((r) => byId.has(r.tournament_id))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((r) => ({ ...r, tournament_title: byId.get(r.tournament_id) || "" }));
  },

  async getRegistration(id: string): Promise<RegistrationRecord | null> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `registrations` WHERE id = ? LIMIT 1",
        [id]
      );
      return rows[0] ? normalizeRegistrationRow(rows[0]) : null;
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT * FROM registrations WHERE id = $1 LIMIT 1", [id]);
      return res.rows[0] ? normalizeRegistrationRow(res.rows[0]) : null;
    }
    return memoryStore.registrations.get(id) || null;
  },

  async createRegistration(
    tournamentId: string,
    data: Omit<RegistrationRecord, "id" | "tournament_id" | "created_at" | "updated_at" | "status" | "reject_reason"> & {
      status?: RegistrationStatus;
    }
  ): Promise<RegistrationRecord | { error: string }> {
    const existing = await this.listRegistrations(tournamentId);
    const nameKey = data.team_name.trim();
    if (existing.some((r) => r.status !== "rejected" && r.team_name.trim() === nameKey)) {
      return { error: "تیمی با این نام قبلاً برای این مسابقه ثبت شده است." };
    }
    const now = new Date();
    const rec: RegistrationRecord = {
      id: crypto.randomUUID(),
      tournament_id: tournamentId,
      team_name: data.team_name,
      short_name: data.short_name || "",
      city: data.city || "",
      coach: data.coach || "",
      contact_name: data.contact_name || "",
      mobile: data.mobile || "",
      notes: data.notes || "",
      status: data.status || "pending",
      library_team_id: data.library_team_id || "",
      reject_reason: "",
      roster: Array.isArray(data.roster) ? data.roster : [],
      created_at: now,
      updated_at: now,
    };
    const rosterJson = JSON.stringify(rec.roster);
    if (mysqlPool) {
      await mysqlPool.execute(
        `INSERT INTO \`registrations\` (id, tournament_id, team_name, short_name, city, coach, contact_name, mobile, notes, status, library_team_id, reject_reason, roster, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rec.id,
          tournamentId,
          rec.team_name,
          rec.short_name,
          rec.city,
          rec.coach,
          rec.contact_name,
          rec.mobile,
          rec.notes,
          rec.status,
          rec.library_team_id,
          rec.reject_reason,
          rosterJson,
          now,
          now,
        ]
      );
    } else if (pgPool) {
      await pgPool.query(
        `INSERT INTO registrations (id, tournament_id, team_name, short_name, city, coach, contact_name, mobile, notes, status, library_team_id, reject_reason, roster, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          rec.id,
          tournamentId,
          rec.team_name,
          rec.short_name,
          rec.city,
          rec.coach,
          rec.contact_name,
          rec.mobile,
          rec.notes,
          rec.status,
          rec.library_team_id,
          rec.reject_reason,
          rosterJson,
          now,
          now,
        ]
      );
    }
    memoryStore.registrations.set(rec.id, rec);
    return rec;
  },

  async updateRegistrationStatus(
    id: string,
    status: RegistrationStatus,
    rejectReason = ""
  ): Promise<RegistrationRecord | { error: string } | null> {
    const current = await this.getRegistration(id);
    if (!current) return null;
    const now = new Date();
    const updated: RegistrationRecord = {
      ...current,
      status,
      reject_reason: status === "rejected" ? String(rejectReason || "").trim().slice(0, 300) : "",
      updated_at: now,
    };
    if (mysqlPool) {
      await mysqlPool.execute(
        "UPDATE `registrations` SET status=?, reject_reason=?, updated_at=? WHERE id=?",
        [updated.status, updated.reject_reason, now, id]
      );
    } else if (pgPool) {
      await pgPool.query(
        "UPDATE registrations SET status=$1, reject_reason=$2, updated_at=$3 WHERE id=$4",
        [updated.status, updated.reject_reason, now, id]
      );
    }
    memoryStore.registrations.set(id, updated);
    return updated;
  },

  async getClub(id: string): Promise<ClubRecord | null> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>("SELECT * FROM `clubs` WHERE id = ? LIMIT 1", [id]);
      return rows[0] ? normalizeClubRow(rows[0]) : null;
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT * FROM clubs WHERE id = $1 LIMIT 1", [id]);
      return res.rows[0] ? normalizeClubRow(res.rows[0]) : null;
    }
    return memoryStore.clubs.get(id) || null;
  },

  async listClubsForUser(userId: string): Promise<ClubRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT c.*, m.role AS my_role, m.status AS my_status
         FROM \`clubs\` c INNER JOIN \`club_members\` m ON m.club_id = c.id
         WHERE m.user_id = ? AND m.status = 'active'
         ORDER BY c.updated_at DESC`,
        [userId]
      );
      return rows.map(normalizeClubRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT c.*, m.role AS my_role, m.status AS my_status
         FROM clubs c INNER JOIN club_members m ON m.club_id = c.id
         WHERE m.user_id = $1 AND m.status = 'active'
         ORDER BY c.updated_at DESC`,
        [userId]
      );
      return res.rows.map(normalizeClubRow);
    }
    const out: ClubRecord[] = [];
    for (const m of memoryStore.clubMembers.values()) {
      if (m.user_id !== userId || m.status !== "active") continue;
      const c = memoryStore.clubs.get(m.club_id);
      if (c) out.push({ ...c, my_role: m.role, my_status: m.status });
    }
    return out.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  },

  async listClubInvites(userId: string): Promise<ClubRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT c.*, m.role AS my_role, m.status AS my_status
         FROM \`clubs\` c INNER JOIN \`club_members\` m ON m.club_id = c.id
         WHERE m.user_id = ? AND m.status = 'pending'
         ORDER BY m.created_at DESC`,
        [userId]
      );
      return rows.map(normalizeClubRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT c.*, m.role AS my_role, m.status AS my_status
         FROM clubs c INNER JOIN club_members m ON m.club_id = c.id
         WHERE m.user_id = $1 AND m.status = 'pending'
         ORDER BY m.created_at DESC`,
        [userId]
      );
      return res.rows.map(normalizeClubRow);
    }
    const out: ClubRecord[] = [];
    for (const m of memoryStore.clubMembers.values()) {
      if (m.user_id !== userId || m.status !== "pending") continue;
      const c = memoryStore.clubs.get(m.club_id);
      if (c) out.push({ ...c, my_role: m.role, my_status: m.status });
    }
    return out;
  },

  async createClub(
    ownerId: string,
    data: Omit<ClubRecord, "id" | "owner_id" | "created_at" | "updated_at" | "member_count" | "team_count" | "my_role" | "my_status">
  ): Promise<ClubRecord> {
    await initTablesIfRealDb();
    let id = generateShortId(8);
    for (let i = 0; i < 6; i++) {
      if (!(await this.getClub(id))) break;
      id = generateShortId(8);
    }
    const now = new Date();
    const club: ClubRecord = {
      id,
      owner_id: ownerId,
      ...data,
      page_paid: false,
      page_paid_at: null,
      created_at: now,
      updated_at: now,
    };
    if (mysqlPool) {
      await mysqlPool.execute(
        `INSERT INTO \`clubs\` (id, owner_id, name, short_name, sport, city, founded_year, venue, description, contact_name, mobile, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ownerId, club.name, club.short_name, club.sport, club.city, club.founded_year, club.venue, club.description, club.contact_name, club.mobile, now, now]
      );
    } else if (pgPool) {
      await pgPool.query(
        `INSERT INTO clubs (id, owner_id, name, short_name, sport, city, founded_year, venue, description, contact_name, mobile, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, ownerId, club.name, club.short_name, club.sport, club.city, club.founded_year, club.venue, club.description, club.contact_name, club.mobile, now, now]
      );
    }
    memoryStore.clubs.set(id, club);
    await this.addClubMember(id, ownerId, "owner", "active");
    return { ...club, my_role: "owner", my_status: "active" };
  },

  async updateClub(
    id: string,
    data: Omit<ClubRecord, "id" | "owner_id" | "created_at" | "updated_at" | "member_count" | "team_count" | "my_role" | "my_status">
  ): Promise<ClubRecord | null> {
    const existing = await this.getClub(id);
    if (!existing) return null;
    const now = new Date();
    const updated: ClubRecord = { ...existing, ...data, updated_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        `UPDATE \`clubs\` SET name=?, short_name=?, sport=?, city=?, founded_year=?, venue=?, description=?, contact_name=?, mobile=?, updated_at=? WHERE id=?`,
        [updated.name, updated.short_name, updated.sport, updated.city, updated.founded_year, updated.venue, updated.description, updated.contact_name, updated.mobile, now, id]
      );
    } else if (pgPool) {
      await pgPool.query(
        `UPDATE clubs SET name=$1, short_name=$2, sport=$3, city=$4, founded_year=$5, venue=$6, description=$7, contact_name=$8, mobile=$9, updated_at=$10 WHERE id=$11`,
        [updated.name, updated.short_name, updated.sport, updated.city, updated.founded_year, updated.venue, updated.description, updated.contact_name, updated.mobile, now, id]
      );
    }
    memoryStore.clubs.set(id, updated);
    return updated;
  },

  async deleteClub(id: string): Promise<boolean> {
    const existing = await this.getClub(id);
    if (!existing) return false;
    if (mysqlPool) {
      await mysqlPool.execute("DELETE FROM `club_members` WHERE club_id = ?", [id]);
      await mysqlPool.execute("DELETE FROM `club_coaches` WHERE club_id = ?", [id]);
      await mysqlPool.execute("DELETE FROM `club_teams` WHERE club_id = ?", [id]);
      await mysqlPool.execute("DELETE FROM `club_tournaments` WHERE club_id = ?", [id]);
      await mysqlPool.execute("DELETE FROM `clubs` WHERE id = ?", [id]);
    } else if (pgPool) {
      await pgPool.query("DELETE FROM club_members WHERE club_id = $1", [id]);
      await pgPool.query("DELETE FROM club_coaches WHERE club_id = $1", [id]);
      await pgPool.query("DELETE FROM club_teams WHERE club_id = $1", [id]);
      await pgPool.query("DELETE FROM club_tournaments WHERE club_id = $1", [id]);
      await pgPool.query("DELETE FROM clubs WHERE id = $1", [id]);
    }
    for (const [k, m] of memoryStore.clubMembers) if (m.club_id === id) memoryStore.clubMembers.delete(k);
    for (const [k, m] of memoryStore.clubCoaches) if (m.club_id === id) memoryStore.clubCoaches.delete(k);
    for (const [k, m] of memoryStore.clubTeams) if (m.club_id === id) memoryStore.clubTeams.delete(k);
    for (const [k, m] of memoryStore.clubTournaments) if (m.club_id === id) memoryStore.clubTournaments.delete(k);
    memoryStore.clubs.delete(id);
    return true;
  },

  async getClubMembership(clubId: string, userId: string): Promise<ClubMemberRecord | null> {
    const members = await this.listClubMembers(clubId);
    return members.find((m) => m.user_id === userId) || null;
  },

  async listClubMembers(clubId: string): Promise<ClubMemberRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT m.*, u.name, u.email, u.mobile FROM \`club_members\` m
         LEFT JOIN \`users\` u ON u.id = m.user_id WHERE m.club_id = ? ORDER BY m.created_at ASC`,
        [clubId]
      );
      return rows.map(normalizeClubMemberRow);
    }
    if (pgPool) {
      const res = await pgPool.query(
        `SELECT m.*, u.name, u.email, u.mobile FROM club_members m
         LEFT JOIN users u ON u.id = m.user_id WHERE m.club_id = $1 ORDER BY m.created_at ASC`,
        [clubId]
      );
      return res.rows.map(normalizeClubMemberRow);
    }
    return Array.from(memoryStore.clubMembers.values())
      .filter((m) => m.club_id === clubId)
      .map((m) => {
        const u = memoryStore.users.get(m.user_id);
        return { ...m, name: u?.name, email: u?.email, mobile: u?.mobile };
      })
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  },

  async addClubMember(
    clubId: string,
    userId: string,
    role: ClubMemberRole,
    status: ClubMemberStatus
  ): Promise<ClubMemberRecord | { error: string }> {
    const existing = await this.getClubMembership(clubId, userId);
    if (existing) {
      if (existing.status === "active") return { error: "این کاربر هم‌اکنون عضو باشگاه است." };
      return { error: "دعوت قبلی برای این کاربر هنوز پاسخ داده نشده است." };
    }
    const now = new Date();
    const rec: ClubMemberRecord = { id: crypto.randomUUID(), club_id: clubId, user_id: userId, role, status, created_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        "INSERT INTO `club_members` (id, club_id, user_id, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [rec.id, clubId, userId, role, status, now]
      );
    } else if (pgPool) {
      await pgPool.query(
        "INSERT INTO club_members (id, club_id, user_id, role, status, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [rec.id, clubId, userId, role, status, now]
      );
    }
    memoryStore.clubMembers.set(rec.id, rec);
    return rec;
  },

  async updateClubMember(
    id: string,
    patch: { role?: ClubMemberRole; status?: ClubMemberStatus }
  ): Promise<ClubMemberRecord | null> {
    await initTablesIfRealDb();
    let current: ClubMemberRecord | null = null;
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>("SELECT * FROM `club_members` WHERE id = ? LIMIT 1", [id]);
      current = rows[0] ? normalizeClubMemberRow(rows[0]) : null;
    } else if (pgPool) {
      const res = await pgPool.query("SELECT * FROM club_members WHERE id = $1 LIMIT 1", [id]);
      current = res.rows[0] ? normalizeClubMemberRow(res.rows[0]) : null;
    } else {
      current = memoryStore.clubMembers.get(id) || null;
    }
    if (!current) return null;
    const updated: ClubMemberRecord = { ...current, role: patch.role || current.role, status: patch.status || current.status };
    if (mysqlPool) {
      await mysqlPool.execute("UPDATE `club_members` SET role=?, status=? WHERE id=?", [updated.role, updated.status, id]);
    } else if (pgPool) {
      await pgPool.query("UPDATE club_members SET role=$1, status=$2 WHERE id=$3", [updated.role, updated.status, id]);
    }
    memoryStore.clubMembers.set(id, updated);
    return updated;
  },

  async removeClubMember(id: string): Promise<boolean> {
    if (mysqlPool) await mysqlPool.execute("DELETE FROM `club_members` WHERE id = ?", [id]);
    else if (pgPool) await pgPool.query("DELETE FROM club_members WHERE id = $1", [id]);
    return memoryStore.clubMembers.delete(id) || true;
  },

  async listClubCoaches(clubId: string): Promise<ClubCoachRecord[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `club_coaches` WHERE club_id = ? ORDER BY created_at ASC",
        [clubId]
      );
      return rows.map(normalizeClubCoachRow);
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT * FROM club_coaches WHERE club_id = $1 ORDER BY created_at ASC", [clubId]);
      return res.rows.map(normalizeClubCoachRow);
    }
    return Array.from(memoryStore.clubCoaches.values())
      .filter((c) => c.club_id === clubId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
  },

  async addClubCoach(
    clubId: string,
    data: { name: string; title: string; mobile: string; notes: string }
  ): Promise<ClubCoachRecord> {
    const now = new Date();
    const rec: ClubCoachRecord = { id: crypto.randomUUID(), club_id: clubId, ...data, created_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        "INSERT INTO `club_coaches` (id, club_id, name, title, mobile, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [rec.id, clubId, rec.name, rec.title, rec.mobile, rec.notes, now]
      );
    } else if (pgPool) {
      await pgPool.query(
        "INSERT INTO club_coaches (id, club_id, name, title, mobile, notes, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [rec.id, clubId, rec.name, rec.title, rec.mobile, rec.notes, now]
      );
    }
    memoryStore.clubCoaches.set(rec.id, rec);
    return rec;
  },

  async updateClubCoach(
    id: string,
    data: { name: string; title: string; mobile: string; notes: string }
  ): Promise<ClubCoachRecord | null> {
    const list = Array.from(memoryStore.clubCoaches.values());
    let current = list.find((c) => c.id === id) || null;
    if (!current) {
      const all = mysqlPool || pgPool ? await (async () => {
        if (mysqlPool) {
          const [rows] = await mysqlPool.execute<RowDataPacket[]>("SELECT * FROM `club_coaches` WHERE id = ? LIMIT 1", [id]);
          return rows[0] ? normalizeClubCoachRow(rows[0]) : null;
        }
        const res = await pgPool!.query("SELECT * FROM club_coaches WHERE id = $1 LIMIT 1", [id]);
        return res.rows[0] ? normalizeClubCoachRow(res.rows[0]) : null;
      })() : null;
      current = all;
    }
    if (!current) return null;
    const updated = { ...current, ...data };
    if (mysqlPool) {
      await mysqlPool.execute("UPDATE `club_coaches` SET name=?, title=?, mobile=?, notes=? WHERE id=?", [
        updated.name, updated.title, updated.mobile, updated.notes, id,
      ]);
    } else if (pgPool) {
      await pgPool.query("UPDATE club_coaches SET name=$1, title=$2, mobile=$3, notes=$4 WHERE id=$5", [
        updated.name, updated.title, updated.mobile, updated.notes, id,
      ]);
    }
    memoryStore.clubCoaches.set(id, updated);
    return updated;
  },

  async deleteClubCoach(id: string): Promise<boolean> {
    if (mysqlPool) await mysqlPool.execute("DELETE FROM `club_coaches` WHERE id = ?", [id]);
    else if (pgPool) await pgPool.query("DELETE FROM club_coaches WHERE id = $1", [id]);
    memoryStore.clubCoaches.delete(id);
    return true;
  },

  async listClubTeamIds(clubId: string): Promise<string[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>("SELECT team_id FROM `club_teams` WHERE club_id = ?", [clubId]);
      return rows.map((r) => String(r.team_id));
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT team_id FROM club_teams WHERE club_id = $1", [clubId]);
      return res.rows.map((r) => String(r.team_id));
    }
    return Array.from(memoryStore.clubTeams.values()).filter((x) => x.club_id === clubId).map((x) => x.team_id);
  },

  async attachClubTeam(clubId: string, teamId: string): Promise<{ ok: true } | { error: string }> {
    const ids = await this.listClubTeamIds(clubId);
    if (ids.includes(teamId)) return { error: "این تیم قبلاً به باشگاه متصل شده است." };
    if (mysqlPool) await mysqlPool.execute("INSERT INTO `club_teams` (club_id, team_id) VALUES (?, ?)", [clubId, teamId]);
    else if (pgPool) await pgPool.query("INSERT INTO club_teams (club_id, team_id) VALUES ($1,$2)", [clubId, teamId]);
    memoryStore.clubTeams.set(`${clubId}:${teamId}`, { club_id: clubId, team_id: teamId });
    return { ok: true };
  },

  async detachClubTeam(clubId: string, teamId: string): Promise<boolean> {
    if (mysqlPool) await mysqlPool.execute("DELETE FROM `club_teams` WHERE club_id = ? AND team_id = ?", [clubId, teamId]);
    else if (pgPool) await pgPool.query("DELETE FROM club_teams WHERE club_id = $1 AND team_id = $2", [clubId, teamId]);
    memoryStore.clubTeams.delete(`${clubId}:${teamId}`);
    return true;
  },

  async listClubTournamentIds(clubId: string): Promise<string[]> {
    await initTablesIfRealDb();
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT tournament_id FROM `club_tournaments` WHERE club_id = ?",
        [clubId]
      );
      return rows.map((r) => String(r.tournament_id));
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT tournament_id FROM club_tournaments WHERE club_id = $1", [clubId]);
      return res.rows.map((r) => String(r.tournament_id));
    }
    return Array.from(memoryStore.clubTournaments.values()).filter((x) => x.club_id === clubId).map((x) => x.tournament_id);
  },

  async attachClubTournament(clubId: string, tournamentId: string): Promise<{ ok: true } | { error: string }> {
    const ids = await this.listClubTournamentIds(clubId);
    if (ids.includes(tournamentId)) return { error: "این مسابقه قبلاً به باشگاه متصل شده است." };
    if (mysqlPool) {
      await mysqlPool.execute("INSERT INTO `club_tournaments` (club_id, tournament_id) VALUES (?, ?)", [clubId, tournamentId]);
    } else if (pgPool) {
      await pgPool.query("INSERT INTO club_tournaments (club_id, tournament_id) VALUES ($1,$2)", [clubId, tournamentId]);
    }
    memoryStore.clubTournaments.set(`${clubId}:${tournamentId}`, { club_id: clubId, tournament_id: tournamentId });
    return { ok: true };
  },

  async detachClubTournament(clubId: string, tournamentId: string): Promise<boolean> {
    if (mysqlPool) {
      await mysqlPool.execute("DELETE FROM `club_tournaments` WHERE club_id = ? AND tournament_id = ?", [clubId, tournamentId]);
    } else if (pgPool) {
      await pgPool.query("DELETE FROM club_tournaments WHERE club_id = $1 AND tournament_id = $2", [clubId, tournamentId]);
    }
    memoryStore.clubTournaments.delete(`${clubId}:${tournamentId}`);
    return true;
  },

  async setTeamPublic(id: string, isPublic: boolean): Promise<TeamRecord | null> {
    const existing = await this.getTeam(id);
    if (!existing) return null;
    const now = new Date();
    const flag = Boolean(isPublic);
    if (mysqlPool) {
      await mysqlPool.execute("UPDATE `teams` SET is_public = ?, updated_at = ? WHERE id = ?", [flag ? 1 : 0, now, id]);
    } else if (pgPool) {
      await pgPool.query("UPDATE teams SET is_public = $1, updated_at = $2 WHERE id = $3", [flag, now, id]);
    }
    const updated = { ...existing, is_public: flag, updated_at: now };
    memoryStore.teams.set(id, updated);
    return updated;
  },

  async isTeamPubliclyVisible(teamId: string): Promise<boolean> {
    const team = await this.getTeam(teamId);
    if (!team) return false;
    if (team.is_public) return true;
    const clubIds = await this.listClubIdsForTeam(teamId);
    for (const cid of clubIds) {
      const club = await this.getClub(cid);
      if (club?.page_paid) return true;
    }
    return false;
  },

  async listPublicClubs(query = "", limit = 40): Promise<ClubRecord[]> {
    await initTablesIfRealDb();
    const q = query.trim();
    const cap = Math.min(80, Math.max(1, limit));
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `clubs` WHERE page_paid = 1 ORDER BY updated_at DESC LIMIT 120"
      );
      return rows.map(normalizeClubRow).filter((c) => clubMatchesQuery(c, q)).slice(0, cap);
    }
    if (pgPool) {
      const res = await pgPool.query("SELECT * FROM clubs WHERE page_paid = TRUE ORDER BY updated_at DESC LIMIT 120");
      return res.rows.map(normalizeClubRow).filter((c) => clubMatchesQuery(c, q)).slice(0, cap);
    }
    return Array.from(memoryStore.clubs.values())
      .filter((c) => c.page_paid)
      .filter((c) => clubMatchesQuery(c, q))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .slice(0, cap);
  },

  async listPublicTeams(query = "", limit = 40): Promise<TeamRecord[]> {
    await initTablesIfRealDb();
    const q = query.trim();
    const cap = Math.min(80, Math.max(1, limit));
    let teams: TeamRecord[] = [];
    if (mysqlPool) {
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT t.*, (SELECT COUNT(*) FROM \`players\` p WHERE p.team_id = t.id) AS player_count
         FROM \`teams\` t
         WHERE t.is_public = 1
            OR t.id IN (
              SELECT ct.team_id FROM \`club_teams\` ct
              INNER JOIN \`clubs\` c ON c.id = ct.club_id
              WHERE c.page_paid = 1
            )
         ORDER BY t.updated_at DESC LIMIT 200`
      );
      teams = rows.map(normalizeTeamRow);
    } else if (pgPool) {
      const res = await pgPool.query(
        `SELECT t.*, (SELECT COUNT(*)::int FROM players p WHERE p.team_id = t.id) AS player_count
         FROM teams t
         WHERE t.is_public = TRUE
            OR t.id IN (
              SELECT ct.team_id FROM club_teams ct
              INNER JOIN clubs c ON c.id = ct.club_id
              WHERE c.page_paid = TRUE
            )
         ORDER BY t.updated_at DESC LIMIT 200`
      );
      teams = res.rows.map(normalizeTeamRow);
    } else {
      const paidClubIds = new Set(
        Array.from(memoryStore.clubs.values()).filter((c) => c.page_paid).map((c) => c.id)
      );
      const publicTeamIds = new Set<string>();
      for (const x of memoryStore.clubTeams.values()) {
        if (paidClubIds.has(x.club_id)) publicTeamIds.add(x.team_id);
      }
      teams = Array.from(memoryStore.teams.values())
        .filter((t) => t.is_public || publicTeamIds.has(t.id))
        .map((t) => ({
          ...t,
          player_count: Array.from(memoryStore.players.values()).filter((p) => p.team_id === t.id).length,
        }));
    }
    return teams.filter((t) => teamMatchesQuery(t, q)).slice(0, cap);
  },

  async listPublicTournaments(query = "", limit = 40): Promise<
    { id: string; title: string; format: string; sport: string | null; team_count: number; updated_at: Date }[]
  > {
    await initTablesIfRealDb();
    const q = query.trim();
    const cap = Math.min(80, Math.max(1, limit));
    const parseState = (raw: any) => {
      if (!raw) return {};
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      }
      return raw;
    };
    let rows: any[] = [];
    if (mysqlPool) {
      const [r] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT id, title, format, sport, team_count, state, updated_at FROM `tournaments` ORDER BY updated_at DESC LIMIT 300"
      );
      rows = r;
    } else if (pgPool) {
      const res = await pgPool.query(
        "SELECT id, title, format, sport, team_count, state, updated_at FROM tournaments ORDER BY updated_at DESC LIMIT 300"
      );
      rows = res.rows;
    } else {
      rows = Array.from(memoryStore.tournaments.values());
    }
    const out = [];
    for (const row of rows) {
      const state = parseState(row.state);
      if (!state?.payment?.isPaid) continue;
      const item = {
        id: String(row.id),
        title: String(row.title || ""),
        format: String(row.format || ""),
        sport: row.sport || null,
        team_count: Number(row.team_count || 0),
        updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      };
      if (q) {
        const hay = `${item.title} ${item.sport || ""} ${item.format}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }
      out.push(item);
      if (out.length >= cap) break;
    }
    return out;
  },

  async searchPublicPlayers(query = "", limit = 40): Promise<
    { id: string; team_id: string; name: string; jersey_number: string; position: string; status: string; team_name: string }[]
  > {
    const teams = await this.listPublicTeams("", 120);
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const q = query.trim().toLowerCase();
    const cap = Math.min(80, Math.max(1, limit));
    const out: {
      id: string;
      team_id: string;
      name: string;
      jersey_number: string;
      position: string;
      status: string;
      team_name: string;
    }[] = [];
    for (const team of teams) {
      const players = await this.listPlayers(team.id);
      for (const p of players) {
        if (q && !`${p.name} ${p.position} ${team.name}`.toLowerCase().includes(q)) continue;
        out.push({
          id: p.id,
          team_id: p.team_id,
          name: p.name,
          jersey_number: p.jersey_number || "",
          position: p.position || "",
          status: p.status || "active",
          team_name: teamMap.get(p.team_id)?.name || team.name,
        });
        if (out.length >= cap) return out;
      }
    }
    return out;
  },

  async followTournament(userId: string, tournamentId: string): Promise<{ ok: true } | { error: string }> {
    if (!userId || !tournamentId) return { error: "شناسه نامعتبر است." };
    const existing = await this.isFollowingTournament(userId, tournamentId);
    if (existing) return { ok: true };
    const now = new Date();
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        await mysqlPool.execute(
          "INSERT INTO `tournament_follows` (user_id, tournament_id, created_at) VALUES (?, ?, ?)",
          [userId, tournamentId, now]
        );
      } else if (pgPool) {
        await initTablesIfRealDb();
        await pgPool.query(
          "INSERT INTO tournament_follows (user_id, tournament_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [userId, tournamentId, now]
        );
      }
    } catch (err) {
      console.warn("[NexSport DB] followTournament:", err);
    }
    memoryStore.follows.set(`${userId}:${tournamentId}`, { user_id: userId, tournament_id: tournamentId, created_at: now });
    return { ok: true };
  },

  async unfollowTournament(userId: string, tournamentId: string): Promise<boolean> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `tournament_follows` WHERE user_id = ? AND tournament_id = ?", [
        userId,
        tournamentId,
      ]);
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM tournament_follows WHERE user_id = $1 AND tournament_id = $2", [
        userId,
        tournamentId,
      ]);
    }
    memoryStore.follows.delete(`${userId}:${tournamentId}`);
    return true;
  },

  async isFollowingTournament(userId: string, tournamentId: string): Promise<boolean> {
    if (!userId || !tournamentId) return false;
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT user_id FROM `tournament_follows` WHERE user_id = ? AND tournament_id = ? LIMIT 1",
        [userId, tournamentId]
      );
      return Boolean(rows[0]);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT user_id FROM tournament_follows WHERE user_id = $1 AND tournament_id = $2 LIMIT 1",
        [userId, tournamentId]
      );
      return Boolean(res.rows[0]);
    }
    return memoryStore.follows.has(`${userId}:${tournamentId}`);
  },

  async listTournamentFollowerIds(tournamentId: string): Promise<string[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT user_id FROM `tournament_follows` WHERE tournament_id = ?",
        [tournamentId]
      );
      return rows.map((r) => String(r.user_id));
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query("SELECT user_id FROM tournament_follows WHERE tournament_id = $1", [tournamentId]);
      return res.rows.map((r) => String(r.user_id));
    }
    return Array.from(memoryStore.follows.values())
      .filter((f) => f.tournament_id === tournamentId)
      .map((f) => f.user_id);
  },

  async listFollowedTournaments(userId: string): Promise<string[]> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT tournament_id FROM `tournament_follows` WHERE user_id = ? ORDER BY created_at DESC",
        [userId]
      );
      return rows.map((r) => String(r.tournament_id));
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT tournament_id FROM tournament_follows WHERE user_id = $1 ORDER BY created_at DESC",
        [userId]
      );
      return res.rows.map((r) => String(r.tournament_id));
    }
    return Array.from(memoryStore.follows.values())
      .filter((f) => f.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .map((f) => f.tournament_id);
  },

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date();
    const rec = {
      id,
      user_id: data.userId,
      type: data.type || "info",
      title: String(data.title || "").slice(0, 200),
      body: String(data.body || "").slice(0, 800),
      link: String(data.link || "").slice(0, 200),
      is_read: false,
      created_at: now,
    };
    try {
      if (mysqlPool) {
        await initTablesIfRealDb();
        await mysqlPool.execute(
          "INSERT INTO `notifications` (id, user_id, type, title, body, link, is_read, created_at) VALUES (?,?,?,?,?,?,0,?)",
          [rec.id, rec.user_id, rec.type, rec.title, rec.body, rec.link, now]
        );
      } else if (pgPool) {
        await initTablesIfRealDb();
        await pgPool.query(
          "INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7)",
          [rec.id, rec.user_id, rec.type, rec.title, rec.body, rec.link, now]
        );
      }
    } catch (err) {
      console.warn("[NexSport DB] createNotification:", err);
    }
    memoryStore.notifications.set(id, rec);
  },

  async broadcastNotification(data: { title: string; body?: string; link?: string }): Promise<number> {
    const users = await this.listAllUsers();
    let sent = 0;
    for (const u of users) {
      await this.createNotification({
        userId: u.id,
        type: "broadcast",
        title: data.title,
        body: data.body,
        link: data.link,
      });
      sent += 1;
    }
    return sent;
  },

  async notifyTournamentFollowers(tournamentId: string, title: string, body: string): Promise<number> {
    const ids = await this.listTournamentFollowerIds(tournamentId);
    const link = `/t/${tournamentId}`;
    const cutoff = Date.now() - 15 * 60 * 1000;
    let sent = 0;
    for (const userId of ids) {
      const recent = await this.listNotifications(userId, 8);
      const dup = recent.find(
        (n) => n.link === link && n.type === "result" && n.created_at.getTime() > cutoff
      );
      if (dup) continue;
      await this.createNotification({ userId, type: "result", title, body, link });
      sent += 1;
    }
    return sent;
  },

  async listNotifications(userId: string, limit = 30): Promise<{
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string;
    link: string;
    is_read: boolean;
    created_at: Date;
  }[]> {
    const cap = Math.min(80, Math.max(1, limit));
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `notifications` WHERE user_id = ? ORDER BY created_at DESC LIMIT 80",
        [userId]
      );
      return rows.map(normalizeNotificationRow).slice(0, cap);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 80",
        [userId]
      );
      return res.rows.map(normalizeNotificationRow).slice(0, cap);
    }
    return Array.from(memoryStore.notifications.values())
      .filter((n) => n.user_id === userId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, cap);
  },

  async countUnreadNotifications(userId: string): Promise<number> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `notifications` WHERE user_id = ? AND is_read = 0",
        [userId]
      );
      return Number(rows[0]?.c || 0);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        [userId]
      );
      return Number(res.rows[0]?.c || 0);
    }
    return Array.from(memoryStore.notifications.values()).filter((n) => n.user_id === userId && !n.is_read).length;
  },

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      if (ids && ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        await mysqlPool.execute(
          `UPDATE \`notifications\` SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
          [userId, ...ids]
        );
      } else {
        await mysqlPool.execute("UPDATE `notifications` SET is_read = 1 WHERE user_id = ?", [userId]);
      }
    } else if (pgPool) {
      await initTablesIfRealDb();
      if (ids && ids.length) {
        await pgPool.query(
          "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2::varchar[])",
          [userId, ids]
        );
      } else {
        await pgPool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1", [userId]);
      }
    }
    for (const n of memoryStore.notifications.values()) {
      if (n.user_id !== userId) continue;
      if (!ids || ids.includes(n.id)) n.is_read = true;
    }
  },

  async createServiceListing(userId: string, data: {
    category: string;
    title: string;
    body: string;
    city: string;
    sport: string;
    contact_name: string;
    mobile: string;
    is_active?: boolean;
  }) {
    const id = crypto.randomUUID();
    const now = new Date();
    const rec = {
      id,
      user_id: userId,
      category: data.category,
      title: data.title,
      body: data.body,
      city: data.city || "",
      sport: data.sport || "",
      contact_name: data.contact_name || "",
      mobile: data.mobile || "",
      is_active: data.is_active !== false,
      created_at: now,
      updated_at: now,
    };
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`service_listings\` (id, user_id, category, title, body, city, sport, contact_name, mobile, is_active, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, userId, rec.category, rec.title, rec.body, rec.city, rec.sport, rec.contact_name, rec.mobile, rec.is_active ? 1 : 0, now, now]
      );
    } else if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO service_listings (id, user_id, category, title, body, city, sport, contact_name, mobile, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, userId, rec.category, rec.title, rec.body, rec.city, rec.sport, rec.contact_name, rec.mobile, rec.is_active, now, now]
      );
    }
    memoryStore.serviceListings.set(id, rec);
    return rec;
  },

  async updateServiceListing(
    id: string,
    userId: string,
    patch: Partial<{
      category: string;
      title: string;
      body: string;
      city: string;
      sport: string;
      contact_name: string;
      mobile: string;
      is_active: boolean;
    }>,
    isAdmin = false
  ) {
    const existing = await this.getServiceListing(id);
    if (!existing) return null;
    if (existing.user_id !== userId && !isAdmin) return null;
    const now = new Date();
    const updated = { ...existing, ...patch, updated_at: now };
    if (mysqlPool) {
      await mysqlPool.execute(
        `UPDATE \`service_listings\` SET category=?, title=?, body=?, city=?, sport=?, contact_name=?, mobile=?, is_active=?, updated_at=? WHERE id=?`,
        [
          updated.category,
          updated.title,
          updated.body,
          updated.city,
          updated.sport,
          updated.contact_name,
          updated.mobile,
          updated.is_active ? 1 : 0,
          now,
          id,
        ]
      );
    } else if (pgPool) {
      await pgPool.query(
        `UPDATE service_listings SET category=$1, title=$2, body=$3, city=$4, sport=$5, contact_name=$6, mobile=$7, is_active=$8, updated_at=$9 WHERE id=$10`,
        [
          updated.category,
          updated.title,
          updated.body,
          updated.city,
          updated.sport,
          updated.contact_name,
          updated.mobile,
          updated.is_active,
          now,
          id,
        ]
      );
    }
    memoryStore.serviceListings.set(id, updated);
    return updated;
  },

  async getServiceListing(id: string) {
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.*, u.name AS owner_name FROM \`service_listings\` s LEFT JOIN \`users\` u ON u.id = s.user_id WHERE s.id = ? LIMIT 1`,
        [id]
      );
      return rows[0] ? normalizeServiceRow(rows[0]) : null;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `SELECT s.*, u.name AS owner_name FROM service_listings s LEFT JOIN users u ON u.id = s.user_id WHERE s.id = $1 LIMIT 1`,
        [id]
      );
      return res.rows[0] ? normalizeServiceRow(res.rows[0]) : null;
    }
    const rec = memoryStore.serviceListings.get(id);
    if (!rec) return null;
    const owner = memoryStore.users.get(rec.user_id);
    return { ...rec, owner_name: owner?.name || "" };
  },

  async listServiceListings(opts: { query?: string; category?: string; userId?: string; includeInactive?: boolean; limit?: number } = {}) {
    await initTablesIfRealDb();
    const q = (opts.query || "").trim().toLowerCase();
    const cap = Math.min(80, Math.max(1, opts.limit || 40));
    let rows: any[] = [];
    if (mysqlPool) {
      const [r] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.*, u.name AS owner_name FROM \`service_listings\` s LEFT JOIN \`users\` u ON u.id = s.user_id ORDER BY s.updated_at DESC LIMIT 200`
      );
      rows = r;
    } else if (pgPool) {
      const res = await pgPool.query(
        `SELECT s.*, u.name AS owner_name FROM service_listings s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.updated_at DESC LIMIT 200`
      );
      rows = res.rows;
    } else {
      rows = Array.from(memoryStore.serviceListings.values()).map((s) => ({
        ...s,
        owner_name: memoryStore.users.get(s.user_id)?.name || "",
      }));
    }
    return rows
      .map(normalizeServiceRow)
      .filter((s) => {
        if (opts.userId && s.user_id !== opts.userId) return false;
        if (!opts.includeInactive && !s.is_active) return false;
        if (opts.category && s.category !== opts.category) return false;
        if (q && !`${s.title} ${s.body} ${s.city} ${s.sport} ${s.contact_name}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, cap);
  },

  async countActiveServiceListings(userId: string): Promise<number> {
    const rows = await this.listServiceListings({ userId, includeInactive: false, limit: 80 });
    return rows.length;
  },

  async activateServiceListing(id: string) {
    const existing = await this.getServiceListing(id);
    if (!existing) return null;
    return this.updateServiceListing(id, existing.user_id, { is_active: true }, true);
  },

  async grantCommunityPromo(kind: string, targetId: string, userId: string, days: number) {
    await initTablesIfRealDb();
    const now = Date.now();
    const current = await this.getActiveCommunityPromo(kind, targetId);
    const base = current && current.expires_at.getTime() > now ? current.expires_at.getTime() : now;
    const expires = new Date(base + Math.max(1, days) * 24 * 60 * 60 * 1000);
    if (current) {
      if (mysqlPool) {
        await mysqlPool.execute("UPDATE `community_promos` SET expires_at = ? WHERE id = ?", [expires, current.id]);
      } else if (pgPool) {
        await pgPool.query("UPDATE community_promos SET expires_at = $1 WHERE id = $2", [expires, current.id]);
      }
      const updated = { ...current, expires_at: expires };
      memoryStore.communityPromos.set(current.id, updated);
      return updated;
    }
    const rec = {
      id: crypto.randomUUID(),
      kind,
      target_id: targetId,
      user_id: userId,
      expires_at: expires,
      created_at: new Date(),
    };
    if (mysqlPool) {
      await mysqlPool.execute(
        "INSERT INTO `community_promos` (id, kind, target_id, user_id, expires_at, created_at) VALUES (?,?,?,?,?,?)",
        [rec.id, rec.kind, rec.target_id, rec.user_id, rec.expires_at, rec.created_at]
      );
    } else if (pgPool) {
      await pgPool.query(
        "INSERT INTO community_promos (id, kind, target_id, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [rec.id, rec.kind, rec.target_id, rec.user_id, rec.expires_at, rec.created_at]
      );
    }
    memoryStore.communityPromos.set(rec.id, rec);
    return rec;
  },

  async getActiveCommunityPromo(kind: string, targetId: string) {
    const now = new Date();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `community_promos` WHERE kind = ? AND target_id = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1",
        [kind, targetId, now]
      );
      return rows[0] ? normalizePromoRow(rows[0]) : null;
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM community_promos WHERE kind = $1 AND target_id = $2 AND expires_at > $3 ORDER BY expires_at DESC LIMIT 1",
        [kind, targetId, now]
      );
      return res.rows[0] ? normalizePromoRow(res.rows[0]) : null;
    }
    return (
      Array.from(memoryStore.communityPromos.values())
        .filter((p) => p.kind === kind && p.target_id === targetId && p.expires_at.getTime() > now.getTime())
        .sort((a, b) => b.expires_at.getTime() - a.expires_at.getTime())[0] || null
    );
  },

  async listActiveCommunityPromos(kind?: string) {
    const now = new Date();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = kind
        ? await mysqlPool.execute<RowDataPacket[]>(
            "SELECT * FROM `community_promos` WHERE kind = ? AND expires_at > ? ORDER BY expires_at DESC",
            [kind, now]
          )
        : await mysqlPool.execute<RowDataPacket[]>(
            "SELECT * FROM `community_promos` WHERE expires_at > ? ORDER BY expires_at DESC",
            [now]
          );
      return rows.map(normalizePromoRow);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = kind
        ? await pgPool.query("SELECT * FROM community_promos WHERE kind = $1 AND expires_at > $2 ORDER BY expires_at DESC", [
            kind,
            now,
          ])
        : await pgPool.query("SELECT * FROM community_promos WHERE expires_at > $1 ORDER BY expires_at DESC", [now]);
      return res.rows.map(normalizePromoRow);
    }
    return Array.from(memoryStore.communityPromos.values()).filter(
      (p) => (!kind || p.kind === kind) && p.expires_at.getTime() > now.getTime()
    );
  },

  async countCommunityPromosThisMonth(userId: string, kind: string): Promise<number> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM `community_promos` WHERE user_id = ? AND kind = ? AND created_at >= ?",
        [userId, kind, start]
      );
      return Number(rows[0]?.c || 0);
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT COUNT(*)::int AS c FROM community_promos WHERE user_id = $1 AND kind = $2 AND created_at >= $3",
        [userId, kind, start]
      );
      return Number(res.rows[0]?.c || 0);
    }
    return Array.from(memoryStore.communityPromos.values()).filter(
      (p) => p.user_id === userId && p.kind === kind && p.created_at.getTime() >= start.getTime()
    ).length;
  },

};


function clubMatchesQuery(c: ClubRecord, q: string) {
  if (!q) return true;
  const hay = `${c.name} ${c.city} ${c.sport} ${c.short_name}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function teamMatchesQuery(t: TeamRecord, q: string) {
  if (!q) return true;
  const hay = `${t.name} ${t.city} ${t.sport} ${t.coach} ${t.short_name}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

function normalizePromoRow(row: any) {
  return {
    id: row.id,
    kind: String(row.kind || ""),
    target_id: String(row.target_id || ""),
    user_id: String(row.user_id || ""),
    expires_at: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function normalizeNotificationRow(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type || "info",
    title: row.title || "",
    body: row.body || "",
    link: row.link || "",
    is_read: Boolean(row.is_read),
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function normalizeServiceRow(row: any) {
  return {
    id: row.id,
    user_id: row.user_id,
    category: row.category,
    title: row.title || "",
    body: row.body || "",
    city: row.city || "",
    sport: row.sport || "",
    contact_name: row.contact_name || "",
    mobile: row.mobile || "",
    is_active: Boolean(row.is_active),
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    owner_name: row.owner_name || "",
  };
}

function normalizeTeamRow(row: any): TeamRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    short_name: row.short_name || "",
    sport: row.sport || "فوتبال",
    city: row.city || "",
    founded_year: row.founded_year || "",
    kit_home: row.kit_home || "",
    kit_away: row.kit_away || "",
    coach: row.coach || "",
    description: row.description || "",
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    player_count: Number(row.player_count || 0),
    owner_name: row.owner_name,
    owner_email: row.owner_email,
    is_public: Boolean(row.is_public),
  };
}

function normalizePlayerRow(row: any): PlayerRecord {
  return {
    id: row.id,
    team_id: row.team_id,
    name: row.name,
    jersey_number: row.jersey_number || "",
    position: row.position || "",
    birth_date: row.birth_date || "",
    mobile: row.mobile || "",
    national_id: row.national_id || "",
    status: row.status || "active",
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function parseRoster(raw: any): RegistrationPlayerSnapshot[] {
  if (!raw) return [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  return data.map((p) => ({
    name: String(p?.name || "").trim(),
    jersey_number: String(p?.jersey_number || ""),
    position: String(p?.position || ""),
    birth_date: String(p?.birth_date || ""),
    mobile: String(p?.mobile || ""),
    national_id: String(p?.national_id || ""),
  }));
}

function normalizeRegistrationRow(row: any): RegistrationRecord {
  const statusRaw = String(row.status || "pending");
  const status: RegistrationStatus =
    statusRaw === "approved" || statusRaw === "rejected" ? statusRaw : "pending";
  return {
    id: row.id,
    tournament_id: row.tournament_id,
    team_name: row.team_name,
    short_name: row.short_name || "",
    city: row.city || "",
    coach: row.coach || "",
    contact_name: row.contact_name || "",
    mobile: row.mobile || "",
    notes: row.notes || "",
    status,
    library_team_id: row.library_team_id || "",
    reject_reason: row.reject_reason || "",
    roster: parseRoster(row.roster),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function normalizeClubRow(row: any): ClubRecord {
  const roleRaw = String(row.my_role || "");
  const my_role: ClubMemberRole | undefined =
    roleRaw === "owner" || roleRaw === "manager" || roleRaw === "coach" || roleRaw === "member" ? roleRaw : undefined;
  const statusRaw = String(row.my_status || "");
  const my_status: ClubMemberStatus | undefined =
    statusRaw === "pending" || statusRaw === "active" ? statusRaw : undefined;
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    short_name: row.short_name || "",
    sport: row.sport || "فوتبال",
    city: row.city || "",
    founded_year: row.founded_year || "",
    venue: row.venue || "",
    description: row.description || "",
    contact_name: row.contact_name || "",
    mobile: row.mobile || "",
    page_paid: Boolean(row.page_paid),
    page_paid_at: row.page_paid_at ? new Date(row.page_paid_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    my_role,
    my_status,
  };
}

function normalizeClubMemberRow(row: any): ClubMemberRecord {
  const roleRaw = String(row.role || "member");
  const role: ClubMemberRole =
    roleRaw === "owner" || roleRaw === "manager" || roleRaw === "coach" || roleRaw === "member" ? roleRaw : "member";
  const status: ClubMemberStatus = String(row.status) === "active" ? "active" : "pending";
  return {
    id: row.id,
    club_id: row.club_id,
    user_id: row.user_id,
    role,
    status,
    created_at: new Date(row.created_at),
    name: row.name || "",
    email: row.email || "",
    mobile: row.mobile || "",
  };
}

function normalizeClubCoachRow(row: any): ClubCoachRecord {
  return {
    id: row.id,
    club_id: row.club_id,
    name: row.name,
    title: row.title || "",
    mobile: row.mobile || "",
    notes: row.notes || "",
    created_at: new Date(row.created_at),
  };
}
