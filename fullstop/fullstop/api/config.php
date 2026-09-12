<?php
// ============================================================
// api/config.php — Database connection & shared utilities
// ============================================================

// --- CORS Headers (allow frontend to call the API) -----------
// When deployed, replace * with your actual domain
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Session ------------------------------------------------
session_start();

// --- Database Credentials -----------------------------------
// For XAMPP local dev, these defaults work out of the box.
// Change these when deploying to a live host.
define('DB_HOST', 'localhost');
define('DB_NAME', 'fullstop_db');
define('DB_USER', 'root');        // Change for production
define('DB_PASS', '');            // Change for production
define('DB_CHARSET', 'utf8mb4');

// --- PDO Connection -----------------------------------------
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
            exit;
        }
    }
    return $pdo;
}

// --- Response Helpers ----------------------------------------
function sendSuccess($data = [], string $message = 'OK', int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
    exit;
}

function sendError(string $message = 'An error occurred.', int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

// --- Auth Guard ----------------------------------------------
function requireLogin(): array {
    if (empty($_SESSION['user'])) {
        sendError('Unauthorized. Please log in.', 401);
    }

    // Verify the account is still active in the database
    $db = getDB();
    $stmt = $db->prepare('SELECT is_active FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user']['id']]);
    $isActive = $stmt->fetchColumn();

    if (!$isActive) {
        // Account has been terminated while they were logged in
        session_destroy();
        sendError("Sorry this account has been terminated.\nPlease contact admin.", 401);
    }

    return $_SESSION['user'];
}

function requireAdmin(): array {
    $user = requireLogin();
    if ($user['role'] !== 'admin') {
        sendError('Forbidden. Admin access required.', 403);
    }
    return $user;
}

// --- Get JSON Request Body -----------------------------------
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}
