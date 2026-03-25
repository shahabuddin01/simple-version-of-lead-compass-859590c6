<?php
/**
 * SMS Device Registration — Android app registers itself
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = (new Database())->connect();

// GET — List all devices (CRM admin)
if ($method === 'GET') {
    require_once __DIR__ . '/../../middleware/auth.php';
    $stmt = $db->query("SELECT * FROM sms_devices ORDER BY last_ping_at DESC");
    echo json_encode($stmt->fetchAll());
    exit;
}

// POST — Register or update device
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $deviceId = htmlspecialchars(trim($data['device_id'] ?? ''), ENT_QUOTES, 'UTF-8');
    $deviceName = htmlspecialchars(trim($data['device_name'] ?? 'Android Device'), ENT_QUOTES, 'UTF-8');
    $sim1 = htmlspecialchars(trim($data['sim1_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $sim2 = htmlspecialchars(trim($data['sim2_number'] ?? ''), ENT_QUOTES, 'UTF-8');
    $sim1Carrier = htmlspecialchars(trim($data['sim1_carrier'] ?? ''), ENT_QUOTES, 'UTF-8');
    $sim2Carrier = htmlspecialchars(trim($data['sim2_carrier'] ?? ''), ENT_QUOTES, 'UTF-8');
    $appVersion = htmlspecialchars(trim($data['app_version'] ?? '1.0'), ENT_QUOTES, 'UTF-8');

    if (empty($deviceId)) {
        http_response_code(400);
        echo json_encode(['error' => 'device_id required']);
        exit;
    }

    $db->prepare(
        "INSERT INTO sms_devices (device_id, device_name, sim1_number, sim2_number, sim1_carrier, sim2_carrier, app_version, last_ping_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           device_name = VALUES(device_name),
           sim1_number = VALUES(sim1_number),
           sim2_number = VALUES(sim2_number),
           sim1_carrier = VALUES(sim1_carrier),
           sim2_carrier = VALUES(sim2_carrier),
           app_version = VALUES(app_version),
           last_ping_at = NOW(),
           is_active = 1"
    )->execute([$deviceId, $deviceName, $sim1, $sim2, $sim1Carrier, $sim2Carrier, $appVersion]);

    echo json_encode([
        'success' => true,
        'message' => 'Device registered',
        'device_id' => $deviceId
    ]);
    exit;
}

// DELETE — Deactivate device
if ($method === 'DELETE') {
    require_once __DIR__ . '/../../middleware/auth.php';
    $data = json_decode(file_get_contents('php://input'), true);
    $deviceId = $data['device_id'] ?? '';
    if ($deviceId) {
        $db->prepare("UPDATE sms_devices SET is_active = 0 WHERE device_id = ?")->execute([$deviceId]);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'device_id required']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
