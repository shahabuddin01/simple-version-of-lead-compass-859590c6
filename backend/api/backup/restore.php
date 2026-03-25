<?php
/**
 * POST /api/backup/restore — Restore leads from backup data
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$backupData = $input['backup_data'] ?? null;
$mode = $input['mode'] ?? 'overwrite'; // overwrite or merge
$restoreLeads = $input['restore_leads'] ?? true;
$restoreCache = $input['restore_cache'] ?? true;

if (!$backupData || !isset($backupData['leads']) || !is_array($backupData['leads'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid backup data — missing leads array']);
    exit;
}

if (count($backupData['leads']) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Backup contains no leads']);
    exit;
}

$leads = $backupData['leads'];
$restored = 0;
$skipped = 0;

try {
    $db->beginTransaction();

    if ($mode === 'overwrite' && $restoreLeads) {
        $db->exec("DELETE FROM leads");
    }

    foreach ($leads as $lead) {
        if ($mode === 'merge' && !empty($lead['work_email'])) {
            $stmt = $db->prepare("SELECT id FROM leads WHERE work_email = ? LIMIT 1");
            $stmt->execute([$lead['work_email']]);
            if ($stmt->fetch()) {
                $skipped++;
                continue;
            }
        }

        $stmt = $db->prepare(
            "INSERT INTO leads (
                name, position, company, industry, status,
                is_active, work_email, work_email_verified,
                work_email_verification_status, work_esp,
                personal_email_1, personal_email_1_verified, personal_email_1_esp,
                personal_email_2, personal_email_2_verified, personal_email_2_esp,
                work_phone, personal_phone_1, personal_phone_2,
                created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $lead['name'] ?? '',
            $lead['position'] ?? '',
            $lead['company'] ?? '',
            $lead['industry'] ?? '',
            $lead['status'] ?? 'NEW',
            $lead['is_active'] ?? 1,
            $lead['work_email'] ?? '',
            $lead['work_email_verified'] ?? 0,
            $lead['work_email_verification_status'] ?? null,
            $lead['work_esp'] ?? null,
            $lead['personal_email_1'] ?? '',
            $lead['personal_email_1_verified'] ?? 0,
            $lead['personal_email_1_esp'] ?? null,
            $lead['personal_email_2'] ?? '',
            $lead['personal_email_2_verified'] ?? 0,
            $lead['personal_email_2_esp'] ?? null,
            $lead['work_phone'] ?? '',
            $lead['personal_phone_1'] ?? '',
            $lead['personal_phone_2'] ?? '',
            $lead['created_at'] ?? date('Y-m-d H:i:s'),
        ]);
        $restored++;
    }

    // Restore verification cache if requested
    if ($restoreCache && !empty($backupData['email_verification_cache']) && is_array($backupData['email_verification_cache'])) {
        $db->exec("DELETE FROM email_verification_cache");
        foreach ($backupData['email_verification_cache'] as $cache) {
            $stmt = $db->prepare(
                "INSERT IGNORE INTO email_verification_cache
                 (email_address, verification_status, esp, verified_at, expires_at)
                 VALUES (?,?,?,?,?)"
            );
            $stmt->execute([
                $cache['email_address'] ?? '',
                $cache['verification_status'] ?? '',
                $cache['esp'] ?? '',
                $cache['verified_at'] ?? date('Y-m-d H:i:s'),
                $cache['expires_at'] ?? date('Y-m-d H:i:s', strtotime('+14 days')),
            ]);
        }
    }

    $db->commit();

    // Log restore activity
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'restore', 'system', ?, ?)"
    );
    $logStmt->execute([
        $user['id'],
        $user['email'],
        "Backup restored ({$mode}): {$restored} leads restored, {$skipped} skipped",
        $_SERVER['REMOTE_ADDR'],
    ]);

    echo json_encode([
        'success' => true,
        'restored' => $restored,
        'skipped' => $skipped,
        'mode' => $mode,
        'message' => "{$restored} leads restored successfully" . ($skipped > 0 ? ", {$skipped} skipped (duplicates)" : ''),
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Restore failed: ' . $e->getMessage()]);
}
