<?php
/**
 * POST /api/auth/reset-password
 * Handles password reset request and token verification
 */

require_once __DIR__ . '/../../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? 'request'; // 'request' or 'reset'
$db = (new Database())->connect();

if ($action === 'request') {
    // Step 1: User requests a password reset
    $email = filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL);

    $stmt = $db->prepare("SELECT id FROM users WHERE email = ? AND is_active = 1");
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        $token = bin2hex(random_bytes(32));
        $stmt = $db->prepare(
            "INSERT INTO password_reset_tokens (email, token, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))"
        );
        $stmt->execute([$email, $token]);

        // TODO: Send email with reset link via SMTP
        // For now, token is stored in database
        // In production, integrate with SMTP settings to email the link:
        // {APP_URL}/reset-password?token={$token}
    }

    // Always return success to prevent email enumeration
    echo json_encode(['success' => true, 'message' => 'If the email exists, a reset link has been sent.']);

} elseif ($action === 'reset') {
    // Step 2: User submits new password with token
    $token = $data['token'] ?? '';
    $newPassword = $data['password'] ?? '';

    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters']);
        exit;
    }

    $stmt = $db->prepare(
        "SELECT email FROM password_reset_tokens
         WHERE token = ? AND used = 0 AND expires_at > NOW()"
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or expired reset token']);
        exit;
    }

    // Update password
    $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $db->prepare("UPDATE users SET password = ? WHERE email = ?");
    $stmt->execute([$hashedPassword, $row['email']]);

    // Mark token as used
    $stmt = $db->prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?");
    $stmt->execute([$token]);

    // Invalidate all sessions for this user
    $stmt = $db->prepare(
        "DELETE FROM user_sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)"
    );
    $stmt->execute([$row['email']]);

    echo json_encode(['success' => true, 'message' => 'Password updated successfully']);
}
