<?php
/**
 * POST /api/leads/bulk   — Bulk operations (delete, update status, export)
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$user = authenticate();
$db = (new Database())->connect();
$data = json_decode(file_get_contents('php://input'), true);

$action = $data['action'] ?? '';
$ids = $data['ids'] ?? [];

if (empty($ids) || !is_array($ids)) {
    http_response_code(400);
    echo json_encode(['error' => 'No lead IDs provided']);
    exit;
}

// Sanitize IDs
$ids = array_map('intval', $ids);
$placeholders = implode(',', array_fill(0, count($ids), '?'));

switch ($action) {
    case 'delete':
        if (!in_array($user['role'], ['admin', 'manager'])) {
            http_response_code(403);
            echo json_encode(['error' => 'Insufficient permissions']);
            exit;
        }
        $stmt = $db->prepare("DELETE FROM leads WHERE id IN ($placeholders)");
        $stmt->execute($ids);
        $count = $stmt->rowCount();

        $logStmt = $db->prepare(
            "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
             VALUES (?, ?, 'bulk_delete', 'leads', ?, ?)"
        );
        $logStmt->execute([$user['id'], $user['email'], "Bulk deleted $count leads", $_SERVER['REMOTE_ADDR']]);

        echo json_encode(['success' => true, 'deleted' => $count]);
        break;

    case 'update_status':
        $newStatus = $data['status'] ?? '';
        $allowed = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
        if (!in_array($newStatus, $allowed)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid status']);
            exit;
        }
        $params = array_merge([$newStatus], $ids);
        $stmt = $db->prepare("UPDATE leads SET status = ? WHERE id IN ($placeholders)");
        $stmt->execute($params);
        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        break;

    case 'toggle_active':
        $active = $data['is_active'] ? 1 : 0;
        $params = array_merge([$active], $ids);
        $stmt = $db->prepare("UPDATE leads SET is_active = ? WHERE id IN ($placeholders)");
        $stmt->execute($params);
        echo json_encode(['success' => true, 'updated' => $stmt->rowCount()]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => "Unknown bulk action: $action"]);
}
