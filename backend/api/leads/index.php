<?php
/**
 * GET  /api/leads       — List leads with filters/pagination
 * POST /api/leads       — Create a new lead
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $where = ['1=1'];
    $params = [];

    if (isset($_GET['is_active'])) {
        $where[] = 'is_active = ?';
        $params[] = $_GET['is_active'] === 'true' ? 1 : 0;
    }
    if (!empty($_GET['industry'])) {
        $where[] = 'industry = ?';
        $params[] = $_GET['industry'];
    }
    if (!empty($_GET['company'])) {
        $where[] = 'company = ?';
        $params[] = $_GET['company'];
    }
    if (!empty($_GET['status'])) {
        if (strpos($_GET['status'], ',') !== false) {
            $statuses = explode(',', $_GET['status']);
            $placeholders = implode(',', array_fill(0, count($statuses), '?'));
            $where[] = "status IN ($placeholders)";
            $params = array_merge($params, $statuses);
        } else {
            $where[] = 'status = ?';
            $params[] = $_GET['status'];
        }
    }
    if (isset($_GET['work_email_verified'])) {
        $where[] = 'work_email_verified = ?';
        $params[] = $_GET['work_email_verified'] === 'true' ? 1 : 0;
    }
    if (!empty($_GET['work_esp'])) {
        $where[] = 'work_esp = ?';
        $params[] = $_GET['work_esp'];
    }
    if (!empty($_GET['since'])) {
        $where[] = 'created_at >= ?';
        $params[] = $_GET['since'];
    }
    if (!empty($_GET['search'])) {
        $where[] = '(name LIKE ? OR company LIKE ? OR work_email LIKE ?)';
        $s = '%' . $_GET['search'] . '%';
        $params = array_merge($params, [$s, $s, $s]);
    }

    $limit = min(max((int) ($_GET['limit'] ?? 50), 1), 1000);
    $offset = max((int) ($_GET['offset'] ?? 0), 0);

    $allowedOrder = ['name', 'company', 'created_at', 'updated_at', 'status', 'industry'];
    $order = in_array($_GET['order'] ?? '', $allowedOrder) ? $_GET['order'] : 'created_at';
    $dir = strtoupper($_GET['dir'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

    $whereStr = implode(' AND ', $where);

    // Total count
    $countStmt = $db->prepare("SELECT COUNT(*) FROM leads WHERE $whereStr");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Fetch
    $stmt = $db->prepare(
        "SELECT * FROM leads WHERE $whereStr ORDER BY $order $dir LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $leads = $stmt->fetchAll();

    // Cast boolean fields
    foreach ($leads as &$lead) {
        $lead['id'] = (int) $lead['id'];
        $lead['is_active'] = (bool) $lead['is_active'];
        $lead['work_email_verified'] = (bool) $lead['work_email_verified'];
        $lead['personal_email_1_verified'] = (bool) $lead['personal_email_1_verified'];
        $lead['personal_email_2_verified'] = (bool) $lead['personal_email_2_verified'];
    }

    header("X-Total-Count: $total");
    echo json_encode($leads);
    exit;
}

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    $stmt = $db->prepare(
        "INSERT INTO leads (name, position, company, industry, work_email,
         personal_email_1, personal_email_2, work_phone, personal_phone_1,
         personal_phone_2, status, is_active, notes, tags, list_source,
         linkedin, facebook, instagram, company_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        htmlspecialchars($data['name'] ?? ''),
        htmlspecialchars($data['position'] ?? ''),
        htmlspecialchars($data['company'] ?? ''),
        htmlspecialchars($data['industry'] ?? ''),
        filter_var($data['work_email'] ?? '', FILTER_SANITIZE_EMAIL),
        filter_var($data['personal_email_1'] ?? '', FILTER_SANITIZE_EMAIL),
        filter_var($data['personal_email_2'] ?? '', FILTER_SANITIZE_EMAIL),
        htmlspecialchars($data['work_phone'] ?? ''),
        htmlspecialchars($data['personal_phone_1'] ?? ''),
        htmlspecialchars($data['personal_phone_2'] ?? ''),
        $data['status'] ?? 'NEW',
        isset($data['is_active']) ? ($data['is_active'] ? 1 : 0) : 1,
        htmlspecialchars($data['notes'] ?? ''),
        is_array($data['tags'] ?? null) ? json_encode($data['tags']) : ($data['tags'] ?? ''),
        htmlspecialchars($data['list_source'] ?? ''),
        htmlspecialchars($data['linkedin'] ?? ''),
        htmlspecialchars($data['facebook'] ?? ''),
        htmlspecialchars($data['instagram'] ?? ''),
        filter_var($data['company_email'] ?? '', FILTER_SANITIZE_EMAIL),
    ]);

    $id = (int) $db->lastInsertId();
    $stmt = $db->prepare("SELECT * FROM leads WHERE id = ?");
    $stmt->execute([$id]);

    // Log activity
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'create', 'leads', ?, ?)"
    );
    $logStmt->execute([$user['id'], $user['email'], "Created lead #$id", $_SERVER['REMOTE_ADDR']]);

    http_response_code(201);
    echo json_encode($stmt->fetch());
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
