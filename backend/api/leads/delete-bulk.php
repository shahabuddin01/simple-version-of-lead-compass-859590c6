<?php
/**
 * POST /api/leads/delete-bulk — Admin-only bulk delete
 * Types: selected, page, pages, all
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$user = requireAdmin();
$db = (new Database())->connect();
$data = json_decode(file_get_contents('php://input'), true);
$deleteType = $data['type'] ?? 'selected';
$deleted = 0;

try {
    $db->beginTransaction();

    switch ($deleteType) {
        case 'selected':
            $ids = array_map('intval', $data['ids'] ?? []);
            if (empty($ids)) {
                http_response_code(400);
                echo json_encode(['error' => 'No IDs provided']);
                exit;
            }
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $db->prepare("DELETE FROM leads WHERE id IN ($placeholders)");
            $stmt->execute($ids);
            $deleted = $stmt->rowCount();
            break;

        case 'page':
            $page = max(1, (int)($data['page'] ?? 1));
            $perPage = (int)($data['per_page'] ?? 50);
            $offset = ($page - 1) * $perPage;
            $stmt = $db->prepare("SELECT id FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?");
            $stmt->execute([$perPage, $offset]);
            $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($ids)) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $db->prepare("DELETE FROM leads WHERE id IN ($placeholders)");
                $stmt->execute($ids);
                $deleted = $stmt->rowCount();
            }
            break;

        case 'pages':
            $pages = $data['pages'] ?? [];
            $perPage = (int)($data['per_page'] ?? 50);
            $allIds = [];
            foreach ($pages as $page) {
                $offset = ((int)$page - 1) * $perPage;
                $stmt = $db->prepare("SELECT id FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?");
                $stmt->execute([$perPage, $offset]);
                $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $allIds = array_merge($allIds, $ids);
            }
            if (!empty($allIds)) {
                $allIds = array_unique($allIds);
                $placeholders = implode(',', array_fill(0, count($allIds), '?'));
                $stmt = $db->prepare("DELETE FROM leads WHERE id IN ($placeholders)");
                $stmt->execute(array_values($allIds));
                $deleted = $stmt->rowCount();
            }
            break;

        case 'all':
            $stmt = $db->query("SELECT COUNT(*) FROM leads");
            $deleted = (int)$stmt->fetchColumn();
            $db->exec("DELETE FROM leads");
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid delete type']);
            exit;
    }

    $db->commit();

    // Log activity
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'bulk_delete', 'leads', ?, ?)"
    );
    $logStmt->execute([
        $user['id'],
        $user['email'],
        "Deleted $deleted leads — type: $deleteType",
        $_SERVER['REMOTE_ADDR'] ?? ''
    ]);

    echo json_encode([
        'success' => true,
        'deleted' => $deleted,
        'message' => "$deleted leads deleted successfully"
    ]);

} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Delete failed: ' . $e->getMessage()]);
}
