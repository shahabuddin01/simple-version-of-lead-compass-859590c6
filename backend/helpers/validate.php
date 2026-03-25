<?php
/**
 * Input validation helpers
 */

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validateRequired($data, $fields) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
            $missing[] = $field;
        }
    }
    return $missing;
}

function sanitize($value) {
    if (is_null($value)) return '';
    return htmlspecialchars(trim((string) $value), ENT_QUOTES, 'UTF-8');
}

function validatePassword($password) {
    if (strlen($password) < 8) return 'Password must be at least 8 characters';
    if (!preg_match('/[A-Z]/', $password)) return 'Password must contain an uppercase letter';
    if (!preg_match('/[a-z]/', $password)) return 'Password must contain a lowercase letter';
    if (!preg_match('/[0-9]/', $password)) return 'Password must contain a number';
    return null;
}
