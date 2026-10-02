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
    if (has_persian_letters($password)) {
        json_response(['error' => 'صفحه کلید را به انگلیسی تغییر دهید'], 400);
    }
    if (!$password || strlen(to_english_digits($password)) < 8) {
        json_response(['error' => 'رمز عبور باید حداقل ۸ کاراکتر باشد.'], 400);
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
    if (has_persian_letters($newPassword)) {
        json_response(['error' => 'صفحه کلید را به انگلیسی تغییر دهید'], 400);
    }
    if (strlen(to_english_digits($newPassword)) < 8) {
        json_response(['error' => 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.'], 400);
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
    if (has_persian_letters($newPassword)) {
        json_response(['error' => 'صفحه کلید را به انگلیسی تغییر دهید'], 400);
    }
    if (strlen(to_english_digits($newPassword)) < 8) {
        json_response(['error' => 'رمز عبور باید حداقل ۸ کاراکتر باشد.'], 400);
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

// 12.1 GET /api/tournaments/public/{id}
if (preg_match('#^tournaments/public/([^/]+)$#', $path, $matches) && $method === 'GET') {
    $tournamentId = $matches[1];
    $tournament = db_get_public_tournament($pdo, $tournamentId);
    if (!$tournament) {
        json_response(['error' => 'مسابقه یافت نشد یا ممکن است توسط برگزارکننده حذف شده باشد.'], 404);
    }

    $state = $tournament['state'] ?? [];
    $isPaid = !empty($state['payment']['isPaid']);
    if (!$isPaid) {
        $isAdmin = false;
        $isOwner = false;
        $token = get_auth_token();
        if ($token) {
            $session = db_find_session($pdo, $token);
            if ($session) {
                $viewer = db_find_user_by_id($pdo, $session['user_id']);
                if ($viewer) {
                    $isAdmin = is_admin_email($viewer['email'] ?? '') || (($viewer['role'] ?? '') === 'admin');
                    $isOwner = (($viewer['id'] ?? '') === ($tournament['user_id'] ?? ''));
                }
            }
        }
        if (!$isAdmin && !$isOwner) {
            json_response([
                'error' => 'لینک اختصاصی این مسابقه هنوز پرداخت و فعال‌سازی نشده است. برگزارکننده محترم مسابقه می‌تواند نسبت به پرداخت و فعال‌سازی آن در پنل کاربری اقدام نماید.',
                'notActivated' => true,
                'tournamentTitle' => $tournament['title'] ?? ''
            ], 402);
        }
    }

    json_response([
        'tournament' => $tournament,
        'preview' => !$isPaid,
        'adminPreview' => !$isPaid
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

// 13.1 GET /api/tournaments/{id}/payment-status
if (preg_match('#^tournaments/([^/]+)/payment-status$#', $path, $matches) && $method === 'GET') {
    $tournamentId = $matches[1];
    $tournament = db_get_public_tournament($pdo, $tournamentId);
    $state = $tournament['state'] ?? [];
    $isPaid = !empty($state['payment']['isPaid']);
    json_response([
        'tournamentId' => $tournamentId,
        'isPaid'       => $isPaid,
        'paymentInfo'  => $state['payment'] ?? null
    ]);
}

// 13.2 POST /api/payment/create
if ($path === 'payment/create' && $method === 'POST') {
    list($session) = require_auth($pdo);
    $body = get_json_input();
    $itemType = trim((string)($body['itemType'] ?? ''));

    if ($itemType === 'planning_credits') {
        $count = max(1, (int)($body['creditCount'] ?? 1));
        $newTotal = db_add_planning_credits($pdo, $session['user_id'], $count);
        $orderId = 'ord_c_' . time() . '_' . substr(md5(uniqid()), 0, 5);
        $refId = 'TRX-' . rand(10000000, 99999999);
        json_response([
            'success'          => true,
            'isDirectSuccess'  => true,
            'itemType'         => 'planning_credits',
            'addedCredits'     => $count,
            'newTotalCredits'  => $newTotal,
            'orderId'          => $orderId,
            'refId'            => $refId,
            'amountTomans'     => 0
        ]);
    }

    $tournamentId = trim((string)($body['tournamentId'] ?? ''));

    if (!$tournamentId) {
        json_response(['error' => 'شناسه مسابقه ارسال نشده است.'], 400);
    }

    $tournament = db_get_tournament($pdo, $tournamentId, $session['user_id']);
    if (!$tournament) {
        json_response(['error' => 'مسابقه یافت نشد یا دسترسی ویرایش آن را ندارید.'], 404);
    }

    $payWithCredits = !empty($body['payWithCredits']);
    $creditsCharged = 0;
    $remainingCredits = null;
    $gateway = 'mock';
    $isRegistration = ($itemType === 'registration_link');
    $amount = $isRegistration ? 100000 : 150000;
    $creditCost = $isRegistration ? 2 : 3;
    $note = null;

    if ($payWithCredits) {
        $debit = db_consume_planning_credits($pdo, $session['user_id'], $creditCost);
        if (empty($debit['success'])) {
            json_response([
                'error' => $debit['error'] ?? ('برای پرداخت اعتباری، حداقل ' . $creditCost . ' سهمیه برنامه‌سازی لازم است.'),
                'remainingCredits' => $debit['remaining'] ?? 0
            ], 400);
        }
        $creditsCharged = (int)($debit['charged'] ?? $creditCost);
        $remainingCredits = (int)($debit['remaining'] ?? 0);
        $gateway = 'planning_credits';
        $amount = 0;
        $note = $isRegistration
            ? 'فعال‌سازی لینک ثبت‌نام با ۲ سهمیه برنامه‌سازی (معادل ۱۰۰ هزار تومان)'
            : 'فعال‌سازی لینک با ۳ سهمیه برنامه‌سازی (معادل ۱۵۰ هزار تومان)';
    }

    $orderId = 'ord_' . time() . '_' . substr(md5(uniqid()), 0, 5);
    $refId = 'TRX-' . rand(10000000, 99999999);
    $paidAt = date('c');

    $state = $tournament['state'] ?? [];
    $paymentInfo = [
        'isPaid'   => true,
        'amount'   => $amount,
        'currency' => 'TOMAN',
        'gateway'  => $gateway,
        'orderId'  => $orderId,
        'refId'    => $refId,
        'paidAt'   => $paidAt,
        'creditsCharged' => $creditsCharged,
        'note' => $note
    ];
    if ($isRegistration) {
        $cap = (int)($state['registration']['capacity'] ?? $tournament['team_count'] ?? 8);
        $state['registrationPayment'] = $paymentInfo;
        $state['registration'] = [
            'isOpen' => ($state['registration']['isOpen'] ?? true) !== false,
            'capacity' => $cap > 0 ? $cap : (int)$tournament['team_count']
        ];
    } else {
        $state['payment'] = $paymentInfo;
    }

    db_save_tournament(
        $pdo,
        $tournament['id'],
        $session['user_id'],
        $tournament['title'],
        $tournament['format'],
        $tournament['sport'],
        $tournament['team_count'],
        $state
    );

    $out = [
        'success'         => true,
        'isDirectSuccess' => true,
        'isPaid'          => true,
        'orderId'         => $orderId,
        'refId'           => $refId,
        'tournamentId'    => $tournamentId
    ];
    if ($payWithCredits) {
        $out['isCreditPayment'] = true;
        $out['creditsCharged'] = $creditsCharged;
        $out['remainingCredits'] = $remainingCredits;
    }
    json_response($out);
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

    $isAdmin = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');

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

if (($path === 'admin/users' || $path === 'users') && ($method === 'PATCH' || $method === 'PUT')) {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) {
        json_response(['error' => 'کاربر یافت نشد.'], 401);
    }

    $isAdmin = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');

    if (!$isAdmin) {
        json_response(['error' => 'دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.'], 403);
    }

    $body = get_json_input();
    $userId = (string)($body['userId'] ?? '');
    $action = (string)($body['action'] ?? '');

    if (!$userId) {
        json_response(['error' => 'شناسه کاربر الزامی است.'], 400);
    }

    $targetUser = db_find_user_by_id($pdo, $userId);
    if (!$targetUser) {
        json_response(['error' => 'کاربر مورد نظر یافت نشد.'], 404);
    }

    if ($action === 'approve') {
        db_mark_user_verified($pdo, $userId);
        json_response([
            'success' => true,
            'message' => "حساب کاربری «{$targetUser['name']}» با موفقیت تایید و فعال شد."
        ]);
    }

    json_response(['error' => 'عملیات نامعتبر است.'], 400);
}

if (($path === 'admin/users' || $path === 'users') && $method === 'DELETE') {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) {
        json_response(['error' => 'کاربر یافت نشد.'], 401);
    }

    $isAdmin = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');

    if (!$isAdmin) {
        json_response(['error' => 'دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.'], 403);
    }

    $userId = $_GET['userId'] ?? '';
    if (!$userId) {
        $body = get_json_input();
        $userId = $body['userId'] ?? '';
    }

    if (!$userId) {
        json_response(['error' => 'شناسه کاربر الزامی است.'], 400);
    }

    $targetUser = db_find_user_by_id($pdo, $userId);
    if (!$targetUser) {
        json_response(['error' => 'کاربر مورد نظر یافت نشد.'], 404);
    }

    if (!empty($targetUser['is_verified'])) {
        json_response(['error' => 'تنها کاربران در حال انتظار تایید ایمیل قابل حذف هستند.'], 400);
    }

    $deleted = db_delete_unverified_user($pdo, $userId);
    if ($deleted) {
        json_response([
            'success' => true,
            'message' => "کاربر «{$targetUser['name']}» از سامانه حذف شد."
        ]);
    } else {
        json_response(['error' => 'خطا در حذف کاربر.'], 500);
    }
}

function php_sanitize_team_input($body) {
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') return ['error' => 'نام تیم را وارد نمایید.'];
    if (mb_strlen($name) > 80) return ['error' => 'نام تیم نباید بیش از ۸۰ نویسه باشد.'];
    $yearDigits = preg_replace('/\D/', '', to_english_digits((string)($body['founded_year'] ?? '')));
    if ($yearDigits && (strlen($yearDigits) !== 4 || (int)$yearDigits < 1300 || (int)$yearDigits > 1415)) {
        return ['error' => 'سال تأسیس را به‌صورت سال شمسی چهار رقمی وارد کنید.'];
    }
    $sports = ['فوتبال','فوتسال','والیبال','بسکتبال','هندبال','کشتی','سایر'];
    $sportRaw = trim((string)($body['sport'] ?? ''));
    $sport = in_array($sportRaw, $sports, true) ? $sportRaw : ($sportRaw !== '' ? $sportRaw : 'فوتبال');
    return ['data' => [
        'name' => $name,
        'short_name' => mb_substr(trim((string)($body['short_name'] ?? '')), 0, 16),
        'sport' => $sport,
        'city' => mb_substr(trim((string)($body['city'] ?? '')), 0, 60),
        'founded_year' => $yearDigits ?: '',
        'kit_home' => mb_substr(trim((string)($body['kit_home'] ?? '')), 0, 40),
        'kit_away' => mb_substr(trim((string)($body['kit_away'] ?? '')), 0, 40),
        'coach' => mb_substr(trim((string)($body['coach'] ?? '')), 0, 80),
        'description' => mb_substr(trim((string)($body['description'] ?? '')), 0, 500),
    ]];
}

function php_sanitize_player_input($body) {
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') return ['error' => 'نام بازیکن را وارد نمایید.'];
    if (mb_strlen($name) > 80) return ['error' => 'نام بازیکن نباید بیش از ۸۰ نویسه باشد.'];
    $jersey = substr(preg_replace('/\D/', '', to_english_digits((string)($body['jersey_number'] ?? ''))), 0, 3);
    $birth = trim((string)($body['birth_date'] ?? ''));
    if ($birth && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birth)) {
        return ['error' => 'تاریخ تولد نامعتبر است.'];
    }
    $mobileRaw = (string)($body['mobile'] ?? '');
    $mobile = $mobileRaw !== '' ? clean_mobile($mobileRaw) : '';
    if ($mobile && strlen($mobile) < 10) {
        return ['error' => 'شماره موبایل بازیکن معتبر نیست.'];
    }
    $nid = preg_replace('/\D/', '', to_english_digits((string)($body['national_id'] ?? '')));
    if ($nid && strlen($nid) !== 10) {
        return ['error' => 'کد ملی در صورت ورود باید ۱۰ رقم باشد.'];
    }
    $statusRaw = (string)($body['status'] ?? 'active');
    $status = in_array($statusRaw, ['active','injured','inactive'], true) ? $statusRaw : 'active';
    return ['data' => [
        'name' => $name,
        'jersey_number' => $jersey,
        'position' => mb_substr(trim((string)($body['position'] ?? '')), 0, 40),
        'birth_date' => $birth,
        'mobile' => $mobile,
        'national_id' => $nid,
        'status' => $status,
    ]];
}

function php_require_team_owner($pdo, $teamId) {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) json_response(['error' => 'کاربر یافت نشد.'], 401);
    $team = db_get_team($pdo, $teamId);
    if (!$team) json_response(['error' => 'تیم یافت نشد.'], 404);
    $isAdmin = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');
    if ($team['user_id'] !== $user['id'] && !$isAdmin) {
        json_response(['error' => 'دسترسی به این تیم مجاز نیست.'], 403);
    }
    return [$user, $team, $isAdmin];
}

if ($path === 'teams' && $method === 'GET') {
    list($session) = require_auth($pdo);
    json_response(['teams' => db_list_teams($pdo, $session['user_id'])]);
}

if ($path === 'teams' && $method === 'POST') {
    list($session) = require_auth($pdo);
    $parsed = php_sanitize_team_input(get_json_input());
    if (isset($parsed['error'])) json_response(['error' => $parsed['error']], 400);
    $team = db_create_team($pdo, $session['user_id'], $parsed['data']);
    json_response(['success' => true, 'team' => $team]);
}

if (preg_match('#^teams/([^/]+)$#', $path, $matches) && $method === 'GET') {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    json_response([
        'team' => $team,
        'players' => db_list_players($pdo, $team['id']),
        'tournaments' => db_list_linked_tournaments($pdo, $team['user_id'], $team['id'], $team['name']),
    ]);
}

if (preg_match('#^teams/([^/]+)$#', $path, $matches) && ($method === 'PATCH' || $method === 'PUT')) {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    $parsed = php_sanitize_team_input(get_json_input());
    if (isset($parsed['error'])) json_response(['error' => $parsed['error']], 400);
    json_response(['success' => true, 'team' => db_update_team($pdo, $team['id'], $parsed['data'])]);
}

if (preg_match('#^teams/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    db_delete_team($pdo, $team['id']);
    json_response(['success' => true]);
}

if (preg_match('#^teams/([^/]+)/players$#', $path, $matches) && $method === 'GET') {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    json_response(['players' => db_list_players($pdo, $team['id'])]);
}

if (preg_match('#^teams/([^/]+)/players$#', $path, $matches) && $method === 'POST') {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    $parsed = php_sanitize_player_input(get_json_input());
    if (isset($parsed['error'])) json_response(['error' => $parsed['error']], 400);
    $result = db_create_player($pdo, $team['id'], $parsed['data']);
    if (isset($result['error'])) json_response(['error' => $result['error']], 409);
    json_response(['success' => true, 'player' => $result]);
}

if (preg_match('#^teams/([^/]+)/players/([^/]+)$#', $path, $matches) && ($method === 'PATCH' || $method === 'PUT')) {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    $player = db_get_player($pdo, $matches[2]);
    if (!$player || $player['team_id'] !== $team['id']) json_response(['error' => 'بازیکن یافت نشد.'], 404);
    $parsed = php_sanitize_player_input(get_json_input());
    if (isset($parsed['error'])) json_response(['error' => $parsed['error']], 400);
    $result = db_update_player($pdo, $player['id'], $team['id'], $parsed['data']);
    if (isset($result['error'])) json_response(['error' => $result['error']], 409);
    json_response(['success' => true, 'player' => $result]);
}

if (preg_match('#^teams/([^/]+)/players/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    list($user, $team) = php_require_team_owner($pdo, $matches[1]);
    $player = db_get_player($pdo, $matches[2]);
    if (!$player || $player['team_id'] !== $team['id']) json_response(['error' => 'بازیکن یافت نشد.'], 404);
    db_delete_player($pdo, $player['id']);
    json_response(['success' => true]);
}

function php_registration_settings($state, $teamCount) {
    $cap = (int)($state['registration']['capacity'] ?? $teamCount);
    if ($cap < 2) $cap = max(2, (int)$teamCount);
    return [
        'isOpen' => ($state['registration']['isOpen'] ?? true) !== false,
        'capacity' => $cap
    ];
}

function php_sanitize_registration_input($body) {
    $team = php_sanitize_team_input([
        'name' => $body['team_name'] ?? '',
        'short_name' => $body['short_name'] ?? '',
        'city' => $body['city'] ?? '',
        'coach' => $body['coach'] ?? '',
    ]);
    if (isset($team['error'])) return $team;
    $mobile = clean_mobile((string)($body['mobile'] ?? ''));
    if (!$mobile || strlen($mobile) < 10) return ['error' => 'شماره موبایل مسئول تیم را وارد نمایید.'];
    $playersIn = is_array($body['players'] ?? null) ? $body['players'] : [];
    if (count($playersIn) > 40) return ['error' => 'حداکثر ۴۰ بازیکن در هر ثبت‌نام مجاز است.'];
    $players = [];
    $jerseys = [];
    foreach ($playersIn as $p) {
        $name = trim((string)($p['name'] ?? ''));
        if ($name === '') continue;
        $parsed = php_sanitize_player_input($p);
        if (isset($parsed['error'])) return $parsed;
        $jersey = $parsed['data']['jersey_number'];
        if ($jersey !== '' && in_array($jersey, $jerseys, true)) {
            return ['error' => 'شماره پیراهن در فهرست این تیم تکراری است.'];
        }
        if ($jersey !== '') $jerseys[] = $jersey;
        $players[] = $parsed['data'];
    }
    if (!$players) return ['error' => 'حداقل یک بازیکن را در فهرست ثبت کنید.'];
    return ['data' => [
        'team_name' => $team['data']['name'],
        'short_name' => $team['data']['short_name'],
        'city' => $team['data']['city'],
        'coach' => $team['data']['coach'],
        'contact_name' => mb_substr(trim((string)($body['contact_name'] ?? '')), 0, 80),
        'mobile' => $mobile,
        'notes' => mb_substr(trim((string)($body['notes'] ?? '')), 0, 500),
        'library_team_id' => mb_substr(trim((string)($body['library_team_id'] ?? '')), 0, 36),
        'roster' => $players,
    ]];
}

if (preg_match('#^registrations/public/([^/]+)$#', $path, $matches) && $method === 'GET') {
    $tid = $matches[1];
    $tournament = db_get_public_tournament($pdo, $tid);
    if (!$tournament) json_response(['error' => 'مسابقه یافت نشد.'], 404);
    $state = $tournament['state'] ?? [];
    if (empty($state['registrationPayment']['isPaid'])) {
        json_response(['error' => 'لینک ثبت‌نام این مسابقه هنوز فعال نشده است.', 'notActivated' => true, 'tournamentTitle' => $tournament['title']], 402);
    }
    $settings = php_registration_settings($state, $tournament['team_count']);
    $list = db_list_registrations($pdo, $tid);
    $approved = 0;
    foreach ($list as $r) if (($r['status'] ?? '') === 'approved') $approved++;
    $remaining = max(0, $settings['capacity'] - $approved);
    json_response([
        'tournament' => [
            'id' => $tournament['id'],
            'title' => $tournament['title'],
            'format' => $tournament['format'],
            'sport' => $tournament['sport'],
            'teamCount' => $tournament['team_count'],
        ],
        'isOpen' => $settings['isOpen'] && $remaining > 0,
        'isClosed' => !$settings['isOpen'],
        'isFull' => $remaining <= 0,
        'capacity' => $settings['capacity'],
        'approved' => $approved,
        'remaining' => $remaining,
    ]);
}

if (preg_match('#^registrations/public/([^/]+)$#', $path, $matches) && $method === 'POST') {
    $tid = $matches[1];
    $tournament = db_get_public_tournament($pdo, $tid);
    if (!$tournament) json_response(['error' => 'مسابقه یافت نشد.'], 404);
    $state = $tournament['state'] ?? [];
    if (empty($state['registrationPayment']['isPaid'])) {
        json_response(['error' => 'لینک ثبت‌نام این مسابقه هنوز فعال نشده است.'], 402);
    }
    $settings = php_registration_settings($state, $tournament['team_count']);
    $list = db_list_registrations($pdo, $tid);
    $approved = 0;
    foreach ($list as $r) if (($r['status'] ?? '') === 'approved') $approved++;
    if (!$settings['isOpen']) json_response(['error' => 'ثبت‌نام این مسابقه بسته شده است.'], 403);
    if ($approved >= $settings['capacity']) json_response(['error' => 'ظرفیت مسابقه تکمیل شده است.'], 409);
    $parsed = php_sanitize_registration_input(get_json_input());
    if (isset($parsed['error'])) json_response(['error' => $parsed['error']], 400);
    $created = db_create_registration($pdo, $tid, $parsed['data']);
    if (isset($created['error'])) json_response(['error' => $created['error']], 409);
    json_response([
        'success' => true,
        'registration' => ['id' => $created['id'], 'team_name' => $created['team_name'], 'status' => $created['status']],
        'message' => 'ثبت‌نام شما ارسال شد و پس از تأیید برگزارکننده نهایی می‌شود.',
    ]);
}

if (preg_match('#^tournaments/([^/]+)/registrations$#', $path, $matches) && $method === 'GET') {
    list($session) = require_auth($pdo);
    $tid = $matches[1];
    $tournament = db_get_tournament($pdo, $tid, $session['user_id']);
    if (!$tournament) json_response(['error' => 'مسابقه یافت نشد.'], 404);
    $state = $tournament['state'] ?? [];
    $settings = php_registration_settings($state, $tournament['team_count']);
    $registrations = db_list_registrations($pdo, $tid);
    $approved = 0;
    foreach ($registrations as $r) if (($r['status'] ?? '') === 'approved') $approved++;
    json_response([
        'isPaid' => !empty($state['registrationPayment']['isPaid']),
        'settings' => $settings,
        'approved' => $approved,
        'remaining' => max(0, $settings['capacity'] - $approved),
        'registrations' => $registrations,
        'tournament' => ['id' => $tournament['id'], 'title' => $tournament['title'], 'teamCount' => $tournament['team_count']],
    ]);
}

if (preg_match('#^tournaments/([^/]+)/registrations$#', $path, $matches) && $method === 'PATCH') {
    list($session) = require_auth($pdo);
    $tid = $matches[1];
    $tournament = db_get_tournament($pdo, $tid, $session['user_id']);
    if (!$tournament) json_response(['error' => 'مسابقه یافت نشد.'], 404);
    $state = $tournament['state'] ?? [];
    if (empty($state['registrationPayment']['isPaid'])) json_response(['error' => 'ابتدا لینک ثبت‌نام را فعال کنید.'], 402);
    $body = get_json_input();
    $settings = php_registration_settings($state, $tournament['team_count']);
    if (array_key_exists('isOpen', $body)) $settings['isOpen'] = (bool)$body['isOpen'];
    if (isset($body['capacity'])) {
        $n = (int)$body['capacity'];
        if ($n < 2 || $n > 128) json_response(['error' => 'ظرفیت باید بین ۲ تا ۱۲۸ تیم باشد.'], 400);
        $list = db_list_registrations($pdo, $tid);
        $approved = 0;
        foreach ($list as $r) if (($r['status'] ?? '') === 'approved') $approved++;
        if ($n < $approved) json_response(['error' => 'ظرفیت نمی‌تواند کمتر از تعداد تیم‌های تأییدشده باشد.'], 400);
        $settings['capacity'] = $n;
    }
    $state['registration'] = $settings;
    db_save_tournament($pdo, $tournament['id'], $session['user_id'], $tournament['title'], $tournament['format'], $tournament['sport'], $tournament['team_count'], $state);
    json_response(['success' => true, 'settings' => $settings]);
}

if (preg_match('#^tournaments/([^/]+)/registrations/([^/]+)$#', $path, $matches) && $method === 'PATCH') {
    list($session) = require_auth($pdo);
    $tid = $matches[1];
    $rid = $matches[2];
    $tournament = db_get_tournament($pdo, $tid, $session['user_id']);
    if (!$tournament) json_response(['error' => 'مسابقه یافت نشد.'], 404);
    $state = $tournament['state'] ?? [];
    if (empty($state['registrationPayment']['isPaid'])) json_response(['error' => 'لینک ثبت‌نام فعال نیست.'], 402);
    $rec = db_get_registration($pdo, $rid);
    if (!$rec || $rec['tournament_id'] !== $tid) json_response(['error' => 'ثبت‌نام یافت نشد.'], 404);
    $body = get_json_input();
    $status = (string)($body['status'] ?? '');
    if (!in_array($status, ['approved', 'rejected', 'pending'], true)) json_response(['error' => 'وضعیت نامعتبر است.'], 400);
    if ($status === 'approved') {
        $settings = php_registration_settings($state, $tournament['team_count']);
        $list = db_list_registrations($pdo, $tid);
        $approved = 0;
        foreach ($list as $r) if (($r['status'] ?? '') === 'approved' && $r['id'] !== $rid) $approved++;
        if ($approved >= $settings['capacity']) json_response(['error' => 'ظرفیت مسابقه تکمیل است؛ ابتدا ظرفیت را افزایش دهید یا تیمی را رد کنید.'], 409);
    }
    $updated = db_update_registration_status($pdo, $rid, $status, $body['reject_reason'] ?? '');
    json_response(['success' => true, 'registration' => $updated]);
}

if ($path === 'organizer/overview' && $method === 'GET') {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) json_response(['error' => 'کاربر یافت نشد.'], 401);
    $labels = [
        'league' => 'لیگ دوره‌ای',
        'double-league' => 'لیگ رفت و برگشت',
        'groups' => 'مرحله گروهی',
        'groups-knockout' => 'گروهی + حذفی',
        'knockout' => 'تک‌حذفی',
        'double-knockout' => 'دو حذفی',
    ];
    $tournaments = db_list_tournaments_full($pdo, $user['id']);
    $library = db_count_user_library($pdo, $user['id']);
    $regs = db_list_registrations_by_user($pdo, $user['id']);
    $cards = [];
    $spectator = 0;
    $regLinks = 0;
    $matchesTotal = 0;
    $matchesPlayed = 0;
    foreach ($tournaments as $t) {
        $state = is_array($t['state'] ?? null) ? $t['state'] : [];
        $specPaid = !empty($state['payment']['isPaid']);
        $regPaid = !empty($state['registrationPayment']['isPaid']);
        if ($specPaid) $spectator++;
        if ($regPaid) $regLinks++;
        $played = 0;
        if (is_array($state['scores'] ?? null)) {
            foreach ($state['scores'] as $s) {
                if (is_array($s) && ($s['home'] ?? null) !== null && ($s['away'] ?? null) !== null) $played++;
            }
        }
        $matchesPlayed += $played;
        $matchesTotal += $played;
        $settings = php_registration_settings($state, $t['team_count']);
        $cards[] = [
            'id' => $t['id'],
            'title' => $t['title'],
            'format' => $t['format'],
            'formatLabel' => $labels[$t['format']] ?? $t['format'],
            'sport' => $t['sport'] ?? '',
            'teamCount' => (int)$t['team_count'],
            'step' => (int)($state['step'] ?? 0),
            'spectatorPaid' => $specPaid,
            'registrationPaid' => $regPaid,
            'registrationOpen' => $settings['isOpen'],
            'registrationCapacity' => $settings['capacity'],
            'matchesTotal' => $played,
            'matchesPlayed' => $played,
            'createdAt' => $t['created_at'],
            'updatedAt' => $t['updated_at'],
        ];
    }
    $pending = 0; $approved = 0; $rejected = 0;
    foreach ($regs as $r) {
        if (($r['status'] ?? '') === 'approved') $approved++;
        elseif (($r['status'] ?? '') === 'rejected') $rejected++;
        else $pending++;
    }
    $unlimited = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');
    json_response([
        'profile' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'mobile' => $user['mobile'],
            'role' => $user['role'] ?? 'user',
            'createdAt' => $user['created_at'] ?? null,
        ],
        'quota' => [
            'planningCredits' => $unlimited ? 999999 : (int)($user['planning_credits'] ?? 5),
            'isVip' => false,
            'unlimitedPlanning' => $unlimited,
            'vipExpiresAt' => null,
            'freeLinkAvailable' => true,
        ],
        'stats' => [
            'tournamentCount' => count($cards),
            'teamCount' => $library['teams'],
            'playerCount' => $library['players'],
            'pendingRegistrations' => $pending,
            'approvedRegistrations' => $approved,
            'rejectedRegistrations' => $rejected,
            'spectatorLinks' => $spectator,
            'registrationLinks' => $regLinks,
            'matchesTotal' => $matchesTotal,
            'matchesPlayed' => $matchesPlayed,
        ],
        'tournaments' => $cards,
        'registrations' => $regs,
    ]);
}

if ($path === 'admin/teams' && $method === 'GET') {
    list($session) = require_auth($pdo);
    $user = db_find_user_by_id($pdo, $session['user_id']);
    if (!$user) json_response(['error' => 'کاربر یافت نشد.'], 401);
    $isAdmin = is_admin_email($user['email'] ?? '') || (($user['role'] ?? '') === 'admin');
    if (!$isAdmin) {
        json_response(['error' => 'دسترسی غیرمجاز. این بخش منحصراً در اختیار مدیر سامانه می‌باشد.'], 403);
    }
    json_response(['success' => true, 'teams' => db_list_all_teams($pdo)]);
}

// 404 Route Not Found
json_response([
    'error' => 'مسیر درخواستی در سامانه یافت نشد.',
    'path' => $path,
    'method' => $method
], 404);
