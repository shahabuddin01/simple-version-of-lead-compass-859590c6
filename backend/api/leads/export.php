<?php
/**
 * GET /api/leads/export — Export leads as CSV
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$user = authenticate();
$db = (new Database())->connect();

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
if (!empty($_GET['status'])) {
    $where[] = 'status = ?';
    $params[] = $_GET['status'];
}

$whereStr = implode(' AND ', $where);
$stmt = $db->prepare("SELECT * FROM leads WHERE $whereStr ORDER BY created_at DESC");
$stmt->execute($params);
$leads = $stmt->fetchAll();

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="leads_export_' . date('Y-m-d') . '.csv"');

$output = fopen('php://output', 'w');
fputcsv($output, [
    'Name', 'Position', 'Company', 'Industry', 'Status',
    'Work Email', 'Personal Email 1', 'Personal Email 2',
    'Work Phone', 'Personal Phone 1', 'Personal Phone 2',
    'LinkedIn', 'Facebook', 'Instagram',
    'Active', 'Created At'
]);

foreach ($leads as $lead) {
    fputcsv($output, [
        $lead['name'], $lead['position'], $lead['company'], $lead['industry'], $lead['status'],
        $lead['work_email'], $lead['personal_email_1'], $lead['personal_email_2'],
        $lead['work_phone'], $lead['personal_phone_1'], $lead['personal_phone_2'],
        $lead['linkedin'], $lead['facebook'], $lead['instagram'],
        $lead['is_active'] ? 'Yes' : 'No', $lead['created_at'],
    ]);
}

fclose($output);
