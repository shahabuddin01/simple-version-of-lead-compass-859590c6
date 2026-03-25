<?php
/**
 * GET /api/security/login-attempts — Get login attempt log
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$limit = min(max((int) ($_GET['limit'] ?? 100), 1), 500);
$offset = max((int) ($_GET['offset'] ?? 0), 0);

$stmt = $db->prepare(
    "SELECT * FROM security_login_attempts ORDER BY attempted_at DESC LIMIT ? OFFSET ?"
);
$stmt->execute([$limit, $offset]);

$total = (int) $db->query("SELECT COUNT(*) FROM security_login_attempts")->fetchColumn();

header("X-Total-Count: $total");
echo json_encode($stmt->fetchAll());
