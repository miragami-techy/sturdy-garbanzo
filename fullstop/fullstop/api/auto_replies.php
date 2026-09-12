<?php
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

if ($method === 'GET') {
    // Both Guest and Admin need to fetch these, so no requireLogin() here
    $stmt = $db->query('SELECT * FROM auto_replies ORDER BY created_at ASC');
    $replies = $stmt->fetchAll();
    sendSuccess($replies, 'Auto replies retrieved.');
}

if ($method === 'POST') {
    requireAdmin(); // Only admin can create or delete
    
    $action = $_GET['action'] ?? '';
    $body = getBody();

    if ($action === 'create') {
        $question = trim($body['question_text'] ?? '');
        $answer = trim($body['answer_text'] ?? '');

        if (!$question || !$answer) {
            sendError('Both question and answer text are required.');
        }

        $stmt = $db->prepare('INSERT INTO auto_replies (question_text, answer_text) VALUES (?, ?)');
        $stmt->execute([$question, $answer]);
        $id = $db->lastInsertId();

        sendSuccess(['id' => $id, 'question_text' => $question, 'answer_text' => $answer], 'Auto reply created.', 201);
    }

    if ($action === 'delete') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) {
            sendError('ID is required.');
        }

        $stmt = $db->prepare('DELETE FROM auto_replies WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            sendError('Auto reply not found.', 404);
        }

        sendSuccess(['id' => $id], 'Auto reply deleted.');
    }

    if ($action === 'edit') {
        $id = (int)($body['id'] ?? 0);
        $question = trim($body['question_text'] ?? '');
        $answer = trim($body['answer_text'] ?? '');

        if (!$id) {
            sendError('ID is required.');
        }
        if (!$question || !$answer) {
            sendError('Both question and answer text are required.');
        }

        $stmt = $db->prepare('UPDATE auto_replies SET question_text = ?, answer_text = ? WHERE id = ?');
        $stmt->execute([$question, $answer, $id]);

        if ($stmt->rowCount() === 0) {
            // It might be that the data wasn't changed, but if the ID doesn't exist it also returns 0.
            // Let's just return success anyway, or check if it exists.
        }

        sendSuccess(['id' => $id, 'question_text' => $question, 'answer_text' => $answer], 'Auto reply updated.');
    }

    sendError('Unknown action. Use ?action=create, ?action=delete, or ?action=edit');
}

sendError('Method not allowed.', 405);
