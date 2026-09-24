import { Pool as PgPool } from "pg";
import mysql, { Pool as MySqlPool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import crypto from "crypto";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  mobile: string;
  password_hash: string;
  is_verified: boolean;
  role: string;
  created_at: Date;
  updated_at: Date;
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
}

export interface PasswordResetRecord {
  id: string;
  user_id: string;
  email: string;
  code: string;
  expires_at: Date;
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

if (isMySql) {
  try {
    if (connectionString && (connectionString.startsWith("mysql://") || connectionString.startsWith("mysql2://"))) {
      mysqlPool = mysql.createPool(connectionString);
    } else if (mysqlDatabase && mysqlUser) {
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
};

function normalizeUserRow(row: any): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    password_hash: row.password_hash,
    is_verified: Boolean(row.is_verified),
    role: row.role || "user",
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
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
      `);
      tablesInitialized = true;
    } catch (err) {
      console.warn("[NexSport DB] Postgres table init warning:", err);
    }
  }
}

export const db = {
  isConfigured: Boolean(mysqlPool || pgPool),
  driver: mysqlPool ? "mysql" : pgPool ? "postgres" : "memory",

  async findUserByEmail(email: string): Promise<UserRecord | null> {
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
      if (u.email.toLowerCase() === cleanEmail) return u;
    }
    return null;
  },

  async findUserByMobile(mobile: string): Promise<UserRecord | null> {
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
      if (u.mobile === cleanMobile) return u;
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
    return memoryStore.users.get(id) || null;
  },

  async createUser(data: {
    name: string;
    email: string;
    mobile: string;
    password_hash: string;
    is_verified?: boolean;
    role?: string;
  }): Promise<UserRecord> {
    const id = crypto.randomUUID();
    const now = new Date();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.trim();
    const role = data.role ?? "user";
    const isVerified = Boolean(data.is_verified);

    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute(
        `INSERT INTO \`users\` (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.name.trim(), cleanEmail, cleanMobile, data.password_hash, isVerified ? 1 : 0, role, now, now]
      );
      return {
        id,
        name: data.name.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        password_hash: data.password_hash,
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
          data.password_hash,
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
      password_hash: data.password_hash,
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
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

    if (mysqlPool) {
      await initTablesIfRealDb();
      try {
        await mysqlPool.execute(
          `INSERT INTO \`sessions\` (id, user_id, device_type, expires_at, last_active_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [token, userId, deviceType, expiresAt, now, now]
        );
      } catch {
        await mysqlPool.query("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'").catch(() => {});
        await mysqlPool.execute(
          `INSERT INTO \`sessions\` (id, user_id, device_type, expires_at, last_active_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [token, userId, deviceType, expiresAt, now, now]
        ).catch(async () => {
          await mysqlPool!.execute(
            `INSERT INTO \`sessions\` (id, user_id, expires_at, last_active_at, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [token, userId, expiresAt, now, now]
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
        [token, userId, deviceType, expiresAt, now, now]
      );
      await pgPool.query("UPDATE users SET updated_at = $1 WHERE id = $2", [now, userId]).catch(() => {});
      return token;
    }

    memoryStore.sessions.set(token, {
      id: token,
      user_id: userId,
      device_type: deviceType,
      expires_at: expiresAt,
      last_active_at: now,
      created_at: now,
    });
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

    if (mysqlPool) {
      await initTablesIfRealDb();
      const [rows] = await mysqlPool.execute<RowDataPacket[]>(
        "SELECT * FROM `sessions` WHERE id = ? AND expires_at > ? LIMIT 1",
        [token, now]
      );
      const session = rows[0];
      if (session) {
        mysqlPool.execute(
          "UPDATE `sessions` SET expires_at = ?, last_active_at = ? WHERE id = ?",
          [rollingExpiresAt, now, token]
        ).catch(() => {});
        mysqlPool.execute("UPDATE `users` SET updated_at = ? WHERE id = ?", [now, session.user_id]).catch(() => {});
        return {
          id: session.id,
          user_id: session.user_id,
          expires_at: rollingExpiresAt,
          last_active_at: now,
          created_at: new Date(session.created_at),
        };
      }
      return null;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      const res = await pgPool.query(
        "SELECT * FROM sessions WHERE id = $1 AND expires_at > $2 LIMIT 1",
        [token, now]
      );
      const session = res.rows[0];
      if (session) {
        pgPool.query(
          "UPDATE sessions SET expires_at = $1, last_active_at = $2 WHERE id = $3",
          [rollingExpiresAt, now, token]
        ).catch(() => {});
        pgPool.query("UPDATE users SET updated_at = $1 WHERE id = $2", [now, session.user_id]).catch(() => {});
        session.expires_at = rollingExpiresAt;
        session.last_active_at = now;
        return session;
      }
      return null;
    }

    const s = memoryStore.sessions.get(token);
    if (s && s.expires_at > now) {
      s.expires_at = rollingExpiresAt;
      s.last_active_at = now;
      return s;
    }
    return null;
  },

  async deleteSession(token: string): Promise<void> {
    if (mysqlPool) {
      await initTablesIfRealDb();
      await mysqlPool.execute("DELETE FROM `sessions` WHERE id = ?", [token]);
      return;
    }

    if (pgPool) {
      await initTablesIfRealDb();
      await pgPool.query("DELETE FROM sessions WHERE id = $1", [token]);
      return;
    }
    memoryStore.sessions.delete(token);
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
    const id = data.id || crypto.randomUUID();
    const now = new Date();
    const title = data.title.trim();
    const format = data.format;
    const sport = data.sport || null;
    const teamCount = data.teamCount;
    const stateJson = JSON.stringify(data.state);

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
        state: data.state,
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
      state: data.state,
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
};
