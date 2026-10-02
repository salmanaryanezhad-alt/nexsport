<?php
/**
 * NexSport Database Access Layer (PDO MySQL / MariaDB)
 * Auto-creates schema if not exists on first run.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';

function get_db_connection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $sqliteDb = getenv('NEXSPORT_TEST_SQLITE');
    if ($sqliteDb) {
        $pdo = new PDO("sqlite:{$sqliteDb}");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        ensure_tables_exist_sqlite($pdo);
        return $pdo;
    }

    $dsn = "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        ensure_tables_exist_mysql($pdo);
    } catch (\PDOException $e) {
        // Return 500 JSON error if database connection fails
        json_response([
            'error' => 'امکان اتصال به پایگاه داده MySQL وجود ندارد: ' . $e->getMessage()
        ], 500);
    }

    return $pdo;
}

function ensure_tables_exist_mysql($pdo) {
    static $checked = false;
    if ($checked) return;
    $checked = true;

    $sql = "
    CREATE TABLE IF NOT EXISTS `users` (
        `id` VARCHAR(36) NOT NULL,
        `name` VARCHAR(100) NOT NULL,
        `email` VARCHAR(150) NOT NULL,
        `mobile` VARCHAR(20) NOT NULL,
        `password_hash` TEXT NOT NULL,
        `is_verified` TINYINT(1) DEFAULT 0,
        `role` VARCHAR(20) DEFAULT 'user',
        `planning_credits` INT DEFAULT 5,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uniq_users_email` (`email`),
        UNIQUE KEY `uniq_users_mobile` (`mobile`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `email_verifications` (
        `id` VARCHAR(36) NOT NULL,
        `user_id` VARCHAR(36) NOT NULL,
        `email` VARCHAR(150) NOT NULL,
        `code` VARCHAR(6) NOT NULL,
        `expires_at` TIMESTAMP NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_verifications_user_id` (`user_id`),
        KEY `idx_verifications_lookup` (`email`, `code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `sessions` (
        `id` VARCHAR(64) NOT NULL,
        `user_id` VARCHAR(36) NOT NULL,
        `device_type` VARCHAR(20) DEFAULT 'desktop',
        `expires_at` TIMESTAMP NOT NULL,
        `last_active_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_sessions_user_id` (`user_id`),
        KEY `idx_sessions_device` (`user_id`, `device_type`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `password_resets` (
        `id` VARCHAR(36) NOT NULL,
        `user_id` VARCHAR(36) NOT NULL,
        `email` VARCHAR(150) NOT NULL,
        `code` VARCHAR(6) NOT NULL,
        `expires_at` TIMESTAMP NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_resets_user_id` (`user_id`),
        KEY `idx_resets_lookup` (`email`, `code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `tournaments` (
        `id` VARCHAR(36) NOT NULL,
        `user_id` VARCHAR(36) NOT NULL,
        `title` VARCHAR(200) NOT NULL,
        `format` VARCHAR(50) NOT NULL,
        `sport` VARCHAR(50) DEFAULT NULL,
        `team_count` INT NOT NULL,
        `state` LONGTEXT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_tournaments_user_id` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `teams` (
        `id` VARCHAR(36) NOT NULL,
        `user_id` VARCHAR(36) NOT NULL,
        `name` VARCHAR(80) NOT NULL,
        `short_name` VARCHAR(16) DEFAULT '',
        `sport` VARCHAR(40) DEFAULT 'فوتبال',
        `city` VARCHAR(60) DEFAULT '',
        `founded_year` VARCHAR(4) DEFAULT '',
        `kit_home` VARCHAR(40) DEFAULT '',
        `kit_away` VARCHAR(40) DEFAULT '',
        `coach` VARCHAR(80) DEFAULT '',
        `description` VARCHAR(500) DEFAULT '',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_teams_user` (`user_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `players` (
        `id` VARCHAR(36) NOT NULL,
        `team_id` VARCHAR(36) NOT NULL,
        `name` VARCHAR(80) NOT NULL,
        `jersey_number` VARCHAR(3) DEFAULT '',
        `position` VARCHAR(40) DEFAULT '',
        `birth_date` VARCHAR(10) DEFAULT '',
        `mobile` VARCHAR(20) DEFAULT '',
        `national_id` VARCHAR(10) DEFAULT '',
        `status` VARCHAR(20) DEFAULT 'active',
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_players_team` (`team_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE IF NOT EXISTS `registrations` (
        `id` VARCHAR(36) NOT NULL,
        `tournament_id` VARCHAR(36) NOT NULL,
        `team_name` VARCHAR(80) NOT NULL,
        `short_name` VARCHAR(16) DEFAULT '',
        `city` VARCHAR(60) DEFAULT '',
        `coach` VARCHAR(80) DEFAULT '',
        `contact_name` VARCHAR(80) DEFAULT '',
        `mobile` VARCHAR(20) DEFAULT '',
        `notes` VARCHAR(500) DEFAULT '',
        `status` VARCHAR(20) DEFAULT 'pending',
        `library_team_id` VARCHAR(36) DEFAULT '',
        `reject_reason` VARCHAR(300) DEFAULT '',
        `roster` LONGTEXT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_registrations_tournament` (`tournament_id`, `status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";

    try {
        $pdo->exec($sql);
    } catch (\Throwable $e) {}

    // Auto-migrate device_type column on existing database tables
    try {
        $colCheck = $pdo->query("SHOW COLUMNS FROM `sessions` LIKE 'device_type'");
        if (!$colCheck || !$colCheck->fetch()) {
            $pdo->exec("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'");
            $pdo->exec("ALTER TABLE `sessions` ADD INDEX `idx_sessions_device` (`user_id`, `device_type`)");
        }
    } catch (\Throwable $e) {}

    try {
        $colCheck = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'planning_credits'");
        if (!$colCheck || !$colCheck->fetch()) {
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `planning_credits` INT DEFAULT 5");
        }
    } catch (\Throwable $e) {}
}

function ensure_tables_exist_sqlite($pdo) {
    $sql = "
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mobile TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        role TEXT DEFAULT 'user',
        planning_credits INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_type TEXT DEFAULT 'desktop',
        expires_at DATETIME NOT NULL,
        last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        format TEXT NOT NULL,
        sport TEXT,
        team_count INTEGER NOT NULL,
        state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        short_name TEXT DEFAULT '',
        sport TEXT DEFAULT 'فوتبال',
        city TEXT DEFAULT '',
        founded_year TEXT DEFAULT '',
        kit_home TEXT DEFAULT '',
        kit_away TEXT DEFAULT '',
        coach TEXT DEFAULT '',
        description TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        jersey_number TEXT DEFAULT '',
        position TEXT DEFAULT '',
        birth_date TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        national_id TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS registrations (
        id TEXT PRIMARY KEY,
        tournament_id TEXT NOT NULL,
        team_name TEXT NOT NULL,
        short_name TEXT DEFAULT '',
        city TEXT DEFAULT '',
        coach TEXT DEFAULT '',
        contact_name TEXT DEFAULT '',
        mobile TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        library_team_id TEXT DEFAULT '',
        reject_reason TEXT DEFAULT '',
        roster TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ";
    $pdo->exec($sql);
}

// User functions
function db_normalize_user_row($pdo, $user) {
    if (!$user) return null;
    if (is_admin_email($user['email'] ?? '')) {
        if (($user['role'] ?? '') !== 'admin') {
            try {
                $stmt = $pdo->prepare("UPDATE users SET role = 'admin' WHERE id = ?");
                $stmt->execute([$user['id']]);
            } catch (\Throwable $e) {}
            $user['role'] = 'admin';
        }
    }
    return $user;
}

function db_find_user_by_email($pdo, $email) {
    $clean = clean_email($email);
    if (!$clean) return null;

    $raw = strtolower(trim((string)$email));
    $persian = to_persian_digits($clean);
    $arabic = to_arabic_digits($clean);

    $variants = array_values(array_unique(array_filter([$clean, $raw, $persian, $arabic])));
    $placeholders = implode(',', array_fill(0, count($variants), '?'));

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email IN ({$placeholders}) LIMIT 1");
    $stmt->execute($variants);
    $user = $stmt->fetch() ?: null;
    return db_normalize_user_row($pdo, $user);
}

function db_find_user_by_mobile($pdo, $mobile) {
    $clean = clean_mobile($mobile);
    if (!$clean) return null;

    $raw = trim((string)$mobile);
    $engRaw = to_english_digits($raw);
    $persian = to_persian_digits($clean);
    $arabic = to_arabic_digits($clean);
    $noZero = ltrim($clean, '0');
    $withZero = '0' . $noZero;
    $withPlus98 = '+98' . $noZero;
    $with0098 = '0098' . $noZero;

    $variants = array_values(array_unique(array_filter([
        $clean,
        $withZero,
        $noZero,
        $withPlus98,
        $with0098,
        $raw,
        $engRaw,
        $persian,
        $arabic
    ])));
    $placeholders = implode(',', array_fill(0, count($variants), '?'));

    $stmt = $pdo->prepare("SELECT * FROM users WHERE mobile IN ({$placeholders}) LIMIT 1");
    $stmt->execute($variants);
    $user = $stmt->fetch() ?: null;
    return db_normalize_user_row($pdo, $user);
}

function db_find_user_by_id($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $user = $stmt->fetch() ?: null;
    return db_normalize_user_row($pdo, $user);
}

function db_list_all_users($pdo) {
    $stmt = $pdo->query("SELECT id, name, email, mobile, is_verified, role, created_at, updated_at FROM users ORDER BY created_at DESC");
    $users = $stmt->fetchAll() ?: [];
    foreach ($users as &$u) {
        if (is_admin_email($u['email'] ?? '')) {
            $u['role'] = 'admin';
        }
    }
    return $users;
}

function db_consume_planning_credits($pdo, $userId, $count) {
    $charge = max(1, (int)$count);
    $user = db_find_user_by_id($pdo, $userId);
    if (!$user) {
        return ['success' => false, 'remaining' => 0, 'charged' => 0, 'error' => 'کاربر یافت نشد.'];
    }
    $current = isset($user['planning_credits']) ? (int)$user['planning_credits'] : 5;
    if ($current < $charge) {
        return [
            'success' => false,
            'remaining' => $current,
            'charged' => 0,
            'error' => "برای این کار به {$charge} سهمیه برنامه‌سازی نیاز است. سهمیه فعلی شما کافی نیست.",
        ];
    }
    $new = $current - $charge;
    $stmt = $pdo->prepare("UPDATE users SET planning_credits = ? WHERE id = ?");
    $stmt->execute([$new, $userId]);
    return ['success' => true, 'remaining' => $new, 'charged' => $charge];
}

function db_add_planning_credits($pdo, $userId, $count) {
    $add = max(1, (int)$count);
    $stmt = $pdo->prepare("UPDATE users SET planning_credits = COALESCE(planning_credits, 5) + ? WHERE id = ?");
    $stmt->execute([$add, $userId]);
    $stmt = $pdo->prepare("SELECT planning_credits FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    return $row ? (int)$row['planning_credits'] : 0;
}

function db_create_user($pdo, $name, $email, $mobile, $passwordHash, $isVerified = 0, $role = 'user') {
    $id = generate_uuid();
    $stmt = $pdo->prepare("
        INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, planning_credits, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $id,
        trim($name),
        clean_email($email),
        clean_mobile($mobile),
        $passwordHash,
        $isVerified ? 1 : 0,
        $role
    ]);
    return db_find_user_by_id($pdo, $id);
}

function db_update_user_password($pdo, $userId, $newHash) {
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$newHash, $userId]);
}

function db_update_user_profile($pdo, $userId, $name) {
    $stmt = $pdo->prepare("UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([trim($name), $userId]);
    return db_find_user_by_id($pdo, $userId);
}

function db_mark_user_verified($pdo, $userId) {
    $stmt = $pdo->prepare("UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([$userId]);
}

function db_delete_unverified_user($pdo, $userId) {
    $user = db_find_user_by_id($pdo, $userId);
    if (!$user || !empty($user['is_verified'])) {
        return false;
    }
    // Delete related records
    $stmt = $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ?");
    $stmt->execute([$userId]);

    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $stmt->execute([$userId]);

    $stmt = $pdo->prepare("DELETE FROM sessions WHERE user_id = ?");
    $stmt->execute([$userId]);

    $stmt = $pdo->prepare("DELETE FROM tournaments WHERE user_id = ?");
    $stmt->execute([$userId]);

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ? AND is_verified = 0");
    $stmt->execute([$userId]);
    return $stmt->rowCount() > 0;
}

// Email Verification functions
function db_save_verification_code($pdo, $userId, $email, $code, $minutes = 15) {
    $id = generate_uuid();
    // Delete any old verification codes for this email
    $del = $pdo->prepare("DELETE FROM email_verifications WHERE email = ?");
    $del->execute([clean_email($email)]);

    $isSqlite = (bool)getenv('NEXSPORT_TEST_SQLITE');
    if ($isSqlite) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($minutes * 60));
        $stmt = $pdo->prepare("INSERT INTO email_verifications (id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$id, $userId, clean_email($email), $code, $expiresAt]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO email_verifications (id, user_id, email, code, expires_at)
            VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))
        ");
        $stmt->execute([$id, $userId, clean_email($email), $code, $minutes]);
    }
}

function db_verify_code($pdo, $email, $code) {
    $stmt = $pdo->prepare("
        SELECT * FROM email_verifications
        WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->execute([clean_email($email), trim($code)]);
    return $stmt->fetch() ?: null;
}

function db_delete_verification_codes_for_user($pdo, $userId) {
    $stmt = $pdo->prepare("DELETE FROM email_verifications WHERE user_id = ?");
    $stmt->execute([$userId]);
}

// Password Reset functions
function db_save_password_reset_code($pdo, $userId, $email, $code, $minutes = 15) {
    $id = generate_uuid();
    $del = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $del->execute([$userId]);

    $isSqlite = (bool)getenv('NEXSPORT_TEST_SQLITE');
    if ($isSqlite) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($minutes * 60));
        $stmt = $pdo->prepare("INSERT INTO password_resets (id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$id, $userId, clean_email($email), $code, $expiresAt]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO password_resets (id, user_id, email, code, expires_at)
            VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))
        ");
        $stmt->execute([$id, $userId, clean_email($email), $code, $minutes]);
    }
}

function db_verify_password_reset_code($pdo, $email, $code) {
    $stmt = $pdo->prepare("
        SELECT * FROM password_resets
        WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->execute([clean_email($email), trim($code)]);
    return $stmt->fetch() ?: null;
}

function db_delete_password_reset_codes_for_user($pdo, $userId) {
    $stmt = $pdo->prepare("DELETE FROM password_resets WHERE user_id = ?");
    $stmt->execute([$userId]);
}

// Sessions (Sliding/Rolling 48 Hours & Dual-Device Policy)
function db_create_session($pdo, $userId, $deviceType = 'desktop', $hours = SESSION_HOURS) {
    $token = generate_session_token();
    $device = ($deviceType === 'mobile') ? 'mobile' : 'desktop';
    $isSqlite = (bool)getenv('NEXSPORT_TEST_SQLITE');
    if ($isSqlite) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($hours * 3600));
        try {
            $stmt = $pdo->prepare("INSERT INTO sessions (id, user_id, device_type, expires_at, last_active_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)");
            $stmt->execute([$token, $userId, $device, $expiresAt]);
        } catch (\Throwable $e) {
            try { $pdo->exec("ALTER TABLE sessions ADD COLUMN device_type TEXT DEFAULT 'desktop'"); } catch (\Throwable $ign) {}
            $stmt = $pdo->prepare("INSERT INTO sessions (id, user_id, device_type, expires_at, last_active_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)");
            $stmt->execute([$token, $userId, $device, $expiresAt]);
        }
    } else {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO sessions (id, user_id, device_type, expires_at, last_active_at)
                VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? HOUR), CURRENT_TIMESTAMP)
            ");
            $stmt->execute([$token, $userId, $device, $hours]);
        } catch (\Throwable $e) {
            try {
                $pdo->exec("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'");
            } catch (\Throwable $ign) {}
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO sessions (id, user_id, device_type, expires_at, last_active_at)
                    VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? HOUR), CURRENT_TIMESTAMP)
                ");
                $stmt->execute([$token, $userId, $device, $hours]);
            } catch (\Throwable $e2) {
                $stmt = $pdo->prepare("
                    INSERT INTO sessions (id, user_id, expires_at, last_active_at)
                    VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? HOUR), CURRENT_TIMESTAMP)
                ");
                $stmt->execute([$token, $userId, $hours]);
            }
        }
    }
    return $token;
}

function db_find_active_session_by_device($pdo, $userId, $deviceType) {
    $device = ($deviceType === 'mobile') ? 'mobile' : 'desktop';
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM sessions
            WHERE user_id = ? AND device_type = ? AND expires_at > CURRENT_TIMESTAMP
            ORDER BY last_active_at DESC LIMIT 1
        ");
        $stmt->execute([$userId, $device]);
        return $stmt->fetch() ?: null;
    } catch (\Throwable $e) {
        try {
            $pdo->exec("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'");
            $stmt = $pdo->prepare("
                SELECT * FROM sessions
                WHERE user_id = ? AND device_type = ? AND expires_at > CURRENT_TIMESTAMP
                ORDER BY last_active_at DESC LIMIT 1
            ");
            $stmt->execute([$userId, $device]);
            return $stmt->fetch() ?: null;
        } catch (\Throwable $ign) {
            return null;
        }
    }
}

function db_delete_sessions_by_device($pdo, $userId, $deviceType) {
    $device = ($deviceType === 'mobile') ? 'mobile' : 'desktop';
    try {
        $stmt = $pdo->prepare("DELETE FROM sessions WHERE user_id = ? AND device_type = ?");
        $stmt->execute([$userId, $device]);
    } catch (\Throwable $e) {
        try {
            $pdo->exec("ALTER TABLE `sessions` ADD COLUMN `device_type` VARCHAR(20) DEFAULT 'desktop'");
            $stmt = $pdo->prepare("DELETE FROM sessions WHERE user_id = ? AND device_type = ?");
            $stmt->execute([$userId, $device]);
        } catch (\Throwable $ign) {}
    }
}

function db_find_session($pdo, $token, $hours = SESSION_HOURS) {
    if (!$token) return null;
    $stmt = $pdo->prepare("SELECT * FROM sessions WHERE id = ? LIMIT 1");
    $stmt->execute([$token]);
    $session = $stmt->fetch();
    if (!$session) return null;

    // Check expiration
    if (strtotime($session['expires_at']) < time()) {
        // Expired -> clean up
        db_delete_session($pdo, $token);
        return null;
    }

    // Rolling session: renew expiration for 48 hours from this activity
    $isSqlite = (bool)getenv('NEXSPORT_TEST_SQLITE');
    if ($isSqlite) {
        $newExpires = date('Y-m-d H:i:s', time() + ($hours * 3600));
        $update = $pdo->prepare("UPDATE sessions SET expires_at = ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([$newExpires, $token]);
    } else {
        $update = $pdo->prepare("UPDATE sessions SET expires_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? HOUR), last_active_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([$hours, $token]);
    }

    return $session;
}

function db_delete_session($pdo, $token) {
    if (!$token) return;
    $stmt = $pdo->prepare("DELETE FROM sessions WHERE id = ?");
    $stmt->execute([$token]);
}

// Tournament CRUD
function db_list_tournaments($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT id, user_id, title, format, sport, team_count, created_at, updated_at
        FROM tournaments
        WHERE user_id = ?
        ORDER BY updated_at DESC
    ");
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();

    return array_map(function($r) {
        return [
            'id'          => $r['id'],
            'user_id'     => $r['user_id'],
            'title'       => $r['title'],
            'format'      => $r['format'],
            'sport'       => $r['sport'],
            'team_count'  => (int)$r['team_count'],
            'teamCount'   => (int)$r['team_count'],
            'created_at'  => $r['created_at'],
            'updated_at'  => $r['updated_at']
        ];
    }, $rows);
}

function db_save_tournament($pdo, $id, $userId, $title, $format, $sport, $teamCount, $state) {
    $targetId = $id ?: generate_uuid();

    // Check if tournament exists for this user
    $check = $pdo->prepare("SELECT id FROM tournaments WHERE id = ? AND user_id = ? LIMIT 1");
    $check->execute([$targetId, $userId]);
    $exists = $check->fetch();

    if ($exists && is_array($state)) {
        $existing = db_get_tournament($pdo, $targetId, $userId);
        $old = is_array($existing['state'] ?? null) ? $existing['state'] : [];
        if (!empty($old['payment']) && empty($state['payment'])) $state['payment'] = $old['payment'];
        if (!empty($old['registrationPayment']) && empty($state['registrationPayment'])) $state['registrationPayment'] = $old['registrationPayment'];
        if (!empty($old['registration']) && empty($state['registration'])) $state['registration'] = $old['registration'];
    }
    $stateStr = is_string($state) ? $state : json_encode($state, JSON_UNESCAPED_UNICODE);

    if ($exists) {
        $stmt = $pdo->prepare("
            UPDATE tournaments
            SET title = ?, format = ?, sport = ?, team_count = ?, state = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        ");
        $stmt->execute([
            trim($title),
            $format,
            $sport ?: null,
            (int)$teamCount,
            $stateStr,
            $targetId,
            $userId
        ]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO tournaments (id, user_id, title, format, sport, team_count, state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ");
        $stmt->execute([
            $targetId,
            $userId,
            trim($title),
            $format,
            $sport ?: null,
            (int)$teamCount,
            $stateStr
        ]);
    }

    return db_get_tournament($pdo, $targetId, $userId);
}

function db_get_tournament($pdo, $id, $userId) {
    $stmt = $pdo->prepare("SELECT * FROM tournaments WHERE id = ? AND user_id = ? LIMIT 1");
    $stmt->execute([$id, $userId]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $stateData = json_decode($row['state'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $stateData = $row['state'];
    }

    return [
        'id'          => $row['id'],
        'user_id'     => $row['user_id'],
        'title'       => $row['title'],
        'format'      => $row['format'],
        'sport'       => $row['sport'],
        'team_count'  => (int)$row['team_count'],
        'teamCount'   => (int)$row['team_count'],
        'state'       => $stateData,
        'created_at'  => $row['created_at'],
        'updated_at'  => $row['updated_at']
    ];
}

function db_get_public_tournament($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM tournaments WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;

    $stateData = json_decode($row['state'], true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $stateData = $row['state'];
    }

    return [
        'id'          => $row['id'],
        'title'       => $row['title'],
        'format'      => $row['format'],
        'sport'       => $row['sport'],
        'team_count'  => (int)$row['team_count'],
        'teamCount'   => (int)$row['team_count'],
        'state'       => $stateData,
        'created_at'  => $row['created_at'],
        'updated_at'  => $row['updated_at']
    ];
}

function db_delete_tournament($pdo, $id, $userId) {
    $stmt = $pdo->prepare("DELETE FROM tournaments WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    return $stmt->rowCount() > 0;
}

function db_normalize_team_row($row, $playerCount = null, $owner = null) {
    if (!$row) return null;
    $out = [
        'id' => $row['id'],
        'user_id' => $row['user_id'],
        'name' => $row['name'],
        'short_name' => $row['short_name'] ?? '',
        'sport' => $row['sport'] ?? 'فوتبال',
        'city' => $row['city'] ?? '',
        'founded_year' => $row['founded_year'] ?? '',
        'kit_home' => $row['kit_home'] ?? '',
        'kit_away' => $row['kit_away'] ?? '',
        'coach' => $row['coach'] ?? '',
        'description' => $row['description'] ?? '',
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'player_count' => $playerCount !== null ? (int)$playerCount : (int)($row['player_count'] ?? 0),
    ];
    if ($owner) {
        $out['owner_name'] = $owner['name'] ?? ($row['owner_name'] ?? '');
        $out['owner_email'] = $owner['email'] ?? ($row['owner_email'] ?? '');
    } else {
        if (isset($row['owner_name'])) $out['owner_name'] = $row['owner_name'];
        if (isset($row['owner_email'])) $out['owner_email'] = $row['owner_email'];
    }
    return $out;
}

function db_normalize_player_row($row) {
    if (!$row) return null;
    return [
        'id' => $row['id'],
        'team_id' => $row['team_id'],
        'name' => $row['name'],
        'jersey_number' => $row['jersey_number'] ?? '',
        'position' => $row['position'] ?? '',
        'birth_date' => $row['birth_date'] ?? '',
        'mobile' => $row['mobile'] ?? '',
        'national_id' => $row['national_id'] ?? '',
        'status' => $row['status'] ?? 'active',
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}

function db_list_teams($pdo, $userId) {
    $stmt = $pdo->prepare("
        SELECT t.*, (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS player_count
        FROM teams t WHERE t.user_id = ? ORDER BY t.updated_at DESC
    ");
    $stmt->execute([$userId]);
    return array_map('db_normalize_team_row', $stmt->fetchAll() ?: []);
}

function db_list_all_teams($pdo) {
    $stmt = $pdo->query("
        SELECT t.*, u.name AS owner_name, u.email AS owner_email,
               (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS player_count
        FROM teams t INNER JOIN users u ON u.id = t.user_id
        ORDER BY t.updated_at DESC
    ");
    return array_map('db_normalize_team_row', $stmt->fetchAll() ?: []);
}

function db_get_team($pdo, $id) {
    $stmt = $pdo->prepare("
        SELECT t.*, (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id) AS player_count
        FROM teams t WHERE t.id = ? LIMIT 1
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? db_normalize_team_row($row) : null;
}

function db_create_team($pdo, $userId, $data) {
    $id = generate_uuid();
    $stmt = $pdo->prepare("
        INSERT INTO teams (id, user_id, name, short_name, sport, city, founded_year, kit_home, kit_away, coach, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $id, $userId, $data['name'], $data['short_name'], $data['sport'], $data['city'],
        $data['founded_year'], $data['kit_home'], $data['kit_away'], $data['coach'], $data['description']
    ]);
    return db_get_team($pdo, $id);
}

function db_update_team($pdo, $id, $data) {
    $stmt = $pdo->prepare("
        UPDATE teams SET name=?, short_name=?, sport=?, city=?, founded_year=?, kit_home=?, kit_away=?, coach=?, description=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ");
    $stmt->execute([
        $data['name'], $data['short_name'], $data['sport'], $data['city'], $data['founded_year'],
        $data['kit_home'], $data['kit_away'], $data['coach'], $data['description'], $id
    ]);
    return db_get_team($pdo, $id);
}

function db_delete_team($pdo, $id) {
    $pdo->prepare("DELETE FROM players WHERE team_id = ?")->execute([$id]);
    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->rowCount() > 0;
}

function db_list_players($pdo, $teamId) {
    $stmt = $pdo->prepare("SELECT * FROM players WHERE team_id = ? ORDER BY jersey_number ASC, name ASC");
    $stmt->execute([$teamId]);
    return array_map('db_normalize_player_row', $stmt->fetchAll() ?: []);
}

function db_get_player($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM players WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? db_normalize_player_row($row) : null;
}

function db_jersey_taken($pdo, $teamId, $jersey, $exceptId = null) {
    if ($jersey === '' || $jersey === null) return false;
    if ($exceptId) {
        $stmt = $pdo->prepare("SELECT id FROM players WHERE team_id = ? AND jersey_number = ? AND id <> ? LIMIT 1");
        $stmt->execute([$teamId, $jersey, $exceptId]);
    } else {
        $stmt = $pdo->prepare("SELECT id FROM players WHERE team_id = ? AND jersey_number = ? LIMIT 1");
        $stmt->execute([$teamId, $jersey]);
    }
    return (bool)$stmt->fetch();
}

function db_create_player($pdo, $teamId, $data) {
    if (db_jersey_taken($pdo, $teamId, $data['jersey_number'])) {
        return ['error' => 'این شماره پیراهن در این تیم قبلاً ثبت شده است.'];
    }
    $id = generate_uuid();
    $stmt = $pdo->prepare("
        INSERT INTO players (id, team_id, name, jersey_number, position, birth_date, mobile, national_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $id, $teamId, $data['name'], $data['jersey_number'], $data['position'], $data['birth_date'],
        $data['mobile'], $data['national_id'], $data['status']
    ]);
    return db_get_player($pdo, $id);
}

function db_update_player($pdo, $playerId, $teamId, $data) {
    if (db_jersey_taken($pdo, $teamId, $data['jersey_number'], $playerId)) {
        return ['error' => 'این شماره پیراهن در این تیم قبلاً ثبت شده است.'];
    }
    $stmt = $pdo->prepare("
        UPDATE players SET name=?, jersey_number=?, position=?, birth_date=?, mobile=?, national_id=?, status=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
    ");
    $stmt->execute([
        $data['name'], $data['jersey_number'], $data['position'], $data['birth_date'],
        $data['mobile'], $data['national_id'], $data['status'], $playerId
    ]);
    return db_get_player($pdo, $playerId);
}

function db_delete_player($pdo, $playerId) {
    $stmt = $pdo->prepare("DELETE FROM players WHERE id = ?");
    $stmt->execute([$playerId]);
    return $stmt->rowCount() > 0;
}

function db_list_linked_tournaments($pdo, $userId, $teamId, $teamName) {
    $stmt = $pdo->prepare("SELECT id, title, format, state, updated_at FROM tournaments WHERE user_id = ? ORDER BY updated_at DESC");
    $stmt->execute([$userId]);
    $out = [];
    foreach ($stmt->fetchAll() ?: [] as $row) {
        $state = json_decode($row['state'] ?? '', true);
        if (!is_array($state)) $state = [];
        $ids = isset($state['libraryTeamIds']) && is_array($state['libraryTeamIds']) ? $state['libraryTeamIds'] : [];
        $names = isset($state['teamNames']) && is_array($state['teamNames']) ? $state['teamNames'] : [];
        if (in_array($teamId, $ids, true) || in_array($teamName, $names, true)) {
            $out[] = [
                'id' => $row['id'],
                'title' => $row['title'],
                'format' => $row['format'],
                'updated_at' => $row['updated_at'],
            ];
        }
    }
    return $out;
}

function db_parse_roster($raw) {
    if (is_array($raw)) return $raw;
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? $decoded : [];
}

function db_normalize_registration_row($row) {
    if (!$row) return null;
    $status = $row['status'] ?? 'pending';
    if (!in_array($status, ['pending', 'approved', 'rejected'], true)) $status = 'pending';
    return [
        'id' => $row['id'],
        'tournament_id' => $row['tournament_id'],
        'team_name' => $row['team_name'],
        'short_name' => $row['short_name'] ?? '',
        'city' => $row['city'] ?? '',
        'coach' => $row['coach'] ?? '',
        'contact_name' => $row['contact_name'] ?? '',
        'mobile' => $row['mobile'] ?? '',
        'notes' => $row['notes'] ?? '',
        'status' => $status,
        'library_team_id' => $row['library_team_id'] ?? '',
        'reject_reason' => $row['reject_reason'] ?? '',
        'roster' => db_parse_roster($row['roster'] ?? '[]'),
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function db_list_registrations($pdo, $tournamentId) {
    $stmt = $pdo->prepare("SELECT * FROM registrations WHERE tournament_id = ? ORDER BY created_at ASC");
    $stmt->execute([$tournamentId]);
    return array_map('db_normalize_registration_row', $stmt->fetchAll() ?: []);
}

function db_get_registration($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM registrations WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ? db_normalize_registration_row($row) : null;
}

function db_create_registration($pdo, $tournamentId, $data) {
    $list = db_list_registrations($pdo, $tournamentId);
    $name = trim((string)($data['team_name'] ?? ''));
    foreach ($list as $r) {
        if (($r['status'] ?? '') !== 'rejected' && trim((string)$r['team_name']) === $name) {
            return ['error' => 'تیمی با این نام قبلاً برای این مسابقه ثبت شده است.'];
        }
    }
    $id = generate_uuid();
    $stmt = $pdo->prepare("
        INSERT INTO registrations (id, tournament_id, team_name, short_name, city, coach, contact_name, mobile, notes, status, library_team_id, reject_reason, roster, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, '', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ");
    $stmt->execute([
        $id, $tournamentId, $name,
        $data['short_name'] ?? '', $data['city'] ?? '', $data['coach'] ?? '',
        $data['contact_name'] ?? '', $data['mobile'] ?? '', $data['notes'] ?? '',
        $data['library_team_id'] ?? '', json_encode($data['roster'] ?? [], JSON_UNESCAPED_UNICODE)
    ]);
    return db_get_registration($pdo, $id);
}

function db_update_registration_status($pdo, $id, $status, $reason = '') {
    $reason = $status === 'rejected' ? mb_substr(trim((string)$reason), 0, 300) : '';
    $stmt = $pdo->prepare("UPDATE registrations SET status=?, reject_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?");
    $stmt->execute([$status, $reason, $id]);
    return db_get_registration($pdo, $id);
}
