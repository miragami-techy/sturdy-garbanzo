<?php
// ============================================================
// api/announcements.php — Broadcast Announcements
//
// GET   /api/announcements.php                → All announcements
// GET   /api/announcements.php?action=unread  → Unread count for current branch
// POST  /api/announcements.php                → Admin: send announcement
// POST  /api/announcements.php?action=markread → Branch: mark all as read
// ============================================================

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();
$action = $_GET['action'] ?? '';

// ------------------------------------------------------------------
// GET — Fetch announcements
// ------------------------------------------------------------------
if ($method === 'GET') {
    $user = requireLogin();

    // Return unread count for this branch
    if ($action === 'unread' && $user['role'] === 'branch') {
        $stmt = $db->prepare('
            SELECT COUNT(*) as unread
            FROM announcements a
            WHERE a.id NOT IN (
                SELECT ar.announcement_id
                FROM announcement_reads ar
                WHERE ar.branch_id = ?
            )
        ');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
        sendSuccess(['unread_count' => (int) $row['unread']], 'Unread count retrieved.');
    }

    // Return all announcements (newest first)
    $stmt = $db->query('SELECT * FROM announcements ORDER BY created_at DESC');
    $announcements = $stmt->fetchAll();

    sendSuccess($announcements, 'Announcements retrieved.');
}

// ------------------------------------------------------------------
// POST — Admin sends announcement OR Branch marks as read
// ------------------------------------------------------------------
if ($method === 'POST') {
    $user = requireLogin();

    // Branch marks all announcements as read
    if ($action === 'markread') {
        if ($user['role'] !== 'branch') {
            sendError('Only branch accounts can mark announcements as read.', 403);
        }

        // Get all announcement IDs not yet read by this branch
        $stmt = $db->prepare('
            SELECT id FROM announcements
            WHERE id NOT IN (
                SELECT announcement_id FROM announcement_reads WHERE branch_id = ?
            )
        ');
        $stmt->execute([$user['id']]);
        $unread = $stmt->fetchAll();

        $insertStmt = $db->prepare(
            'INSERT IGNORE INTO announcement_reads (announcement_id, branch_id) VALUES (?, ?)'
        );
        foreach ($unread as $row) {
            $insertStmt->execute([$row['id'], $user['id']]);
        }

        sendSuccess([], 'All announcements marked as read.');
    }

    // Admin broadcasts a new announcement
    if ($user['role'] !== 'admin') {
        sendError('Only admins can send announcements.', 403);
    }

    $body    = getBody();
    $message = trim($body['message'] ?? '');

    if (!$message) {
        sendError('Message cannot be empty.');
    }

    $stmt = $db->prepare('INSERT INTO announcements (message, sent_by) VALUES (?, ?)');
    $stmt->execute([$message, $user['id']]);
    $newId = $db->lastInsertId();

    sendSuccess(['announcement_id' => $newId], 'Announcement sent to all branches.', 201);
}

sendError('Method not allowed.', 405);
