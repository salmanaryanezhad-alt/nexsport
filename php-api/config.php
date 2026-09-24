<?php
/**
 * NexSport PHP Database & App Configuration
 * Auto-configured for cPanel shared hosting (PHP 7.4 / 8.0 / 8.1 / 8.2 / 8.3 / 8.4)
 */

// Error reporting: disable display errors in production to prevent leaking sensitive info
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);

// Helper to load key-value pairs from .env if present
function load_env_file($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            if (!getenv($key)) {
                putenv("{$key}={$val}");
                $_ENV[$key] = $val;
            }
        }
    }
}

// Try loading from .env in current, parent or grand-parent directory
load_env_file(__DIR__ . '/.env');
load_env_file(__DIR__ . '/../.env');
load_env_file(dirname(__DIR__, 2) . '/.env');

// Database credentials with production defaults
define('DB_HOST', getenv('MYSQL_HOST') ?: 'localhost');
define('DB_PORT', getenv('MYSQL_PORT') ?: '3306');
define('DB_NAME', getenv('MYSQL_DATABASE') ?: 'unmvwyxf_nexsport_db');
define('DB_USER', getenv('MYSQL_USER') ?: 'unmvwyxf_nexsport_db');
define('DB_PASS', getenv('MYSQL_PASSWORD') ?: 'HKV0=VNVFXzB*Yxf');
define('SITE_URL', getenv('NEXT_PUBLIC_SITE_URL') ?: 'https://nexsport.ir');
define('SESSION_HOURS', 48); // 48-hour rolling session window
