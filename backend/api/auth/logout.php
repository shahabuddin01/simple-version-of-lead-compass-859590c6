<?php
/**
 * POST /api/auth/logout
 * Destroys user session
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$headers = getallheaders();
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$token = str_replace('Bearer ', '', $authHeader);

$db = (new Database())->connect();
$stmt = $db->prepare("DELETE FROM user_sessions WHERE token = ?");
$stmt->execute([$token]);

echo json_encode(['success' => true, 'message' => 'Logged out']);
