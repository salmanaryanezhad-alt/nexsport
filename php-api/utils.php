<?php
/**
 * NexSport Utilities & Security Helpers
 */

function to_english_digits($str) {
    if (!$str) return '';
    $persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    $arabic  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    $english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    $str = str_replace($persian, $english, $str);
    $str = str_replace($arabic, $english, $str);
    return $str;
}

function clean_mobile($mobile) {
    $normalized = preg_replace('/[\s-]+/', '', to_english_digits($mobile));
    if (strpos($normalized, '+98') === 0) {
        return '0' . substr($normalized, 3);
    }
    if (strpos($normalized, '0098') === 0) {
        return '0' . substr($normalized, 4);
    }
    return $normalized;
}

function clean_email($email) {
    return strtolower(trim((string)$email));
}

function hash_password($password) {
    $salt = bin2hex(random_bytes(16));
    // 1000 iterations, 64 bytes (128 hex chars in output)
    $hash = hash_pbkdf2('sha256', $password, $salt, 1000, 128);
    return $salt . ':' . $hash;
}

function verify_password($password, $storedHash) {
    if (!$storedHash) return false;
    if (strpos($storedHash, ':') !== false) {
        list($salt, $hash) = explode(':', $storedHash, 2);
        $testHash = hash_pbkdf2('sha256', $password, $salt, 1000, 128);
        return hash_equals($hash, $testHash);
    }
    // Fallback if password_hash() was used or legacy plain string
    if (password_verify($password, $storedHash)) {
        return true;
    }
    return hash_equals($storedHash, $password);
}

function generate_uuid() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function generate_session_token() {
    return bin2hex(random_bytes(32));
}

function generate_verification_code() {
    return (string)random_int(100000, 999999);
}

function get_json_input() {
    $raw = $GLOBALS['__mock_input'] ?? file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST ?: [];
}

function json_response($data, $statusCode = 200) {
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_auth_token() {
    if (!empty($_COOKIE['nexsport_token'])) {
        return trim($_COOKIE['nexsport_token']);
    }
    $headers = getallheaders_custom();
    if (!empty($headers['Authorization'])) {
        $parts = explode(' ', $headers['Authorization']);
        if (count($parts) === 2 && strcasecmp($parts[0], 'Bearer') === 0) {
            return trim($parts[1]);
        }
    }
    return null;
}

function set_session_cookie($token, $expiresAtTimestamp) {
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
    setcookie('nexsport_token', $token, [
        'expires' => $expiresAtTimestamp,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

function clear_session_cookie() {
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
    setcookie('nexsport_token', '', [
        'expires' => time() - 86400,
        'path' => '/',
        'domain' => '',
        'secure' => $isSecure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

function getallheaders_custom() {
    if (function_exists('getallheaders')) {
        return getallheaders();
    }
    $headers = [];
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            $header = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $headers[$header] = $value;
        } elseif ($name == 'CONTENT_TYPE') {
            $headers['Content-Type'] = $value;
        } elseif ($name == 'CONTENT_LENGTH') {
            $headers['Content-Length'] = $value;
        }
    }
    return $headers;
}

function send_verification_email_php($toEmail, $userName, $code, $type = 'verification') {
    $subject = ($type === 'reset')
        ? "NexSport - کد بازیابی رمز عبور: {$code}"
        : "NexSport - کد تایید حساب کاربری: {$code}";

    $title = ($type === 'reset') ? 'بازیابی رمز عبور' : 'تایید ایمیل و فعال‌سازی حساب کاربری';
    $desc = ($type === 'reset')
        ? 'شما یا شخصی دیگر درخواست بازیابی رمز عبور حساب NexSport را ثبت کرده‌اید. کد تایید شما:'
        : 'از ثبت‌نام شما در پلتفرم قرعه‌کشی و مدیریت مسابقات ورزشی NexSport سپاسگزاریم. جهت تایید حساب کد زیر را وارد نمایید:';

    $html = <<<HTML
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="font-family: Tahoma, Arial, sans-serif; background-color: #f6f8fa; margin:0; padding:24px; color:#18181b; direction: rtl;">
  <div style="max-width:540px; margin:0 auto; background:#ffffff; border-radius:16px; border:1px solid #e4e4e7; padding:32px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
    <div style="text-align:center; margin-bottom:24px;">
      <h1 style="font-size:24px; font-weight:900; color:#18181b; margin:0;">NexSport</h1>
      <p style="font-size:12px; color:#71717a; margin-top:4px;">پلتفرم هوشمند مدیریت و قرعه‌کشی مسابقات ورزشی</p>
    </div>
    <div style="background:#f4f4f5; border-radius:12px; padding:20px; text-align:center; margin-bottom:24px;">
      <h2 style="font-size:16px; font-weight:bold; margin-top:0; color:#18181b;">{$title}</h2>
      <p style="font-size:14px; color:#3f3f46; line-height:1.7;">سلام <strong>{$userName}</strong> گرامی،</p>
      <p style="font-size:13px; color:#52525b; line-height:1.7;">{$desc}</p>
      <div style="letter-spacing:8px; font-size:32px; font-weight:900; color:#18181b; background:#ffffff; display:inline-block; padding:12px 28px; border-radius:10px; border:2px dashed #d4d4d8; margin:16px 0;">
        {$code}
      </div>
      <p style="font-size:11px; color:#a1a1aa; margin-bottom:0;">این کد به مدت ۱۵ دقیقه معتبر است.</p>
    </div>
    <div style="text-align:center; font-size:11px; color:#a1a1aa; border-top:1px solid #f4f4f5; padding-top:16px;">
      اگر شما این درخواست را نداده‌اید، می‌توانید این ایمیل را نادیده بگیرید.<br>
      NexSport © 2026 — nexsport.ir
    </div>
  </div>
</body>
</html>
HTML;

    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: NexSport <no-reply@nexsport.ir>',
        'Reply-To: support@nexsport.ir',
        'X-Mailer: PHP/' . phpversion()
    ];

    $delivered = false;
    try {
        if (function_exists('mail')) {
            $delivered = @mail($toEmail, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, implode("\r\n", $headers));
        }
    } catch (\Throwable $e) {
        $delivered = false;
    }

    return [
        'demoCode' => $code,
        'isRealDelivery' => (bool)$delivered
    ];
}
