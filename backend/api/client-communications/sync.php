<?php
/**
 * POST /api/client-communications/sync — Sync contacts from main leads table
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$user = authenticate();
$db = (new Database())->connect();
$data = json_decode(file_get_contents('php://input'), true);

$where = ['1=1'];
$params = [];

if (!empty($data['industry'])) {
    $where[] = 'industry = ?';
    $params[] = $data['industry'];
}
if (!empty($data['company'])) {
    $where[] = 'company = ?';
    $params[] = $data['company'];
}
if (!empty($data['status'])) {
    $where[] = 'status = ?';
    $params[] = $data['status'];
}

$whereStr = implode(' AND ', $where);
$stmt = $db->prepare("SELECT name, position, company, linkedin, facebook, instagram FROM leads WHERE $whereStr");
$stmt->execute($params);
$leads = $stmt->fetchAll();

$skipDuplicates = $data['skip_duplicates'] ?? true;
$added = 0;
$skipped = 0;

$db->beginTransaction();
try {
    foreach ($leads as $lead) {
        $name = $lead['name'];
        $company = $lead['company'];

        if ($skipDuplicates) {
            $check = $db->prepare("SELECT id FROM client_communications WHERE name = ? AND company = ? LIMIT 1");
            $check->execute([$name, $company]);
            if ($check->fetch()) { $skipped++; continue; }
        }

        $stmt = $db->prepare(
            "INSERT INTO client_communications (name, designation, company, linkedin, facebook, instagram, lead_status, mail_status)
             VALUES (?,?,?,?,?,?,'','not_send')"
        );
        $stmt->execute([
            $name,
            $lead['position'] ?? '',
            $company,
            $lead['linkedin'] ?? null,
            $lead['facebook'] ?? null,
            $lead['instagram'] ?? null,
        ]);
        $added++;
    }
    $db->commit();

    echo json_encode([
        'success' => true,
        'added' => $added,
        'skipped' => $skipped,
        'total_found' => count($leads),
        'message' => "$added contacts synced from leads" . ($skipped > 0 ? ", $skipped already existed" : ''),
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Sync failed: ' . $e->getMessage()]);
}
