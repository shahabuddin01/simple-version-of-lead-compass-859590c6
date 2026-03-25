<?php
/**
 * NH Production House CRM — PHP API Router
 * Routes all /backend/api/* requests to the correct handler
 */

require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/helpers/response.php';
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
        $allowed = ['login', 'logout', 'me', 'session', 'reset-password'];
        if (in_array($file, $allowed)) {
            $filePath = __DIR__ . "/api/auth/{$file}.php";
            if (file_exists($filePath)) {
                require $filePath;
            } else {
                jsonResponse(['error' => "Auth endpoint '$file' not found"], 404);
            }
        } else {
            jsonResponse(['error' => "Auth endpoint '$file' not found"], 404);
        }
        break;

    case 'leads':
        if ($action === 'delete-bulk') {
            require __DIR__ . '/api/leads/delete-bulk.php';
        } elseif ($action === 'bulk') {
            require __DIR__ . '/api/leads/bulk.php';
        } elseif ($action === 'export') {
            require __DIR__ . '/api/leads/export.php';
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
        $allowed = ['smtp', 'general'];
        if (in_array($settingType, $allowed)) {
            require __DIR__ . "/api/settings/{$settingType}.php";
        } else {
            jsonResponse(['error' => "Settings endpoint '$settingType' not found"], 404);
        }
        break;

    case 'security':
        $secAction = $action ?? 'activity';
        $map = [
            'activity' => 'activity.php',
            'activity-log' => 'activity-log.php',
            'blocked-ips' => 'blocked-ips.php',
            'login-attempts' => 'login-attempts.php',
        ];
        if (isset($map[$secAction])) {
            require __DIR__ . '/api/security/' . $map[$secAction];
        } else {
            jsonResponse(['error' => "Security endpoint '$secAction' not found"], 404);
        }
        break;

    case 'api-keys':
        if ($action === 'logs') {
            require __DIR__ . '/api/api-keys/logs.php';
        } else {
            require __DIR__ . '/api/api-keys/index.php';
        }
        break;

    case 'client-communications':
        if ($action === 'sync') {
            require __DIR__ . '/api/client-communications/sync.php';
        } elseif ($action === 'import') {
            require __DIR__ . '/api/client-communications/import.php';
        } elseif ($action && is_numeric($action)) {
            $_REQUEST['client_id'] = (int) $action;
            require __DIR__ . '/api/client-communications/single.php';
        } else {
            require __DIR__ . '/api/client-communications/index.php';
        }
        break;

    case 'redirect':
        require __DIR__ . '/api/redirect.php';
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
        jsonResponse(['error' => 'Endpoint not found'], 404);
}
