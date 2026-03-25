<?php
/**
 * NH Production House CRM — PHP API Router
 * Routes all /backend/api/* requests to the correct handler
 */

require_once __DIR__ . '/middleware/cors.php';

$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Strip /backend/api/ or /backend/ prefix
$path = preg_replace('#^/backend(/api)?/#', '', $requestUri);
$path = trim($path, '/');
$segments = explode('/', $path);

$resource = $segments[0] ?? '';
$action = $segments[1] ?? null;
$subAction = $segments[2] ?? null;

switch ($resource) {
    case 'auth':
        $file = $action ?? 'login';
        $filePath = __DIR__ . "/api/auth/{$file}.php";
        if (file_exists($filePath)) {
            require $filePath;
        } else {
            http_response_code(404);
            echo json_encode(['error' => "Auth endpoint '$file' not found"]);
        }
        break;

    case 'leads':
        if ($action === 'delete-bulk') {
            require __DIR__ . '/api/leads/delete-bulk.php';
        } elseif ($action === 'bulk') {
            require __DIR__ . '/api/leads/bulk.php';
        } elseif ($action && is_numeric($action)) {
            $_REQUEST['lead_id'] = (int) $action;
            require __DIR__ . '/api/leads/single.php';
        } else {
            require __DIR__ . '/api/leads/index.php';
        }
        break;

    case 'users':
        if ($action && is_numeric($action)) {
            $_REQUEST['user_id'] = (int) $action;
            require __DIR__ . '/api/users/single.php';
        } else {
            require __DIR__ . '/api/users/index.php';
        }
        break;

    case 'backup':
        if ($action === 'restore') {
            require __DIR__ . '/api/backup/restore.php';
        } else {
            require __DIR__ . '/api/backup/index.php';
        }
        break;

    case 'verify':
        require __DIR__ . '/api/verify/email.php';
        break;

    case 'settings':
        $settingType = $action ?? '';
        $filePath = __DIR__ . "/api/settings/{$settingType}.php";
        if (file_exists($filePath)) {
            require $filePath;
        } else {
            http_response_code(404);
            echo json_encode(['error' => "Settings endpoint '$settingType' not found"]);
        }
        break;

    case 'security':
        $secAction = $action ?? 'index';
        $filePath = __DIR__ . "/api/security/{$secAction}.php";
        if (file_exists($filePath)) {
            require $filePath;
        } else {
            http_response_code(404);
            echo json_encode(['error' => "Security endpoint '$secAction' not found"]);
        }
        break;

    case 'sms':
        $smsAction = $action ?? 'queue';
        $filePath = __DIR__ . "/api/sms/{$smsAction}.php";
        if (file_exists($filePath)) {
            require $filePath;
        } else {
            http_response_code(404);
            echo json_encode(['error' => "SMS endpoint '$smsAction' not found"]);
        }
        break;

    case 'health':
        echo json_encode([
            'status' => 'ok',
            'service' => 'NH Production House CRM API',
            'version' => '1.0.0',
            'timestamp' => date('c'),
        ]);
        break;

    default:
        http_response_code(404);
        echo json_encode([
            'error' => 'Endpoint not found',
            'available' => ['auth', 'leads', 'users', 'backup', 'verify', 'settings', 'security', 'health'],
        ]);
}
