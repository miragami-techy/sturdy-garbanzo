<?php
// ============================================================
// api/auth.php — Login, Logout, Session Check
//
// POST   /api/auth.php          → Login
// GET    /api/auth.php          → Check current session
// DELETE /api/auth.php          → Logout
// ============================================================

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ------------------------------------------------------------------
// GET — Return current logged-in user info
// ------------------------------------------------------------------
if ($method === 'GET') {
    if (empty($_SESSION['user'])) {
        sendError('Not logged in.', 401);
    }
    sendSuccess($_SESSION['user'], 'Session active.');
}

// ------------------------------------------------------------------
// POST — Login
// ------------------------------------------------------------------
if ($method === 'POST') {
    $body     = getBody();
    $loginId  = trim($body['login_id']  ?? '');
    $password = trim($body['password']  ?? '');

    if (!$loginId || !$password) {
        sendError('Login ID and password are required.');
    }

    $db   = getDB();
    $stmt = $db->prepare('SELECT * FROM users WHERE login_id = ? LIMIT 1');
    $stmt->execute([$loginId]);
    $user = $stmt->fetch();

    // Special handling: the seeded admin password hash is the Laravel default 'password'
    // We keep password_verify() for bcrypt hashes.
    if (!$user || !password_verify($password, $user['password_hash'])) {
        sendError('Invalid Login ID or password. Please try again.', 401);
    }

    if ($user['is_active'] == 0) {
        sendError("Sorry this account has been terminated.\nPlease contact admin.", 401);
    }

    // Store safe user data in session (never store password hash)
    $_SESSION['user'] = [
        'id'       => $user['id'],
        'login_id' => $user['login_id'],
        'role'     => $user['role'],
        'name'     => $user['name'],
        'location' => $user['location'],
    ];

    sendSuccess($_SESSION['user'], 'Login successful.');
}

// ------------------------------------------------------------------
// DELETE — Logout
// ------------------------------------------------------------------
if ($method === 'DELETE') {
    session_unset();
    session_destroy();
    sendSuccess([], 'Logged out successfully.');
}

sendError('Method not allowed.', 405);
