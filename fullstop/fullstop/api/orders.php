<?php
// ============================================================
// api/orders.php — Supply Order Management
//
// GET    /api/orders.php              → Admin: all orders | Branch: own orders
// GET    /api/orders.php?branch_id=X  → Admin: filter by branch
// POST   /api/orders.php              → Branch: submit new order
// PATCH  /api/orders.php?id=X         → Admin: approve order (deducts inventory)
// DELETE /api/orders.php?id=X         → Branch: cancel a Pending order
// ============================================================

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ------------------------------------------------------------------
// GET — Fetch orders
// ------------------------------------------------------------------
if ($method === 'GET') {
    $user = requireLogin();

    if ($user['role'] === 'admin') {
        // Admin sees ALL orders, optionally filtered by branch_id
        $branchFilter = isset($_GET['branch_id']) ? (int) $_GET['branch_id'] : null;
        $sql = '
            SELECT o.id, o.order_code, o.type, o.total_amount, o.status,
                   o.date_placed, o.delivery_date, o.approved_at,
                   u.name AS branch_name, u.location AS branch_location,
                   u.is_active AS branch_is_active
            FROM orders o
            JOIN users u ON o.branch_id = u.id
        ';
        $params = [];
        if ($branchFilter) {
            $sql    .= ' WHERE o.branch_id = ?';
            $params[] = $branchFilter;
        }
        $sql .= ' ORDER BY o.date_placed DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();
    } else {
        // Branch only sees their own orders
        $stmt = $db->prepare('
            SELECT o.id, o.order_code, o.type, o.total_amount, o.status, o.date_placed, o.delivery_date
            FROM orders o
            WHERE o.branch_id = ?
            ORDER BY o.date_placed DESC
        ');
        $stmt->execute([$user['id']]);
        $orders = $stmt->fetchAll();
    }

    // Attach line items to each order
    foreach ($orders as &$order) {
        $itemStmt = $db->prepare(
            'SELECT item_name, quantity, unit_price, line_total FROM order_items WHERE order_id = ?'
        );
        $itemStmt->execute([$order['id']]);
        $order['items'] = $itemStmt->fetchAll();
    }

    sendSuccess($orders, 'Orders retrieved.');
}

// ------------------------------------------------------------------
// POST — Branch submits a new order
// ------------------------------------------------------------------
if ($method === 'POST') {
    $user = requireLogin();
    if ($user['role'] !== 'branch') {
        sendError('Only branch accounts can place orders.', 403);
    }

    $body  = getBody();
    $type  = strtoupper(trim($body['type'] ?? 'STANDARD'));
    $items = $body['items'] ?? []; // Array of {item_name, quantity, unit_price, line_total}

    if (empty($items)) {
        sendError('Order must contain at least one item.');
    }

    if (!in_array($type, ['STANDARD', 'RUSH'])) {
        $type = 'STANDARD';
    }

    // Calculate total
    $total = 0;
    foreach ($items as $item) {
        $total += (float) ($item['line_total'] ?? 0);
    }

    // Generate unique order code
    do {
        $orderCode = 'ORD-' . strtoupper(substr(uniqid(), -6));
        $check = $db->prepare('SELECT id FROM orders WHERE order_code = ?');
        $check->execute([$orderCode]);
    } while ($check->fetch());

    $db->beginTransaction();
    try {
        // Insert order header
        $stmt = $db->prepare('
            INSERT INTO orders (order_code, branch_id, type, total_amount, status)
            VALUES (?, ?, ?, ?, "Pending")
        ');
        $stmt->execute([$orderCode, $user['id'], $type, $total]);
        $orderId = $db->lastInsertId();

        // Insert line items
        $itemStmt = $db->prepare('
            INSERT INTO order_items (order_id, item_name, quantity, unit_price, line_total)
            VALUES (?, ?, ?, ?, ?)
        ');
        foreach ($items as $item) {
            $itemStmt->execute([
                $orderId,
                $item['item_name'],
                (int)   $item['quantity'],
                (float) $item['unit_price'],
                (float) $item['line_total'],
            ]);
        }

        $db->commit();
        sendSuccess(['order_code' => $orderCode, 'order_id' => $orderId], 'Order placed successfully.', 201);
    } catch (Exception $e) {
        $db->rollBack();
        sendError('Failed to place order: ' . $e->getMessage(), 500);
    }
}

// ------------------------------------------------------------------
// PATCH — Admin approves an order (and deducts inventory)
// ------------------------------------------------------------------
if ($method === 'PATCH') {
    requireAdmin();
    $id = (int) ($_GET['id'] ?? 0);

    // Read the delivery_date from the input body
    $input = json_decode(file_get_contents('php://input'), true);
    $deliveryDate = $input['delivery_date'] ?? null;

    if ($id <= 0) sendError('Invalid order ID.');

    try {
        $db->beginTransaction();

        $stmt = $db->prepare('SELECT status FROM orders WHERE id = ?');
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) {
            sendError('Order not found.', 404);
        }
        if ($order['status'] !== 'Pending') {
            sendError('Only Pending orders can be approved.');
        }

        // Fetch order items
        $itemStmt = $db->prepare('SELECT item_name, quantity FROM order_items WHERE order_id = ?');
        $itemStmt->execute([$id]);
        $items = $itemStmt->fetchAll();

        // Check stock availability
        $checkStmt = $db->prepare('SELECT stock FROM inventory WHERE item_name = ?');
        foreach ($items as $item) {
            $checkStmt->execute([$item['item_name']]);
            $inv = $checkStmt->fetch();
            if (!$inv || $inv['stock'] < $item['quantity']) {
                sendError('Not enough stock for: ' . $item['item_name']);
            }
        }

        // Deduct stock
        $deductStmt = $db->prepare('UPDATE inventory SET stock = stock - ? WHERE item_name = ?');
        foreach ($items as $item) {
            $deductStmt->execute([$item['quantity'], $item['item_name']]);
        }

        // Mark order as approved and set delivery date
        if ($deliveryDate) {
            $approveStmt = $db->prepare('UPDATE orders SET status = "Approved", delivery_date = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?');
            $approveStmt->execute([$deliveryDate, $id]);
        } else {
            $approveStmt = $db->prepare('UPDATE orders SET status = "Approved", approved_at = CURRENT_TIMESTAMP WHERE id = ?');
            $approveStmt->execute([$id]);
        }

        $db->commit();
        sendSuccess(['order_id' => $id, 'delivery_date' => $deliveryDate], 'Order approved and inventory updated.');
    } catch (Exception $e) {
        $db->rollBack();
        sendError('Failed to approve order: ' . $e->getMessage(), 500);
    }
}

// ------------------------------------------------------------------
// DELETE — Branch cancels a Pending order
// ------------------------------------------------------------------
if ($method === 'DELETE') {
    $user = requireLogin();
    $id   = (int) ($_GET['id'] ?? 0);

    if (!$id) {
        sendError('Order ID is required.');
    }

    // Find order and verify ownership (branch can only cancel their own)
    $where  = $user['role'] === 'admin' ? 'id = ?' : 'id = ? AND branch_id = ' . $user['id'];
    $stmt   = $db->prepare("SELECT * FROM orders WHERE $where AND status = 'Pending' LIMIT 1");
    $stmt->execute([$id]);
    $order  = $stmt->fetch();

    if (!$order) {
        sendError('Order not found, already processed, or you do not own it.', 404);
    }

    $del = $db->prepare('UPDATE orders SET status = "Cancelled" WHERE id = ?');
    $del->execute([$id]);

    sendSuccess([], 'Order cancelled successfully.');
}

sendError('Method not allowed.', 405);
