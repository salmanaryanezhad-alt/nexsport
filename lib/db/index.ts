import { Pool } from "pg";
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
  expires_at: Date;
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

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

let pool: Pool | null = null;
let tablesInitialized = false;

if (connectionString) {
  const isLocalhost =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  pool = new Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

// In-memory fallback store when no database connection is configured
const memoryStore = {
  users: new Map<string, UserRecord>(),
  verifications: new Map<string, EmailVerificationRecord>(),
  sessions: new Map<string, SessionRecord>(),
  passwordResets: new Map<string, PasswordResetRecord>(),
  tournaments: new Map<string, TournamentRecord>(),
};

async function initTablesIfRealDb() {
  if (!pool || tablesInitialized) return;
  try {
    await pool.query(`
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

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
    console.warn("[NexSport DB] Table init warning:", err);
  }
}

export const db = {
  isConfigured: Boolean(connectionString),

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query("SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1", [cleanEmail]);
      return res.rows[0] || null;
    }

    for (const u of memoryStore.users.values()) {
      if (u.email.toLowerCase() === cleanEmail) return u;
    }
    return null;
  },

  async findUserByMobile(mobile: string): Promise<UserRecord | null> {
    const cleanMobile = mobile.trim();
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query("SELECT * FROM users WHERE mobile = $1 LIMIT 1", [cleanMobile]);
      return res.rows[0] || null;
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
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
      return res.rows[0] || null;
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

    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
        `INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          id,
          data.name.trim(),
          cleanEmail,
          cleanMobile,
          data.password_hash,
          data.is_verified ?? false,
          data.role ?? "user",
          now,
          now,
        ]
      );
      return res.rows[0];
    }

    const record: UserRecord = {
      id,
      name: data.name.trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      password_hash: data.password_hash,
      is_verified: data.is_verified ?? false,
      role: data.role ?? "user",
      created_at: now,
      updated_at: now,
    };
    memoryStore.users.set(id, record);
    return record;
  },

  async markUserVerified(userId: string): Promise<void> {
    if (pool) {
      await initTablesIfRealDb();
      await pool.query(
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

    if (pool) {
      await initTablesIfRealDb();
      // Remove any previous active code for this user
      await pool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      const res = await pool.query(
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

    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
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
    if (pool) {
      await initTablesIfRealDb();
      await pool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
      return;
    }
    for (const [k, v] of memoryStore.verifications.entries()) {
      if (v.user_id === userId) {
        memoryStore.verifications.delete(k);
      }
    }
  },

  async createSession(userId: string, expiresDays = 30): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresDays * 24 * 60 * 60 * 1000);

    if (pool) {
      await initTablesIfRealDb();
      await pool.query(
        `INSERT INTO sessions (id, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, $4)`,
        [token, userId, expiresAt, now]
      );
      return token;
    }

    memoryStore.sessions.set(token, {
      id: token,
      user_id: userId,
      expires_at: expiresAt,
      created_at: now,
    });
    return token;
  },

  async findSession(token: string): Promise<SessionRecord | null> {
    const now = new Date();
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
        "SELECT * FROM sessions WHERE id = $1 AND expires_at > $2 LIMIT 1",
        [token, now]
      );
      return res.rows[0] || null;
    }
    const s = memoryStore.sessions.get(token);
    if (s && s.expires_at > now) {
      return s;
    }
    return null;
  },

  async deleteSession(token: string): Promise<void> {
    if (pool) {
      await initTablesIfRealDb();
      await pool.query("DELETE FROM sessions WHERE id = $1", [token]);
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

    if (pool) {
      await initTablesIfRealDb();
      await pool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
      const res = await pool.query(
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

    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
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
    if (pool) {
      await initTablesIfRealDb();
      await pool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
      return;
    }
    for (const [k, v] of memoryStore.passwordResets.entries()) {
      if (v.user_id === userId) {
        memoryStore.passwordResets.delete(k);
      }
    }
  },

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (pool) {
      await initTablesIfRealDb();
      await pool.query(
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
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
        "UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        [cleanName, userId]
      );
      return res.rows[0] || null;
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

    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
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
          data.title.trim(),
          data.format,
          data.sport || null,
          data.teamCount,
          JSON.stringify(data.state),
          now,
          now,
        ]
      );
      return res.rows[0];
    }

    const record: TournamentRecord = {
      id,
      user_id: data.userId,
      title: data.title.trim(),
      format: data.format,
      sport: data.sport || null,
      team_count: data.teamCount,
      state: data.state,
      created_at: memoryStore.tournaments.get(id)?.created_at || now,
      updated_at: now,
    };
    memoryStore.tournaments.set(id, record);
    return record;
  },

  async listTournaments(userId: string): Promise<TournamentRecord[]> {
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
        "SELECT id, user_id, title, format, sport, team_count, created_at, updated_at FROM tournaments WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId]
      );
      return res.rows;
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
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
        "SELECT * FROM tournaments WHERE id = $1 AND user_id = $2 LIMIT 1",
        [id, userId]
      );
      return res.rows[0] || null;
    }
    const t = memoryStore.tournaments.get(id);
    if (t && t.user_id === userId) {
      return t;
    }
    return null;
  },

  async deleteTournament(id: string, userId: string): Promise<boolean> {
    if (pool) {
      await initTablesIfRealDb();
      const res = await pool.query(
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
