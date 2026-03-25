<?php
/**
 * GET    /api/security/blocked-ips — List blocked IPs
 * POST   /api/security/blocked-ips — Block an IP
 * DELETE /api/security/blocked-ips — Unblock an IP
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT * FROM security_blocked_ips ORDER BY blocked_at DESC"
    );
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $ip = filter_var($data['ip_address'] ?? '', FILTER_VALIDATE_IP);
    $reason = htmlspecialchars($data['reason'] ?? 'Manual block');
    $permanent = (bool) ($data['is_permanent'] ?? false);

    if (!$ip) {
        http_response_code(400);
        echo json_encode(['error' => 'Valid IP address required']);
        exit;
    }

    $stmt = $db->prepare(
        "INSERT INTO security_blocked_ips (ip_address, reason, is_permanent, expires_at)
         VALUES (?, ?, ?, ?)"
    );
    $expiresAt = $permanent ? null : date('Y-m-d H:i:s', strtotime('+24 hours'));
    $stmt->execute([$ip, $reason, $permanent ? 1 : 0, $expiresAt]);

    echo json_encode(['success' => true, 'message' => "IP $ip blocked"]);
    exit;
}

if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int) ($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Block ID required']);
        exit;
    }

    $db->prepare("DELETE FROM security_blocked_ips WHERE id = ?")->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
