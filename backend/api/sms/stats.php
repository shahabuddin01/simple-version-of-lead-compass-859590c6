<?php
/**
 * SMS Stats — Analytics for the CRM dashboard
 */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/cors.php';
require_once __DIR__ . '/../../middleware/auth.php';

$db = (new Database())->connect();

$today = date('Y-m-d');
$weekStart = date('Y-m-d', strtotime('monday this week'));
$monthStart = date('Y-m-01');

// Total sent counts
$todayCount = $db->prepare("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'SENT' AND DATE(sent_at) = ?");
$todayCount->execute([$today]);
$sentToday = $todayCount->fetch()['c'];

$weekCount = $db->prepare("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'SENT' AND sent_at >= ?");
$weekCount->execute([$weekStart]);
$sentWeek = $weekCount->fetch()['c'];

$monthCount = $db->prepare("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'SENT' AND sent_at >= ?");
$monthCount->execute([$monthStart]);
$sentMonth = $monthCount->fetch()['c'];

// Status breakdown
$statusBreakdown = $db->query("SELECT status, COUNT(*) as count FROM sms_queue GROUP BY status")->fetchAll();

// SIM usage
$simUsage = $db->query("SELECT sim_used, COUNT(*) as count FROM sms_delivery_reports WHERE delivery_status = 'DELIVERED' GROUP BY sim_used")->fetchAll();

// Success rate
$totalAttempted = $db->query("SELECT COUNT(*) as c FROM sms_queue WHERE status IN ('SENT','FAILED')")->fetch()['c'];
$totalSent = $db->query("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'SENT'")->fetch()['c'];
$successRate = $totalAttempted > 0 ? round(($totalSent / $totalAttempted) * 100, 1) : 0;

// Failed count
$failedCount = $db->query("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'FAILED'")->fetch()['c'];

// Pending count
$pendingCount = $db->query("SELECT COUNT(*) as c FROM sms_queue WHERE status = 'PENDING'")->fetch()['c'];

// Active devices
$activeDevices = $db->query("SELECT COUNT(*) as c FROM sms_devices WHERE is_active = 1 AND last_ping_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)")->fetch()['c'];

echo json_encode([
    'sent_today' => (int)$sentToday,
    'sent_this_week' => (int)$sentWeek,
    'sent_this_month' => (int)$sentMonth,
    'success_rate' => $successRate,
    'failed_count' => (int)$failedCount,
    'pending_count' => (int)$pendingCount,
    'active_devices' => (int)$activeDevices,
    'status_breakdown' => $statusBreakdown,
    'sim_usage' => $simUsage,
]);
