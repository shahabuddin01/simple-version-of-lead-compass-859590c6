<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $where = ['1=1'];
  $params = [];

  if (!empty($_GET['search'])) {
    $s = '%' . $_GET['search'] . '%';
    $where[] = '(name LIKE ? OR company LIKE ?)';
    $params = array_merge($params, [$s, $s]);
  }
  if (!empty($_GET['lead_status'])) {
    $where[] = 'lead_status = ?';
    $params[] = $_GET['lead_status'];
  }
  if (!empty($_GET['mail_status'])) {
    $where[] = 'mail_status = ?';
    $params[] = $_GET['mail_status'];
  }

  $whereStr = implode(' AND ', $where);
  $limit = min((int)($_GET['limit'] ?? 50), 1000);
  $offset = max((int)($_GET['offset'] ?? 0), 0);

  $stmt = db()->prepare("SELECT COUNT(*) FROM client_communications WHERE $whereStr");
  $stmt->execute($params);
  header('X-Total-Count: ' . $stmt->fetchColumn());

  $stmt = db()->prepare("SELECT * FROM client_communications WHERE $whereStr ORDER BY created_at DESC LIMIT $limit OFFSET $offset");
  $stmt->execute($params);
  echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  exit;
}

if ($method === 'POST') {
  $data = json_decode(file_get_contents('php://input'), true);
  $stmt = db()->prepare(
    "INSERT INTO client_communications (name, designation, company, linkedin, facebook, instagram, lead_status, lead_collected_date, mail_status, mail_sent_date, comments) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  );
  $stmt->execute([
    $data['name'] ?? '',
    $data['designation'] ?? '',
    $data['company'] ?? '',
    $data['linkedin'] ?? null,
    $data['facebook'] ?? null,
    $data['instagram'] ?? null,
    $data['lead_status'] ?? '',
    $data['lead_collected_date'] ?: null,
    $data['mail_status'] ?? 'not_send',
    $data['mail_sent_date'] ?: null,
    $data['comments'] ?? ''
  ]);
  $id = db()->lastInsertId();
  $stmt = db()->prepare("SELECT * FROM client_communications WHERE id = ?");
  $stmt->execute([$id]);
  http_response_code(201);
  echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
  exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
