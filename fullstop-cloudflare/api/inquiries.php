<?php
require 'config.php';
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ------------------------------------------------------------------
// GET - Fetch inquiries or messages
// ------------------------------------------------------------------
if ($method === 'GET') {
    $tracking_code = $_GET['tracking_code'] ?? '';

    // Guest fetching their specific chat history
    if ($tracking_code !== '') {
        $stmt = $db->prepare('SELECT * FROM inquiries WHERE tracking_code = ?');
        $stmt->execute([$tracking_code]);
        $inquiry = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$inquiry) {
            sendError('Inquiry not found.', 404);
        }

        $msgStmt = $db->prepare('SELECT * FROM inquiry_messages WHERE inquiry_id = ? ORDER BY created_at ASC');
        $msgStmt->execute([$inquiry['id']]);
        $messages = $msgStmt->fetchAll(PDO::FETCH_ASSOC);

        $inquiry['messages'] = $messages;
        sendSuccess($inquiry, 'Chat history loaded.');
    } 
    // Admin fetching all inquiries
    else {
        requireAdmin();
        $stmt = $db->prepare('
            SELECT i.*, 
                   (SELECT message_text FROM inquiry_messages WHERE inquiry_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message,
                   (SELECT created_at FROM inquiry_messages WHERE inquiry_id = i.id ORDER BY created_at DESC LIMIT 1) as last_message_time
            FROM inquiries i
            ORDER BY i.created_at DESC
        ');
        $stmt->execute();
        $inquiries = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendSuccess($inquiries, 'Inquiries loaded.');
    }
}

// ------------------------------------------------------------------
// POST - Create inquiry or reply to inquiry
// ------------------------------------------------------------------
if ($method === 'POST') {
    $action = $_GET['action'] ?? '';
    $input = getBody();

    if ($action === 'create') {
        $package_type = trim($input['package_type'] ?? '');
        $guest_name = trim($input['guest_name'] ?? '');
        $contact_info = trim($input['contact_info'] ?? '');
        $message_text = trim($input['message_text'] ?? '');

        if (!$package_type || !$guest_name || !$contact_info || !$message_text) {
            sendError('Please fill out all fields.');
        }

        // Generate a random 10-character tracking code
        $tracking_code = 'FS-' . strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 10));

        $stmt = $db->prepare('INSERT INTO inquiries (tracking_code, package_type, guest_name, contact_info) VALUES (?, ?, ?, ?)');
        $stmt->execute([$tracking_code, $package_type, $guest_name, $contact_info]);
        $inquiry_id = $db->lastInsertId();

        $msgStmt = $db->prepare('INSERT INTO inquiry_messages (inquiry_id, sender, message_text) VALUES (?, "guest", ?)');
        $msgStmt->execute([$inquiry_id, $message_text]);

        sendSuccess(['tracking_code' => $tracking_code], 'Inquiry sent.', 201);
    } 
    
    else if ($action === 'reply') {
        $message_text = trim($input['message_text'] ?? '');
        if (!$message_text) sendError('Message cannot be empty.');

        $tracking_code = $input['tracking_code'] ?? '';
        $inquiry_id = (int)($input['inquiry_id'] ?? 0);

        // Guest reply via tracking code
        if ($tracking_code !== '') {
            $stmt = $db->prepare('SELECT id FROM inquiries WHERE tracking_code = ?');
            $stmt->execute([$tracking_code]);
            $inquiry = $stmt->fetch();
            if (!$inquiry) sendError('Invalid tracking code.', 404);

            $msgStmt = $db->prepare('INSERT INTO inquiry_messages (inquiry_id, sender, message_text) VALUES (?, "guest", ?)');
            $msgStmt->execute([$inquiry['id'], $message_text]);

            // Update status to Unread for admin to see
            $db->prepare('UPDATE inquiries SET status = "Unread" WHERE id = ?')->execute([$inquiry['id']]);

            sendSuccess([], 'Reply sent.');
        } 
        // Admin reply via inquiry_id
        else if ($inquiry_id > 0) {
            requireAdmin();
            $stmt = $db->prepare('SELECT id FROM inquiries WHERE id = ?');
            $stmt->execute([$inquiry_id]);
            if (!$stmt->fetch()) sendError('Inquiry not found.', 404);

            $msgStmt = $db->prepare('INSERT INTO inquiry_messages (inquiry_id, sender, message_text) VALUES (?, "admin", ?)');
            $msgStmt->execute([$inquiry_id, $message_text]);

            // Update status to Replied
            $db->prepare('UPDATE inquiries SET status = "Replied" WHERE id = ?')->execute([$inquiry_id]);

            sendSuccess([], 'Reply sent.');
        } 
        else {
            sendError('Tracking code or Inquiry ID is required to reply.');
        }
    } 
    else if ($action === 'auto_reply') {
        $tracking_code = $input['tracking_code'] ?? '';
        $auto_reply_id = (int)($input['auto_reply_id'] ?? 0);

        if (!$tracking_code || !$auto_reply_id) {
            sendError('Tracking code and auto_reply_id are required.');
        }

        $stmt = $db->prepare('SELECT id FROM inquiries WHERE tracking_code = ?');
        $stmt->execute([$tracking_code]);
        $inquiry = $stmt->fetch();
        if (!$inquiry) sendError('Invalid tracking code.', 404);

        $replyStmt = $db->prepare('SELECT question_text, answer_text FROM auto_replies WHERE id = ?');
        $replyStmt->execute([$auto_reply_id]);
        $autoReply = $replyStmt->fetch();

        if (!$autoReply) sendError('Auto reply not found.', 404);

        // Insert guest question
        $msgStmt = $db->prepare('INSERT INTO inquiry_messages (inquiry_id, sender, message_text) VALUES (?, "guest", ?)');
        $msgStmt->execute([$inquiry['id'], $autoReply['question_text']]);

        // Insert admin answer
        $msgStmt2 = $db->prepare('INSERT INTO inquiry_messages (inquiry_id, sender, message_text) VALUES (?, "admin", ?)');
        $msgStmt2->execute([$inquiry['id'], $autoReply['answer_text']]);

        // Update status to Replied (since admin has "replied")
        $db->prepare('UPDATE inquiries SET status = "Replied" WHERE id = ?')->execute([$inquiry['id']]);

        sendSuccess([], 'Auto reply processed.');
    }
    
    else {
        sendError('Invalid action parameter.');
    }
}
