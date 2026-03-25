<?php
/**
 * POST /api/client-communications/import — Bulk import clients
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
$clients = $data['clients'] ?? [];

if (empty($clients)) {
    http_response_code(400);
    echo json_encode(['error' => 'No clients to import']);
    exit;
}

$added = 0;
$skipped = 0;

$db->beginTransaction();
try {
    foreach ($clients as $client) {
        $name = htmlspecialchars(trim($client['name'] ?? ''));
        $company = htmlspecialchars(trim($client['company'] ?? ''));

        if (empty($name)) { $skipped++; continue; }

        // Check duplicate
        if (!empty($data['skip_duplicates'])) {
            $stmt = $db->prepare("SELECT id FROM client_communications WHERE name = ? AND company = ? LIMIT 1");
            $stmt->execute([$name, $company]);
            if ($stmt->fetch()) { $skipped++; continue; }
        }

        $stmt = $db->prepare(
            "INSERT INTO client_communications (name, designation, company, linkedin, facebook, instagram, lead_status, lead_collected_date, mail_status, mail_sent_date, comments)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $name,
            htmlspecialchars($client['designation'] ?? ''),
            $company,
            $client['linkedin'] ?? null,
            $client['facebook'] ?? null,
            $client['instagram'] ?? null,
            $client['lead_status'] ?? '',
            $client['lead_collected_date'] ?: null,
            $client['mail_status'] ?? 'not_send',
            $client['mail_sent_date'] ?: null,
            htmlspecialchars($client['comments'] ?? ''),
        ]);
        $added++;
    }
    $db->commit();

    echo json_encode([
        'success' => true,
        'added' => $added,
        'skipped' => $skipped,
        'message' => "$added clients imported" . ($skipped > 0 ? ", $skipped skipped" : ''),
    ]);
} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Import failed: ' . $e->getMessage()]);
}
