<?php
/**
 * GET  /api/settings/smtp — Get SMTP settings
 * POST /api/settings/smtp — Update SMTP settings
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query("SELECT id, host, port, encryption, username, sender_name, sender_email, is_active, updated_at FROM smtp_settings LIMIT 1");
    $settings = $stmt->fetch();
    echo json_encode($settings ?: ['configured' => false]);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Check if settings exist
    $existing = $db->query("SELECT id FROM smtp_settings LIMIT 1")->fetch();

    if ($existing) {
        $stmt = $db->prepare(
            "UPDATE smtp_settings SET host=?, port=?, encryption=?, username=?, password=?, sender_name=?, sender_email=?, is_active=? WHERE id=?"
        );
        $stmt->execute([
            $data['host'] ?? '', (int)($data['port'] ?? 587),
            $data['encryption'] ?? 'tls', $data['username'] ?? '',
            $data['password'] ?? '', $data['sender_name'] ?? 'NH Production House',
            $data['sender_email'] ?? '', (int)($data['is_active'] ?? 1),
            $existing['id']
        ]);
    } else {
        $stmt = $db->prepare(
            "INSERT INTO smtp_settings (host, port, encryption, username, password, sender_name, sender_email, is_active)
             VALUES (?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $data['host'] ?? '', (int)($data['port'] ?? 587),
            $data['encryption'] ?? 'tls', $data['username'] ?? '',
            $data['password'] ?? '', $data['sender_name'] ?? 'NH Production House',
            $data['sender_email'] ?? '', (int)($data['is_active'] ?? 1)
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'SMTP settings saved']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
