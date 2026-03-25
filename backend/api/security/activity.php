<?php
/**
 * GET /api/security/activity — Get security activity log
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
    "SELECT * FROM security_activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?"
);
$stmt->execute([$limit, $offset]);

$total = (int) $db->query("SELECT COUNT(*) FROM security_activity_log")->fetchColumn();

header("X-Total-Count: $total");
echo json_encode($stmt->fetchAll());
