<?php
/**
 * GET    /api/users/{id}  — Get user
 * PUT    /api/users/{id}  — Update user
 * DELETE /api/users/{id}  — Delete user
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$admin = requireAdmin();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];
$userId = (int) ($_REQUEST['user_id'] ?? 0);

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'User ID required']);
    exit;
}

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $u = $stmt->fetch();
    if (!$u) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }
    $u['id'] = (int) $u['id'];
    $u['is_active'] = (bool) $u['is_active'];
    echo json_encode($u);
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $sets = [];
    $params = [];

    if (isset($data['name'])) { $sets[] = 'name = ?'; $params[] = htmlspecialchars($data['name']); }
    if (isset($data['email'])) { $sets[] = 'email = ?'; $params[] = filter_var($data['email'], FILTER_SANITIZE_EMAIL); }
    if (isset($data['role']) && in_array($data['role'], ['admin', 'manager', 'employee', 'viewer'])) {
        $sets[] = 'role = ?'; $params[] = $data['role'];
    }
    if (isset($data['is_active'])) { $sets[] = 'is_active = ?'; $params[] = $data['is_active'] ? 1 : 0; }
    if (!empty($data['password']) && strlen($data['password']) >= 8) {
        $sets[] = 'password = ?'; $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }

    $params[] = $userId;
    $stmt = $db->prepare("UPDATE users SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($params);

    $stmt = $db->prepare("SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetch());
    exit;
}

if ($method === 'DELETE') {
    if ($userId === (int) $admin['id']) {
        http_response_code(400);
        echo json_encode(['error' => 'Cannot delete your own account']);
        exit;
    }
    $db->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$userId]);
    $db->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
