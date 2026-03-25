<?php
/**
 * SMS Delivery Report — Mobile app reports back after sending
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$db = (new Database())->connect();
$data = json_decode(file_get_contents('php://input'), true);

$jobId = (int)($data['job_id'] ?? 0);
$status = $data['status'] ?? 'FAILED';
$simUsed = $data['sim_used'] ?? 'SIM1';
$deviceId = $data['device_id'] ?? '';
$errorMsg = $data['error'] ?? null;

if (!$jobId) {
    http_response_code(400);
    echo json_encode(['error' => 'job_id required']);
    exit;
}

// Update queue status
if ($status === 'SENT') {
    $db->prepare("UPDATE sms_queue SET status = 'SENT', sent_at = NOW() WHERE id = ?")->execute([$jobId]);
} else {
    // Increment retry_count; if exceeded max, keep FAILED, else reset to PENDING
    $db->prepare(
        "UPDATE sms_queue SET
         retry_count = retry_count + 1,
         failed_at = NOW(),
         failure_reason = ?,
         status = IF(retry_count + 1 >= max_retries, 'FAILED', 'PENDING')
         WHERE id = ?"
    )->execute([$errorMsg, $jobId]);
}

// Get phone_number for the delivery report
$stmt = $db->prepare("SELECT phone_number FROM sms_queue WHERE id = ?");
$stmt->execute([$jobId]);
$job = $stmt->fetch();

// Save delivery report
$db->prepare(
    "INSERT INTO sms_delivery_reports (sms_queue_id, device_id, sim_used, phone_number, delivery_status, error_message)
     VALUES (?, ?, ?, ?, ?, ?)"
)->execute([
    $jobId,
    $deviceId,
    $simUsed,
    $job['phone_number'] ?? '',
    $status === 'SENT' ? 'DELIVERED' : 'FAILED',
    $errorMsg
]);

echo json_encode(['success' => true]);
