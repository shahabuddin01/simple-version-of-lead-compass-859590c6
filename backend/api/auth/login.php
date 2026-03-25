<?php
/**
 * POST /api/auth/login
 * Authenticates user and returns session token
 */

require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$email = filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL);
$password = $data['password'] ?? '';
$ip = $_SERVER['REMOTE_ADDR'];
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

$db = (new Database())->connect();

// Check if IP is blocked
$stmt = $db->prepare(
    "SELECT id FROM security_blocked_ips
     WHERE ip_address = ?
     AND (expires_at > NOW() OR is_permanent = 1)"
);
$stmt->execute([$ip]);
if ($stmt->fetch()) {
    http_response_code(403);
    echo json_encode(['error' => 'Access blocked. Try again later.']);
    exit;
}

// Find user
$stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND is_active = 1");
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    // Log failed attempt
    $stmt = $db->prepare(
        "INSERT INTO security_login_attempts (email_attempted, ip_address, user_agent, was_successful)
         VALUES (?, ?, ?, 0)"
    );
    $stmt->execute([$email, $ip, $userAgent]);

    // Check brute force — 5 failures in 15 min = block for 24h
    $stmt = $db->prepare(
        "SELECT COUNT(*) as attempts FROM security_login_attempts
         WHERE ip_address = ? AND was_successful = 0
         AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
    );
    $stmt->execute([$ip]);
    $row = $stmt->fetch();

    if ($row['attempts'] >= 5) {
        $stmt = $db->prepare(
            "INSERT INTO security_blocked_ips (ip_address, reason, expires_at)
             VALUES (?, 'Too many failed login attempts', DATE_ADD(NOW(), INTERVAL 24 HOUR))"
        );
        $stmt->execute([$ip]);
    }

    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// Invalidate any existing sessions for this user (prevent concurrent sessions)
$db->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$user['id']]);

// Create new session token
$token = bin2hex(random_bytes(32));
$stmt = $db->prepare(
    "INSERT INTO user_sessions (user_id, token, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 8 HOUR))"
);
$stmt->execute([$user['id'], $token, $ip, $userAgent]);

// Log success
$stmt = $db->prepare(
    "INSERT INTO security_login_attempts (email_attempted, ip_address, user_agent, was_successful)
     VALUES (?, ?, ?, 1)"
);
$stmt->execute([$email, $ip, $userAgent]);

// Log activity
$stmt = $db->prepare(
    "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
     VALUES (?, ?, 'login', 'auth', 'Successful login', ?)"
);
$stmt->execute([$user['id'], $user['email'], $ip]);

echo json_encode([
    'token' => $token,
    'user' => [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ],
]);
