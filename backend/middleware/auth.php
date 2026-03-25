<?php
/**
 * Authentication Middleware — validates session tokens
 */

require_once __DIR__ . '/../config/database.php';

function authenticate() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    $token = str_replace('Bearer ', '', $authHeader);

    if (empty($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized — no token provided']);
        exit;
    }

    $db = (new Database())->connect();

    // Clean expired sessions
    $db->exec("DELETE FROM user_sessions WHERE expires_at < NOW()");

    $stmt = $db->prepare(
        "SELECT u.id, u.name, u.email, u.role, u.is_active
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > NOW() AND u.is_active = 1"
    );
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Session expired or invalid']);
        exit;
    }

    return $user;
}

function requireRole($roles) {
    $user = authenticate();
    if (!in_array($user['role'], (array) $roles)) {
        http_response_code(403);
        echo json_encode(['error' => 'Insufficient permissions']);
        exit;
    }
    return $user;
}

function requireAdmin() {
    return requireRole('admin');
}

function requireAdminOrManager() {
    return requireRole(['admin', 'manager']);
}
