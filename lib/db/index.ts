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
          \`applies_to\` VARCHAR(20) DEFAULT 'all',
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
          applies_to VARCHAR(20) DEFAULT 'all',
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
        "SELECT id, name, email, mobile, is_verified, role, planning_credits, free_link_used, vip_expires_at, created_at, updated_at FROM `users` ORDER BY created_at DESC"
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
        "SELECT id, name, email, mobile, is_verified, role, planning_credits, free_link_used, vip_expires_at, created_at, updated_at FROM users ORDER BY created_at DESC"
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

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`users\` (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name.trim(), cleanEmail, cleanMobile, passwordHash, isVerified ? 1 : 0, role, now, now]
      );
      return {
        id,
        name: data.name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password_hash: passwordHash,
        is_verified: isVerified,
        role,
        created_at: now,
        updated_at: now,
      };
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        `INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          data.name.trim(),
          cleanEmail,
          cleanMobile,
          passwordHash,
          isVerified,
          role,
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
    if (data.id && (!mergedState || !mergedState.payment)) {
      try {
        const existing = await this.getTournament(data.id, data.userId);
        if (existing?.state?.payment) {
          mergedState = {
            ...mergedState,
            payment: existing.state.payment,
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

  async getGuestUsage(ip: string): Promise<{ ip: string; count: number; remaining: number }> {
    const cleanIp = (ip || "127.0.0.1").trim();
    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT ip, count FROM `guest_usage` WHERE ip = ? LIMIT 1",
        [cleanIp]
      );
      const count = rows[0]?.count ? Number(rows[0].count) : 0;
      return { ip: cleanIp, count, remaining: Math.max(0, 2 - count) };
    }
    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT ip, count FROM guest_usage WHERE ip = $1 LIMIT 1",
        [cleanIp]
      );
      const count = res.rows[0]?.count ? Number(res.rows[0].count) : 0;
      return { ip: cleanIp, count, remaining: Math.max(0, 2 - count) };
    }
    const record = memoryStore.guestUsage.get(cleanIp);
    const count = record ? record.count : 0;
    return { ip: cleanIp, count, remaining: Math.max(0, 2 - count) };
  },

  async recordGuestUsage(ip: string): Promise<{ success: boolean; count: number; remaining: number }> {
    const cleanIp = (ip || "127.0.0.1").trim();
    const current = await this.getGuestUsage(cleanIp);
    if (current.count >= 2) {
      return { success: false, count: current.count, remaining: 0 };
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
      return { success: true, count: newCount, remaining: Math.max(0, 2 - newCount) };
    }
    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query(
        `INSERT INTO guest_usage (ip, count, last_used_at, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ip) DO UPDATE SET count = $2, last_used_at = $3`,
        [cleanIp, newCount, now, now]
      );
      return { success: true, count: newCount, remaining: Math.max(0, 2 - newCount) };
    }
    memoryStore.guestUsage.set(cleanIp, { ip: cleanIp, count: newCount, last_used_at: now, created_at: now });
    return { success: true, count: newCount, remaining: Math.max(0, 2 - newCount) };
  },

  async getUserQuota(userId: string): Promise<{
    isVip: boolean;
    vipExpiresAt: Date | null;
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
        planningCredits: 0,
        freeLinkAvailable: false,
        unlimitedPlanning: false,
        role: "guest",
      };
    }
    const isVip = Boolean(
      user.vip_expires_at && new Date(user.vip_expires_at).getTime() > Date.now()
    );
    const unlimitedPlanning = isVip || hasUnlimitedPlanning(user);
    return {
      isVip,
      vipExpiresAt: user.vip_expires_at || null,
      planningCredits: unlimitedPlanning
        ? 999999
        : user.planning_credits !== undefined
        ? Number(user.planning_credits)
        : 5,
      freeLinkAvailable: !user.free_link_used,
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
    const currentCredits = user.planning_credits !== undefined ? Number(user.planning_credits) : 5;
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
        : 5;
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
    const appliesTo = data.appliesTo || "all";
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
};

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
