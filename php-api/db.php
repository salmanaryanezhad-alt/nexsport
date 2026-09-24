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
    ";
    $pdo->exec($sql);
}

// User functions
function db_normalize_user_row($pdo, $user) {
    if (!$user) return null;
    if (clean_email($user['email'] ?? '') === 'salman.aryanezhad@gmail.com') {
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
        if (clean_email($u['email'] ?? '') === 'salman.aryanezhad@gmail.com') {
            $u['role'] = 'admin';
        }
    }
    return $users;
}

function db_create_user($pdo, $name, $email, $mobile, $passwordHash, $isVerified = 0, $role = 'user') {
    $id = generate_uuid();
    $stmt = $pdo->prepare("
        INSERT INTO users (id, name, email, mobile, password_hash, is_verified, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    $stateStr = is_string($state) ? $state : json_encode($state, JSON_UNESCAPED_UNICODE);
    $targetId = $id ?: generate_uuid();

    // Check if tournament exists for this user
    $check = $pdo->prepare("SELECT id FROM tournaments WHERE id = ? AND user_id = ? LIMIT 1");
    $check->execute([$targetId, $userId]);
    $exists = $check->fetch();

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

function db_delete_tournament($pdo, $id, $userId) {
    $stmt = $pdo->prepare("DELETE FROM tournaments WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    return $stmt->rowCount() > 0;
}
