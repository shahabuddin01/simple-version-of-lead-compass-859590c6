<?php
/**
 * GET  /api/settings/general — Get general settings
 * POST /api/settings/general — Update settings
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query("SELECT setting_key, setting_value FROM security_settings");
    $settings = [];
    while ($row = $stmt->fetch()) {
        $settings[$row['setting_key']] = $row['setting_value'];
    }
    echo json_encode($settings);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    foreach ($data as $key => $value) {
        $stmt = $db->prepare(
            "INSERT INTO security_settings (setting_key, setting_value)
             VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
        );
        $stmt->execute([htmlspecialchars($key), htmlspecialchars((string) $value)]);
    }

    echo json_encode(['success' => true, 'message' => 'Settings updated']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
