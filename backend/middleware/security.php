<?php
/**
 * Security middleware — rate limiting and request validation
 */

function checkRateLimit($db, $ip, $endpoint, $maxRequests = 60, $windowSeconds = 60) {
    $stmt = $db->prepare(
        "SELECT COUNT(*) FROM api_request_logs
         WHERE ip_address = ? AND endpoint = ?
         AND requested_at > DATE_SUB(NOW(), INTERVAL ? SECOND)"
    );
    $stmt->execute([$ip, $endpoint, $windowSeconds]);
    $count = (int) $stmt->fetchColumn();

    if ($count >= $maxRequests) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many requests. Please try again later.']);
        exit;
    }
}

function logApiRequest($db, $endpoint, $method, $statusCode, $ip, $apiKeyLabel = null, $responseTimeMs = 0) {
    try {
        $stmt = $db->prepare(
            "INSERT INTO api_request_logs (endpoint, method, api_key_label, status_code, ip_address, response_time_ms)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$endpoint, $method, $apiKeyLabel, $statusCode, $ip, $responseTimeMs]);
    } catch (Exception $e) {
        // Non-critical — don't break the request
    }
}

function sanitizeInput($value) {
    if (is_null($value)) return null;
    return htmlspecialchars(trim((string) $value), ENT_QUOTES, 'UTF-8');
}
