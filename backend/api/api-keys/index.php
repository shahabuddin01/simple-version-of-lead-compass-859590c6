<?php
/**
 * GET  /api/api-keys — List API keys
 * POST /api/api-keys — Create/regenerate API key
 * PUT  /api/api-keys — Update key settings
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT id, label, CONCAT(LEFT(api_key,8),'...') as api_key_masked, scope, is_active, last_used_at, expires_at, created_at
         FROM api_credentials ORDER BY created_at DESC"
    );
    echo json_encode($stmt->fetchAll());
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $label = htmlspecialchars($data['label'] ?? 'CRM API Key');
    $scope = in_array($data['scope'] ?? '', ['full', 'read_only', 'read_update_status']) ? $data['scope'] : 'read_only';
    $apiKey = bin2hex(random_bytes(32));

    $stmt = $db->prepare(
        "INSERT INTO api_credentials (label, api_key, scope) VALUES (?, ?, ?)"
    );
    $stmt->execute([$label, $apiKey, $scope]);

    echo json_encode([
        'success' => true,
        'api_key' => $apiKey,
        'label' => $label,
        'scope' => $scope,
    ]);
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Key ID required']);
        exit;
    }

    $sets = [];
    $params = [];

    if (isset($data['scope'])) { $sets[] = 'scope = ?'; $params[] = $data['scope']; }
    if (isset($data['is_active'])) { $sets[] = 'is_active = ?'; $params[] = $data['is_active'] ? 1 : 0; }
    if (isset($data['regenerate']) && $data['regenerate']) {
        $newKey = bin2hex(random_bytes(32));
        $sets[] = 'api_key = ?';
        $params[] = $newKey;
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }

    $params[] = $id;
    $db->prepare("UPDATE api_credentials SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);

    $response = ['success' => true];
    if (isset($newKey)) $response['api_key'] = $newKey;
    echo json_encode($response);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
