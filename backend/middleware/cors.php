<?php
/**
 * CORS Middleware — allows cross-origin requests from the frontend
 */

// Load env for APP_URL
$envFile = __DIR__ . '/../config/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        if (!getenv(trim($key))) {
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

$allowedOrigin = getenv('APP_URL') ?: '*';

header("Access-Control-Allow-Origin: $allowedOrigin");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, apikey, X-Requested-With");
header("Access-Control-Expose-Headers: X-Total-Count");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
