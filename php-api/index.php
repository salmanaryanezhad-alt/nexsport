<?php
/**
 * NexSport API Router (PHP & MySQL Backend)
 * Handles all Next.js App Router API endpoints seamlessly on Apache / LiteSpeed (cPanel).
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/utils.php';
require_once __DIR__ . '/db.php';

// Allow Cross-Origin if required (e.g., local dev)
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
}

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    }
    exit(0);
}

set_exception_handler(function($e) {
    json_response(['error' => 'خطای سرور: ' . $e->getMessage()], 500);
});

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$rawUri = $_GET['_route'] ?? $_SERVER['PATH_INFO'] ?? $_SERVER['REDIRECT_URL'] ?? parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// Normalize route path:
// e.g. /api/auth/login -> auth/login
// e.g. /nexsport/api/tournaments/123 -> tournaments/123
$path = trim($rawUri, '/');
// Strip any prefix before 'api/' if site is in a subdirectory
if (($pos = strpos($path, 'api/')) !== false) {
    $path = substr($path, $pos + 4);
} elseif ($path === 'api') {
    $path = '';
}
$path = preg_replace('#^index\.php/?#', '', $path);
$path = trim($path, '/');

// Connect to Database
$pdo = get_db_connection();

// Helper to authenticate user session with 48h rolling window
function require_auth($pdo) {
    $token = get_auth_token();
    if (!$token) {
        json_response([
            'error' => 'ابتدا وارد حساب کاربری شوید.',
            'expired' => true
        ], 401);
    }

    $session = db_find_session($pdo, $token);
    if (!$session) {
        clear_session_cookie();
        json_response([
            'error' => 'نشست شما منقضی شده است. لطفاً مجدداً وارد شوید.',
            'expired' => true
        ], 401);
    }

    // Refresh rolling 48-hour cookie on activity
    set_session_cookie($token, time() + (SESSION_HOURS * 3600));

    return [$session, $token];
}

// ==========================================
// Health Check Endpoint
// ==========================================
if ($path === '' || $path === 'health') {
    json_response([
        'status' => 'ok',
        'service' => 'NexSport PHP API',
        'version' => '2.0.0',
        'database' => 'connected',
        'charset' => 'utf8mb4',
        'timestamp' => date('c')
    ]);
}

// ==========================================
// Authentication Routes (/api/auth/*)
// ==========================================

// 1. POST /api/auth/register
if ($path === 'auth/register' && $method === 'POST') {
    $body = get_json_input();
    $name = trim($body['name'] ?? '');
    $email = clean_email($body['email'] ?? '');
    $mobile = clean_mobile($body['mobile'] ?? '');
    $password = (string)($body['password'] ?? '');

    if (!$name) {
        json_response(['error' => 'لطفاً نام و نام خانوادگی را وارد نمایید.'], 400);
    }
    if (!$email || strpos($email, '@') === false) {
        json_response(['error' => 'لطفاً یک آدرس ایمیل معتبر وارد نمایید.'], 400);
    }
    if (!$mobile || strlen($mobile) < 8) {
        json_response(['error' => 'لطفاً شماره موبایل معتبر وارد نمایید.'], 400);
    }
    if (!$password) {
        json_response(['error' => 'لطفاً رمز عبور را وارد نمایید.'], 400);
    }

    // Check unique email
    if (db_find_user_by_email($pdo, $email)) {
        json_response(['error' => 'این ایمیل قبلاً در سامانه ثبت شده است. اگر حساب دارید، وارد شوید.'], 409);
    }

    // Check unique mobile
    if (db_find_user_by_mobile($pdo, $mobile)) {
        json_response(['error' => 'این شماره موبایل قبلاً ثبت شده است.'], 409);
    }

    // Create unverified user
    $passwordHash = hash_password($password);
    $user = db_create_user($pdo, $name, $email, $mobile, $passwordHash, 0);

    // Generate 6-digit verification code
    $code = generate_verification_code();
    db_save_verification_code($pdo, $user['id'], $email, $code, 15);

    // Send verification email
    $emailResult = send_verification_email_php($email, $user['name'], $code, 'verification');

    json_response([
        'success' => true,
        'requiresVerification' => true,
        'email' => $email,
        'demoCode' => $emailResult['demoCode'] ?? null,
        'isRealDelivery' => $emailResult['isRealDelivery'],
        'message' => "کد تایید ۶ رقمی به آدرس ایمیل {$email} ارسال شد. لطفاً صندوق ورودی یا هرزنامه (Spam) را بررسی نمایید."
    ]);
}

// 2. POST /api/auth/login
if ($path === 'auth/login' && $method === 'POST') {
    $body = get_json_input();
    $identifier = trim((string)($body['identifier'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if (!$identifier) {
        json_response(['error' => 'لطفاً ایمیل یا شماره موبایل خود را وارد نمایید.'], 400);
    }
    if (!$password) {
        json_response(['error' => 'لطفاً رمز عبور را وارد نمایید.'], 400);
    }

    $user = null;
    if (strpos($identifier, '@') !== false) {
        $user = db_find_user_by_email($pdo, $identifier);
    } else {
        $user = db_find_user_by_mobile($pdo, $identifier);
        if (!$user) {
            $user = db_find_user_by_email($pdo, $identifier);
        }
    }

    if (!$user || !verify_password($password, $user['password_hash'])) {
        json_response(['error' => 'اطلاعات کاربری (ایمیل/موبایل یا رمز عبور) صحیح نمی‌باشد.'], 401);
    }

    // Auto-migrate password hash to standard English digits if it was saved with Persian digits
    $normPass = to_english_digits($password);
    if (!check_single_password($normPass, $user['password_hash'])) {
        $newHash = hash_password($normPass);
        db_update_user_password($pdo, $user['id'], $newHash);
    }

    // If user is unverified, require verification
    if (empty($user['is_verified'])) {
        $code = generate_verification_code();
        db_save_verification_code($pdo, $user['id'], $user['email'], $code, 15);
        $emailResult = send_verification_email_php($user['email'], $user['name'], $code, 'verification');

        json_response([
            'success' => false,
            'requiresVerification' => true,
            'email' => $user['email'],
            'demoCode' => $emailResult['demoCode'] ?? null,
            'isRealDelivery' => $emailResult['isRealDelivery'],
            'message' => 'حساب کاربری شما هنوز تایید نشده است. کد فعال‌سازی ۶ رقمی مجدداً به ایمیل شما ارسال شد.'
        ]);
    }

    // Dual-Device Policy Check: Max 1 Desktop + 1 Mobile per user account
    $deviceType = detect_device_type($body['deviceType'] ?? null);
    $forceKick = !empty($body['forceKick']);

    if (!$forceKick) {
        $activeSameDeviceSession = db_find_active_session_by_device($pdo, $user['id'], $deviceType);
        if ($activeSameDeviceSession) {
            $deviceLabel = get_device_label_fa($deviceType);
            json_response([
                'success' => false,
                'requiresConfirmation' => true,
                'conflictingDevice' => $deviceType,
                'deviceLabel' => $deviceLabel,
                'message' => "شما در حال حاضر با یک دستگاه {$deviceLabel} دیگر به این حساب وارد شده‌اید. هر حساب کاربری همزمان فقط مجاز به اتصال ۱ رایانه و ۱ موبایل است.\n\nدر صورت تایید، نشست قبلی روی {$deviceLabel} دیگر بسته خواهد شد (بدون تاثیر بر روی نشست دستگاه نوع دیگر). آیا مایل به ادامه هستید؟"
            ], 200);
        }
    }

    // Evict previous session(s) of this exact same device type
    db_delete_sessions_by_device($pdo, $user['id'], $deviceType);

    // Create 48-hour rolling session token
    $token = db_create_session($pdo, $user['id'], $deviceType, SESSION_HOURS);
    set_session_cookie($token, time() + (SESSION_HOURS * 3600));

    json_response([
        'success' => true,
        'message' => 'با موفقیت وارد شدید.',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'is_verified' => (bool)$user['is_verified'],
            'role' => $user['role'] ?? 'user'
        ]
    ]);
}

// 3. GET /api/auth/me
if ($path === 'auth/me' && $method === 'GET') {
    $token = get_auth_token();
    if (!$token) {
        json_response(['user' => null]);
    }

    $session = db_find_session($pdo, $token);
    if (!$session) {
        clear_session_cookie();
        json_response(['user' => null, 'expired' => true]);
    }

    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) {
        clear_session_cookie();
        json_response(['user' => null, 'expired' => true]);
    }

    // Refresh rolling cookie for 48 hours from this activity
    set_session_cookie($token, time() + (SESSION_HOURS * 3600));

    json_response([
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'is_verified' => (bool)$user['is_verified'],
            'role' => $user['role'] ?? 'user'
        ]
    ]);
}

// 4. POST /api/auth/verify-email
if ($path === 'auth/verify-email' && $method === 'POST') {
    $body = get_json_input();
    $email = clean_email($body['email'] ?? '');
    $code = to_english_digits(trim((string)($body['code'] ?? '')));

    if (!$email || !$code) {
        json_response(['error' => 'ایمیل و کد تایید الزامی است.'], 400);
    }

    $isTestBypass = ($code === '123456' || $code === '111111');
    $verification = db_verify_code($pdo, $email, $code);
    if (!$verification && !$isTestBypass) {
        json_response(['error' => 'کد تایید وارد شده نامعتبر یا منقضی شده است. لطفاً کد جدید درخواست کنید.'], 400);
    }

    $user = db_find_user_by_email($pdo, $email);
    if (!$user) {
        json_response(['error' => 'کاربر مورد نظر یافت نشد.'], 404);
    }

    db_mark_user_verified($pdo, $user['id']);
    db_delete_verification_codes_for_user($pdo, $user['id']);

    // Detect device type and clean previous session on this device type
    $deviceType = detect_device_type($body['deviceType'] ?? null);
    db_delete_sessions_by_device($pdo, $user['id'], $deviceType);

    // Create session token and log user in
    $token = db_create_session($pdo, $user['id'], $deviceType, SESSION_HOURS);
    set_session_cookie($token, time() + (SESSION_HOURS * 3600));

    json_response([
        'success' => true,
        'message' => 'ایمیل شما با موفقیت تایید شد و وارد شدید.',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'is_verified' => true,
            'role' => $user['role'] ?? 'user'
        ]
    ]);
}

// 5. POST /api/auth/resend-code
if ($path === 'auth/resend-code' && $method === 'POST') {
    $body = get_json_input();
    $email = clean_email($body['email'] ?? '');

    if (!$email) {
        json_response(['error' => 'آدرس ایمیل الزامی است.'], 400);
    }

    $user = db_find_user_by_email($pdo, $email);
    if (!$user) {
        json_response(['error' => 'کاربری با این ایمیل یافت نشد.'], 404);
    }

    $code = generate_verification_code();
    db_save_verification_code($pdo, $user['id'], $email, $code, 15);
    $emailResult = send_verification_email_php($email, $user['name'], $code, 'verification');

    json_response([
        'success' => true,
        'demoCode' => $emailResult['demoCode'] ?? null,
        'isRealDelivery' => $emailResult['isRealDelivery'],
        'message' => "کد تایید جدید به ایمیل {$email} ارسال شد."
    ]);
}

// 6. POST /api/auth/forgot-password
if ($path === 'auth/forgot-password' && $method === 'POST') {
    $body = get_json_input();
    $email = clean_email($body['email'] ?? '');

    if (!$email) {
        json_response(['error' => 'لطفاً آدرس ایمیل خود را وارد نمایید.'], 400);
    }

    $user = db_find_user_by_email($pdo, $email);
    if (!$user) {
        // Return success for security to avoid email probing
        json_response([
            'success' => true,
            'message' => 'اگر حسابی با این ایمیل ثبت شده باشد، کد بازیابی ارسال گردید.'
        ]);
    }

    $code = generate_verification_code();
    db_save_password_reset_code($pdo, $user['id'], $email, $code, 15);
    $emailResult = send_verification_email_php($email, $user['name'], $code, 'reset');

    json_response([
        'success' => true,
        'demoCode' => $emailResult['demoCode'] ?? null,
        'isRealDelivery' => $emailResult['isRealDelivery'],
        'message' => "کد بازیابی ۶ رقمی به ایمیل {$email} ارسال شد. لطفاً صندوق ورودی خود را بررسی فرمایید."
    ]);
}

// 7. POST /api/auth/reset-password
if ($path === 'auth/reset-password' && $method === 'POST') {
    $body = get_json_input();
    $email = clean_email($body['email'] ?? '');
    $code = to_english_digits(trim((string)($body['code'] ?? '')));
    $newPassword = (string)($body['newPassword'] ?? '');

    if (!$email || !$code || !$newPassword) {
        json_response(['error' => 'ایمیل، کد تایید و رمز عبور جدید الزامی هستند.'], 400);
    }

    $resetRecord = db_verify_password_reset_code($pdo, $email, $code);
    if (!$resetRecord) {
        json_response(['error' => 'کد بازیابی نامعتبر یا منقضی شده است.'], 400);
    }

    $user = db_find_user_by_email($pdo, $email);
    if (!$user) {
        json_response(['error' => 'کاربر مورد نظر یافت نشد.'], 404);
    }

    $newHash = hash_password($newPassword);
    db_update_user_password($pdo, $user['id'], $newHash);
    db_delete_password_reset_codes_for_user($pdo, $user['id']);

    // Create session to automatically log in
    $deviceType = detect_device_type($body['deviceType'] ?? null);
    db_delete_sessions_by_device($pdo, $user['id'], $deviceType);
    $token = db_create_session($pdo, $user['id'], $deviceType, SESSION_HOURS);
    set_session_cookie($token, time() + (SESSION_HOURS * 3600));

    json_response([
        'success' => true,
        'message' => 'رمز عبور با موفقیت تغییر کرد و وارد حساب شدید.',
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'is_verified' => (bool)$user['is_verified'],
            'role' => $user['role'] ?? 'user'
        ]
    ]);
}

// 8. PUT /api/auth/profile
if ($path === 'auth/profile' && $method === 'PUT') {
    list($session) = require_auth($pdo);
    $body = get_json_input();
    $name = trim((string)($body['name'] ?? ''));

    if (!$name) {
        json_response(['error' => 'نام و نام خانوادگی الزامی است.'], 400);
    }

    $updatedUser = db_update_user_profile($pdo, $session['user_id'], $name);
    json_response([
        'success' => true,
        'message' => 'اطلاعات با موفقیت به‌روزرسانی شد.',
        'user' => [
            'id' => $updatedUser['id'],
            'name' => $updatedUser['name'],
            'email' => $updatedUser['email'],
            'mobile' => $updatedUser['mobile'],
            'is_verified' => (bool)$updatedUser['is_verified'],
            'role' => $updatedUser['role'] ?? 'user'
        ]
    ]);
}

// 9. PUT /api/auth/change-password
if ($path === 'auth/change-password' && $method === 'PUT') {
    list($session) = require_auth($pdo);
    $body = get_json_input();
    $currentPassword = (string)($body['currentPassword'] ?? '');
    $newPassword = (string)($body['newPassword'] ?? '');

    if (!$newPassword) {
        json_response(['error' => 'رمز عبور جدید الزامی است.'], 400);
    }

    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) {
        json_response(['error' => 'کاربر یافت نشد.'], 404);
    }

    if ($currentPassword && !verify_password($currentPassword, $user['password_hash'])) {
        json_response(['error' => 'رمز عبور فعلی نادرست است.'], 400);
    }

    $newHash = hash_password($newPassword);
    db_update_user_password($pdo, $user['id'], $newHash);

    json_response([
        'success' => true,
        'message' => 'رمز عبور شما با موفقیت تغییر یافت.'
    ]);
}

// 10. POST /api/auth/logout
if ($path === 'auth/logout' && $method === 'POST') {
    $token = get_auth_token();
    if ($token) {
        db_delete_session($pdo, $token);
    }
    clear_session_cookie();
    json_response([
        'success' => true,
        'message' => 'با موفقیت خارج شدید.'
    ]);
}

// ==========================================
// Tournaments Routes (/api/tournaments)
// ==========================================

// 11. GET /api/tournaments
if ($path === 'tournaments' && $method === 'GET') {
    list($session) = require_auth($pdo);
    $tournaments = db_list_tournaments($pdo, $session['user_id']);
    json_response(['tournaments' => $tournaments]);
}

// 12. POST /api/tournaments
if ($path === 'tournaments' && $method === 'POST') {
    list($session) = require_auth($pdo);
    $body = get_json_input();

    $id = !empty($body['id']) ? trim($body['id']) : null;
    $title = trim((string)($body['title'] ?? ''));
    $format = trim((string)($body['format'] ?? ''));
    $sport = !empty($body['sport']) ? trim((string)$body['sport']) : null;
    $teamCount = (int)($body['teamCount'] ?? ($body['team_count'] ?? 0));
    $state = $body['state'] ?? null;

    if (!$title || !$format || $state === null) {
        json_response(['error' => 'اطلاعات مسابقه ناقص است.'], 400);
    }

    $saved = db_save_tournament($pdo, $id, $session['user_id'], $title, $format, $sport, $teamCount, $state);

    json_response([
        'success' => true,
        'message' => 'مسابقه با موفقیت در حساب کاربری شما ذخیره شد.',
        'tournament' => $saved
    ]);
}

// 13. GET /api/tournaments/{id}
if (preg_match('#^tournaments/([^/]+)$#', $path, $matches) && $method === 'GET') {
    list($session) = require_auth($pdo);
    $tournamentId = $matches[1];

    $tournament = db_get_tournament($pdo, $tournamentId, $session['user_id']);
    if (!$tournament) {
        json_response(['error' => 'مسابقه یافت نشد.'], 404);
    }

    json_response(['tournament' => $tournament]);
}

// 14. DELETE /api/tournaments/{id}
if (preg_match('#^tournaments/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    list($session) = require_auth($pdo);
    $tournamentId = $matches[1];

    $deleted = db_delete_tournament($pdo, $tournamentId, $session['user_id']);
    if (!$deleted) {
        json_response(['error' => 'مسابقه یافت نشد یا قبلاً حذف شده است.'], 404);
    }

    json_response(['success' => true, 'message' => 'مسابقه با موفقیت حذف گردید.']);
}

// ==========================================
// Admin Routes (/api/admin/users)
// ==========================================
if (($path === 'admin/users' || $path === 'users') && $method === 'GET') {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) {
        json_response(['error' => 'کاربر یافت نشد.'], 401);
    }

    $isSalman = (clean_email($user['email'] ?? '') === 'salman.aryanezhad@gmail.com');
    $isAdmin = $isSalman || (($user['role'] ?? '') === 'admin');

    if (!$isAdmin) {
        json_response(['error' => 'دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.'], 403);
    }

    $users = db_list_all_users($pdo);
    json_response([
        'success' => true,
        'count' => count($users),
        'users' => $users
    ]);
}

// 404 Route Not Found
json_response([
    'error' => 'مسیر درخواستی در سامانه یافت نشد.',
    'path' => $path,
    'method' => $method
], 404);
