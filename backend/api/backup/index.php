<?php
/**
 * GET  /api/backup       — List recent backups
 * POST /api/backup       — Create a new backup
 * GET  /api/backup/{id}  — Download backup data
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT id, created_at, file_size_kb, record_count, status
         FROM backup_logs ORDER BY created_at DESC LIMIT 10"
    );
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    // Export all leads
    $leadsStmt = $db->query("SELECT * FROM leads");
    $leads = $leadsStmt->fetchAll();

    $usersStmt = $db->query("SELECT id, name, email, role, is_active, created_at FROM users");
    $users = $usersStmt->fetchAll();

    $cacheStmt = $db->query("SELECT * FROM email_verification_cache WHERE expires_at > NOW()");
    $cache = $cacheStmt->fetchAll();

    $backupPayload = [
        'leads' => $leads,
        'users' => $users,
        'email_verification_cache' => $cache,
        'exported_at' => date('c'),
        'version' => '1.0.0',
    ];

    $jsonStr = json_encode($backupPayload, JSON_PRETTY_PRINT);
    $sizeKb = (int) ceil(strlen($jsonStr) / 1024);

    // Save to backup_logs
    $stmt = $db->prepare(
        "INSERT INTO backup_logs (file_size_kb, record_count, status, backup_data)
         VALUES (?, ?, 'success', ?)"
    );
    $stmt->execute([$sizeKb, count($leads), $jsonStr]);

    // Cleanup: keep only last 4
    $allStmt = $db->query("SELECT id FROM backup_logs ORDER BY created_at DESC");
    $all = $allStmt->fetchAll();
    if (count($all) > 4) {
        $toDelete = array_slice(array_column($all, 'id'), 4);
        $placeholders = implode(',', array_fill(0, count($toDelete), '?'));
        $db->prepare("DELETE FROM backup_logs WHERE id IN ($placeholders)")->execute($toDelete);
    }

    // Log
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'backup', 'system', ?, ?)"
    );
    $logStmt->execute([$user['id'], $user['email'], "Manual backup: {$sizeKb}KB, " . count($leads) . " leads", $_SERVER['REMOTE_ADDR']]);

    echo json_encode([
        'success' => true,
        'file_size_kb' => $sizeKb,
        'record_count' => count($leads),
        'backup_date' => date('c'),
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
