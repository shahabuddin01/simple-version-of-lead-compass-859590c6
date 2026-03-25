<?php
/**
 * SMS Queue API — Add jobs and poll for pending SMS
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = (new Database())->connect();

// Device auth OR session auth
$deviceId = $_SERVER['HTTP_X_DEVICE_ID'] ?? null;
$isDevice = false;

if ($deviceId) {
    $stmt = $db->prepare("SELECT * FROM sms_devices WHERE device_id = ? AND is_active = 1");
    $stmt->execute([$deviceId]);
    $device = $stmt->fetch();
    if (!$device) {
        http_response_code(401);
        echo json_encode(['error' => 'Device not registered or inactive']);
        exit;
    }
    $isDevice = true;
    // Update last ping
    $db->prepare("UPDATE sms_devices SET last_ping_at = NOW() WHERE device_id = ?")->execute([$deviceId]);
} else {
    require_once __DIR__ . '/../../middleware/auth.php';
}

// GET — Poll for pending SMS jobs (mobile app)
if ($method === 'GET') {
    $limit = min((int)($_GET['limit'] ?? 10), 50);
    $simPref = $_GET['sim'] ?? 'ANY';
    $statusFilter = $_GET['status'] ?? null;

    if ($statusFilter) {
        // CRM UI fetching queue by status
        $allowed = ['PENDING', 'PICKED', 'SENT', 'FAILED', 'CANCELLED'];
        $statuses = array_intersect(explode(',', strtoupper($statusFilter)), $allowed);
        if (empty($statuses)) $statuses = ['PENDING'];
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $stmt = $db->prepare("SELECT * FROM sms_queue WHERE status IN ($placeholders) ORDER BY created_at DESC LIMIT ?");
        $params = array_merge($statuses, [$limit]);
        $stmt->execute($params);
        $jobs = $stmt->fetchAll();
        echo json_encode(['jobs' => $jobs, 'count' => count($jobs)]);
        exit;
    }

    // Mobile app polling — get pending and mark as picked
    $stmt = $db->prepare(
        "SELECT * FROM sms_queue
         WHERE status = 'PENDING'
         AND retry_count < max_retries
         AND (sim_preference = ? OR sim_preference = 'ANY')
         ORDER BY priority DESC, created_at ASC
         LIMIT ?"
    );
    $stmt->execute([$simPref, $limit]);
    $jobs = $stmt->fetchAll();

    if (!empty($jobs)) {
        $ids = array_column($jobs, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $updateStmt = $db->prepare(
            "UPDATE sms_queue SET status = 'PICKED', picked_at = NOW(), device_id = ? WHERE id IN ($placeholders)"
        );
        $updateStmt->execute(array_merge([$deviceId ?? 'web'], $ids));
    }

    echo json_encode([
        'jobs' => $jobs,
        'count' => count($jobs),
        'server_time' => date('Y-m-d H:i:s')
    ]);
    exit;
}

// POST — Add SMS to queue (from CRM)
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $phones = $data['phones'] ?? [];
    $message = trim($data['message'] ?? '');
    $leadId = (int)($data['lead_id'] ?? 0);
    $leadName = htmlspecialchars($data['lead_name'] ?? '', ENT_QUOTES, 'UTF-8');
    $simPref = $data['sim_preference'] ?? 'ANY';
    $priority = (int)($data['priority'] ?? 1);

    if (empty($phones) || empty($message)) {
        http_response_code(400);
        echo json_encode(['error' => 'Phones and message required']);
        exit;
    }

    $inserted = [];
    foreach ($phones as $phone) {
        $phone = trim($phone ?? '');
        if (empty($phone) || strlen($phone) < 5) continue;

        $stmt = $db->prepare(
            "INSERT INTO sms_queue (lead_id, lead_name, phone_number, message, sim_preference, priority, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$leadId, $leadName, $phone, $message, $simPref, $priority, $_SESSION['user_id'] ?? 0]);
        $inserted[] = $db->lastInsertId();
    }

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'queued' => count($inserted),
        'job_ids' => $inserted
    ]);
    exit;
}

// PUT — Cancel a queued SMS
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $jobId = (int)($data['job_id'] ?? 0);
    $action = $data['action'] ?? '';

    if (!$jobId) {
        http_response_code(400);
        echo json_encode(['error' => 'job_id required']);
        exit;
    }

    if ($action === 'cancel') {
        $db->prepare("UPDATE sms_queue SET status = 'CANCELLED' WHERE id = ? AND status = 'PENDING'")->execute([$jobId]);
        echo json_encode(['success' => true]);
    } elseif ($action === 'retry') {
        $db->prepare("UPDATE sms_queue SET status = 'PENDING', retry_count = 0, failure_reason = NULL WHERE id = ? AND status = 'FAILED'")->execute([$jobId]);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
    exit;
}

// DELETE — Bulk clear completed/cancelled
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $clearStatus = $data['status'] ?? 'SENT';
    $db->prepare("DELETE FROM sms_queue WHERE status = ?")->execute([$clearStatus]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
