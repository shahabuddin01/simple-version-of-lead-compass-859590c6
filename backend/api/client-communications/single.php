<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = (int)($_REQUEST['client_id'] ?? 0);

if (!$id) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing client ID']);
  exit;
}

if ($method === 'PUT') {
  $data = json_decode(file_get_contents('php://input'), true);
  $fields = [];
  $params = [];
  $allowed = ['name','designation','company','linkedin','facebook','instagram','lead_status','lead_collected_date','mail_status','mail_sent_date','comments'];
  foreach ($allowed as $field) {
    if (array_key_exists($field, $data)) {
      $fields[] = "$field = ?";
      $params[] = $data[$field];
    }
  }
  if (empty($fields)) {
    http_response_code(400);
    echo json_encode(['error' => 'No fields to update']);
    exit;
  }
  $params[] = $id;
  db()->prepare("UPDATE client_communications SET " . implode(', ', $fields) . " WHERE id = ?")->execute($params);
  $stmt = db()->prepare("SELECT * FROM client_communications WHERE id = ?");
  $stmt->execute([$id]);
  echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
  exit;
}

if ($method === 'DELETE') {
  db()->prepare("DELETE FROM client_communications WHERE id = ?")->execute([$id]);
  echo json_encode(['success' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
