<?php
/**
 * Public redirect endpoint — strips referrer so social platforms don't block access.
 * No auth required.
 */

$url = $_GET['url'] ?? '';

if (empty($url)) {
  http_response_code(400);
  exit('No URL provided');
}

$url = urldecode($url);

if (!preg_match('/^https?:\/\//i', $url)) {
  http_response_code(400);
  exit('Invalid URL');
}

$blocked = ['localhost', '127.0.0.1', '192.168.', '10.0.'];
foreach ($blocked as $block) {
  if (stripos($url, $block) !== false) {
    http_response_code(403);
    exit('Blocked URL');
  }
}

header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');

$safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
$jsUrl = addslashes($url);

echo "<!DOCTYPE html>
<html>
<head>
  <meta name=\"referrer\" content=\"no-referrer\">
  <meta http-equiv=\"refresh\" content=\"0;url={$safeUrl}\">
  <title>Redirecting...</title>
</head>
<body>
  <p>Opening profile...</p>
  <script>window.location.replace(\"{$jsUrl}\");</script>
</body>
</html>";
exit;
