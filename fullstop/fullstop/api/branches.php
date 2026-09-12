<?php
// ============================================================
// api/branches.php — Branch Account Management (Admin only)
//
// GET    /api/branches.php          → List all active branches
// POST   /api/branches.php          → Create a new branch account
// DELETE /api/branches.php?id=X     → Terminate (deactivate) a branch
// ============================================================

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ------------------------------------------------------------------
// GET — List all branches
// ------------------------------------------------------------------
if ($method === 'GET') {
    requireLogin(); // Both admin and branch can list (for branch dropdown if needed)

    $status = $_GET['status'] ?? 'active';
    $isActive = ($status === 'terminated') ? 0 : 1;

    $stmt = $db->prepare(
        'SELECT id, login_id, name, location, created_at
         FROM users
         WHERE role = "branch" AND is_active = ?
         ORDER BY created_at ASC'
    );
    $stmt->execute([$isActive]);
    $branches = $stmt->fetchAll();

    // For each branch, attach pending order count
    foreach ($branches as &$branch) {
        $cntStmt = $db->prepare(
            'SELECT COUNT(*) as cnt FROM orders WHERE branch_id = ? AND status = "Pending"'
        );
        $cntStmt->execute([$branch['id']]);
        $branch['pending_orders'] = (int) $cntStmt->fetchColumn();
    }

    sendSuccess($branches, 'Branches retrieved.');
}

// ------------------------------------------------------------------
// POST — Create a new branch account
// ------------------------------------------------------------------
if ($method === 'POST') {
    requireAdmin();
    $body     = getBody();
    $name     = trim($body['name']     ?? '');
    $location = trim($body['location'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$name || !$location || !$password) {
        sendError('Name, location, and password are required.');
    }

    // Auto-generate a unique Login ID: FS-XXXXX
    do {
        $loginId = 'FS-' . strtoupper(substr(str_replace(' ', '', $location), 0, 3))
                         . '-' . str_pad(rand(1, 999), 3, '0', STR_PAD_LEFT);
        $check = $db->prepare('SELECT id FROM users WHERE login_id = ?');
        $check->execute([$loginId]);
    } while ($check->fetch()); // Regenerate if collision

    $hash = password_hash($password, PASSWORD_BCRYPT);

    $stmt = $db->prepare(
        'INSERT INTO users (login_id, password_hash, role, name, location)
         VALUES (?, ?, "branch", ?, ?)'
    );
    $stmt->execute([$loginId, $hash, $name, $location]);
    $newId = $db->lastInsertId();

    sendSuccess([
        'id'       => (int) $newId,
        'login_id' => $loginId,
        'name'     => $name,
        'location' => $location,
        'password' => $password, // Return plain text once so admin can note it down
    ], 'Branch account created.', 201);
}

// ------------------------------------------------------------------
// DELETE — Terminate (deactivate) a branch
// ------------------------------------------------------------------
if ($method === 'DELETE') {
    $admin = requireAdmin();
    $id = (int) ($_GET['id'] ?? 0);
    $input = getBody();
    $password = trim($input['password'] ?? '');

    if (!$id) {
        sendError('Branch ID is required.');
    }

    if (!$password) {
        sendError('Admin password is required to terminate a branch.');
    }

    // Verify admin password
    $stmt = $db->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$admin['id']]);
    $adminHash = $stmt->fetchColumn();

    if (!$adminHash || !password_verify($password, $adminHash)) {
        sendError('Incorrect admin password. Please try again.', 403);
    }

    $stmt = $db->prepare('UPDATE users SET is_active = 0 WHERE id = ? AND role = "branch"');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        sendError('Branch not found or already terminated.', 404);
    }

    // Cancel all pending orders for this branch so they do not return upon revert
    $cancelStmt = $db->prepare('UPDATE orders SET status = "Cancelled" WHERE branch_id = ? AND status = "Pending"');
    $cancelStmt->execute([$id]);

    sendSuccess([], 'Branch terminated successfully.');
}

// ------------------------------------------------------------------
// PATCH — Revert branch termination
// ------------------------------------------------------------------
if ($method === 'PATCH') {
    requireAdmin();
    $id = (int) ($_GET['id'] ?? 0);
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$id) {
        sendError('Branch ID is required.');
    }

    if (isset($input['action']) && $input['action'] === 'revert_terminate') {
        $stmt = $db->prepare('UPDATE users SET is_active = 1 WHERE id = ? AND role = "branch"');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            sendError('Branch not found or already active.', 404);
        }

        sendSuccess([], 'Branch successfully restored.');
    } else {
        sendError('Invalid action.');
    }
}

sendError('Method not allowed.', 405);
