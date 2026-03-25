<?php
/**
 * GET    /api/leads/{id}  — Get single lead
 * PUT    /api/leads/{id}  — Update lead
 * DELETE /api/leads/{id}  — Delete lead
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

$user = authenticate();
$db = (new Database())->connect();
$method = $_SERVER['REQUEST_METHOD'];
$leadId = (int) ($_REQUEST['lead_id'] ?? 0);

if (!$leadId) {
    http_response_code(400);
    echo json_encode(['error' => 'Lead ID required']);
    exit;
}

if ($method === 'GET') {
    $stmt = $db->prepare("SELECT * FROM leads WHERE id = ?");
    $stmt->execute([$leadId]);
    $lead = $stmt->fetch();

    if (!$lead) {
        http_response_code(404);
        echo json_encode(['error' => 'Lead not found']);
        exit;
    }

    $lead['id'] = (int) $lead['id'];
    $lead['is_active'] = (bool) $lead['is_active'];
    $lead['work_email_verified'] = (bool) $lead['work_email_verified'];
    $lead['personal_email_1_verified'] = (bool) $lead['personal_email_1_verified'];
    $lead['personal_email_2_verified'] = (bool) $lead['personal_email_2_verified'];

    echo json_encode($lead);
    exit;
}

if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);

    $updatable = [
        'name', 'position', 'company', 'industry', 'status', 'is_active',
        'work_email', 'work_email_verified', 'work_email_verification_status', 'work_esp',
        'personal_email_1', 'personal_email_1_verified', 'personal_email_1_verification_status', 'personal_email_1_esp',
        'personal_email_2', 'personal_email_2_verified', 'personal_email_2_verification_status', 'personal_email_2_esp',
        'work_phone', 'personal_phone_1', 'personal_phone_2',
        'notes', 'tags', 'list_source', 'linkedin', 'facebook', 'instagram', 'company_email',
    ];

    $sets = [];
    $params = [];
    foreach ($updatable as $field) {
        if (array_key_exists($field, $data)) {
            $sets[] = "$field = ?";
            $value = $data[$field];
            if (is_bool($value)) $value = $value ? 1 : 0;
            if (is_array($value)) $value = json_encode($value);
            if (in_array($field, ['name', 'position', 'company', 'industry', 'notes', 'list_source', 'work_phone', 'personal_phone_1', 'personal_phone_2', 'linkedin', 'facebook', 'instagram'])) {
                $value = htmlspecialchars((string) $value);
            }
            $params[] = $value;
        }
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        exit;
    }

    $params[] = $leadId;
    $stmt = $db->prepare("UPDATE leads SET " . implode(', ', $sets) . " WHERE id = ?");
    $stmt->execute($params);

    // Fetch updated
    $stmt = $db->prepare("SELECT * FROM leads WHERE id = ?");
    $stmt->execute([$leadId]);

    // Log
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'update', 'leads', ?, ?)"
    );
    $logStmt->execute([$user['id'], $user['email'], "Updated lead #$leadId", $_SERVER['REMOTE_ADDR']]);

    echo json_encode($stmt->fetch());
    exit;
}

if ($method === 'DELETE') {
    // Check role — only admin/manager can delete
    if (!in_array($user['role'], ['admin', 'manager'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Insufficient permissions to delete leads']);
        exit;
    }

    $stmt = $db->prepare("DELETE FROM leads WHERE id = ?");
    $stmt->execute([$leadId]);

    // Log
    $logStmt = $db->prepare(
        "INSERT INTO security_activity_log (user_id, user_email, action, resource, details, ip_address)
         VALUES (?, ?, 'delete', 'leads', ?, ?)"
    );
    $logStmt->execute([$user['id'], $user['email'], "Deleted lead #$leadId", $_SERVER['REMOTE_ADDR']]);

    echo json_encode(['success' => true, 'message' => "Lead #$leadId deleted"]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
