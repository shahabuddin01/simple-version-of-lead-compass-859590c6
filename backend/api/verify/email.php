<?php
/**
 * POST /api/verify/email — Verify email via MillionVerifier with caching
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

$email = filter_var($data['email'] ?? '', FILTER_SANITIZE_EMAIL);
$apiKey = $data['api_key'] ?? getenv('MILLIONVERIFIER_API_KEY') ?? '';

if (!$email) {
    http_response_code(400);
    echo json_encode(['error' => 'Email address required']);
    exit;
}

if (!$apiKey) {
    http_response_code(400);
    echo json_encode(['error' => 'MillionVerifier API key not configured']);
    exit;
}

// Check cache first
$stmt = $db->prepare(
    "SELECT * FROM email_verification_cache
     WHERE email_address = ? AND expires_at > NOW()"
);
$stmt->execute([strtolower($email)]);
$cached = $stmt->fetch();

if ($cached) {
    echo json_encode([
        'email' => $email,
        'status' => $cached['verification_status'],
        'esp' => $cached['esp'],
        'cached' => true,
        'verified_at' => $cached['verified_at'],
    ]);
    exit;
}

// Call MillionVerifier API
$url = 'https://api.millionverifier.com/api/v3/?api=' . urlencode($apiKey) . '&email=' . urlencode($email);
$response = file_get_contents($url);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to reach MillionVerifier API']);
    exit;
}

$result = json_decode($response, true);
$status = $result['result'] ?? 'unknown';
$subStatus = $result['subresult'] ?? '';

// Determine ESP from MX records (simplified)
$esp = null;
$domain = substr(strrchr($email, '@'), 1);
$mxRecords = [];
if (getmxrr($domain, $mxRecords)) {
    $mxHost = strtolower($mxRecords[0] ?? '');
    if (strpos($mxHost, 'google') !== false || strpos($mxHost, 'gmail') !== false) {
        $esp = strpos($email, '@gmail.com') !== false ? 'Google' : 'Google Workspace';
    } elseif (strpos($mxHost, 'outlook') !== false || strpos($mxHost, 'microsoft') !== false) {
        $esp = strpos($email, '@outlook.com') !== false || strpos($email, '@hotmail.com') !== false ? 'Microsoft' : 'Microsoft 365';
    } elseif (strpos($mxHost, 'yahoo') !== false) {
        $esp = 'Yahoo';
    } elseif (strpos($mxHost, 'zoho') !== false) {
        $esp = 'Zoho';
    }
}

// Cache result for 14 days
$stmt = $db->prepare(
    "INSERT INTO email_verification_cache (email_address, verification_status, esp, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))
     ON DUPLICATE KEY UPDATE verification_status = VALUES(verification_status),
     esp = VALUES(esp), verified_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 14 DAY)"
);
$stmt->execute([strtolower($email), $status, $esp]);

echo json_encode([
    'email' => $email,
    'status' => $status,
    'sub_status' => $subStatus,
    'esp' => $esp,
    'cached' => false,
    'verified_at' => date('c'),
    'raw' => $result,
]);
