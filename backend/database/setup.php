<?php
/**
 * ONE-TIME SETUP — Run once to create admin user, then DELETE this file!
 * Access via: https://yourdomain.com/backend/database/setup.php
 */

require_once __DIR__ . '/../config/database.php';

$name = 'Admin';
$email = 'admin@shortcaptionbangla.com';
$password = 'Admin@NH2024!';
$hash = password_hash($password, PASSWORD_BCRYPT);

$db = (new Database())->connect();

try {
    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')"
    );
    $stmt->execute([$name, $email, $hash]);

    echo "<h2>✅ Admin Created Successfully!</h2>";
    echo "<p><strong>Email:</strong> $email</p>";
    echo "<p><strong>Password:</strong> $password</p>";
    echo "<hr>";
    echo "<p style='color:red;font-weight:bold;'>⚠️ CHANGE YOUR PASSWORD AFTER LOGIN!<br>DELETE THIS FILE IMMEDIATELY!</p>";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate') !== false) {
        echo "<p>⚠️ Admin user already exists.</p>";
    } else {
        echo "<p>❌ Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    }
}
