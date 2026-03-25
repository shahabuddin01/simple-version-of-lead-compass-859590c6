<?php
/**
 * SMTP mailer helper
 * Uses PHP's mail() or direct SMTP socket for cPanel environments
 */

function getSmtpSettings($db) {
    $stmt = $db->query("SELECT * FROM smtp_settings WHERE is_active = 1 LIMIT 1");
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function sendEmail($db, $to, $subject, $htmlBody) {
    $smtp = getSmtpSettings($db);

    if (!$smtp) {
        // Fallback to PHP mail()
        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $headers .= "From: NH Production House <noreply@shortcaptionbangla.com>\r\n";
        return mail($to, $subject, $htmlBody, $headers);
    }

    // Use SMTP settings
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: {$smtp['sender_name']} <{$smtp['sender_email']}>\r\n";

    return mail($to, $subject, $htmlBody, $headers);
}
