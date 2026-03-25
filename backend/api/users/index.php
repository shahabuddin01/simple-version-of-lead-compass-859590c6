<?php
/**
 * GET  /api/users  — List all users (admin only)
 * POST /api/users  — Create new user (admin only)
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query(
        "SELECT id, name, email, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC"
    );
    $users = $stmt->fetchAll();
    foreach ($users as &$u) {
        $u['id'] = (int) $u['id'];
        $u['is_active'] = (bool) $u['is_active'];
    }
    echo json_encode($users);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $name = htmlspecialchars($data['name'] ?? '');
    $email = filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL);
    $password = $data['password'] ?? '';
    $role = in_array($data['role'] ?? '', ['admin', 'manager', 'employee', 'viewer']) ? $data['role'] : 'viewer';

    if (!$name || !$email || !$password) {
        http_response_code(400);
        echo json_encode(['error' => 'Name, email, and password are required']);
        exit;
    }

    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters']);
        exit;
    }

    // Check duplicate
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already exists']);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
    );
    $stmt->execute([$name, $email, $hashedPassword, $role]);

    $id = (int) $db->lastInsertId();

    // Log
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'create', 'users', ?, ?)"
    );
    $logStmt->execute([$user['id'], $user['email'], "Created user #$id ($email)", $_SERVER['REMOTE_ADDR']]);

    http_response_code(201);
    echo json_encode([
        'id' => $id,
        'name' => $name,
        'email' => $email,
        'role' => $role,
        'is_active' => true,
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
