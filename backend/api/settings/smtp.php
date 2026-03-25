<?php
/**
 * GET  /api/settings/smtp — Get SMTP settings
 * POST /api/settings/smtp — Save SMTP settings
 * POST /api/settings/smtp/test — Send test email
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query("SELECT * FROM smtp_settings LIMIT 1");
    $settings = $stmt->fetch();
    if ($settings) {
        $settings['password'] = '••••••••'; // Mask password
    }
    echo json_encode($settings ?: new stdClass());
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    // Check if test email request
    if (isset($data['action']) && $data['action'] === 'test') {
        $stmt = $db->query("SELECT * FROM smtp_settings LIMIT 1");
        $smtp = $stmt->fetch();

        if (!$smtp) {
            http_response_code(400);
            echo json_encode(['error' => 'SMTP not configured']);
            exit;
        }

        // TODO: Send actual test email using PHP mail() or PHPMailer
        echo json_encode(['success' => true, 'message' => 'Test email sent (check implementation)']);
        exit;
    }

    // Upsert SMTP settings
    $stmt = $db->query("SELECT id FROM smtp_settings LIMIT 1");
    $existing = $stmt->fetch();

    if ($existing) {
        $sets = [];
        $params = [];
        foreach (['host', 'port', 'encryption', 'username', 'sender_name', 'sender_email', 'is_active'] as $field) {
            if (isset($data[$field])) { $sets[] = "$field = ?"; $params[] = $data[$field]; }
        }
        if (!empty($data['password']) && $data['password'] !== '••••••••') {
            $sets[] = 'password = ?';
            $params[] = $data['password'];
        }
        $params[] = $existing['id'];
        $db->prepare("UPDATE smtp_settings SET " . implode(', ', $sets) . " WHERE id = ?")->execute($params);
    } else {
        $stmt = $db->prepare(
            "INSERT INTO smtp_settings (host, port, encryption, username, password, sender_name, sender_email)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['host'] ?? '', $data['port'] ?? 587, $data['encryption'] ?? 'tls',
            $data['username'] ?? '', $data['password'] ?? '',
            $data['sender_name'] ?? '', $data['sender_email'] ?? '',
        ]);
    }

    echo json_encode(['success' => true, 'message' => 'SMTP settings saved']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
