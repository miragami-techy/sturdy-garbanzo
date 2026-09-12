<?php
// ============================================================
// api/inventory.php — Inventory Management
//
// GET   /api/inventory.php              → Get all stock items
// POST  /api/inventory.php?action=restock → Admin: reset all to max stock
// POST  /api/inventory.php?action=update  → Admin: manually set a stock value
// ============================================================

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ------------------------------------------------------------------
// GET — Return all inventory items with computed status
// ------------------------------------------------------------------
if ($method === 'GET') {
    requireLogin();

    $stmt = $db->query('SELECT * FROM inventory ORDER BY category, item_name');
    $items = $stmt->fetchAll();

    // Compute status label server-side as well (frontend can use this)
    foreach ($items as &$item) {
        if ($item['stock'] <= 0) {
            $item['status'] = 'Out of Stock';
        } elseif ($item['stock'] <= $item['threshold']) {
            $item['status'] = 'Low Stock';
        } else {
            $item['status'] = 'Good';
        }
    }

    sendSuccess($items, 'Inventory retrieved.');
}

// ------------------------------------------------------------------
// POST — Admin actions on inventory
// ------------------------------------------------------------------
if ($method === 'POST') {
    requireAdmin();
    $action = $_GET['action'] ?? 'restock';
    $body   = getBody();

    // --- Restock all: set stock = max_stock for all items
    if ($action === 'restock') {
        $db->exec('UPDATE inventory SET stock = max_stock');
        sendSuccess([], 'All inventory restocked to maximum capacity.');
    }

    // --- Update single item stock (e.g. manual adjustment)
    if ($action === 'update') {
        $itemName = trim($body['item_name'] ?? '');
        $newStock = (int) ($body['stock'] ?? -1);

        if (!$itemName || $newStock < 0) {
            sendError('item_name and a non-negative stock value are required.');
        }

        $stmt = $db->prepare('UPDATE inventory SET stock = ? WHERE item_name = ?');
        $stmt->execute([$newStock, $itemName]);

        if ($stmt->rowCount() === 0) {
            sendError('Item not found.', 404);
        }

        sendSuccess(['item_name' => $itemName, 'stock' => $newStock], 'Stock updated.');
    }

    // --- Add stock: increment existing item's stock
    if ($action === 'add_stock') {
        $itemName = trim($body['item_name'] ?? '');
        $addQty   = (int) ($body['quantity'] ?? 0);

        if (!$itemName || $addQty <= 0) {
            sendError('item_name and a positive quantity are required.');
        }

        $stmt = $db->prepare('UPDATE inventory SET stock = stock + ? WHERE item_name = ?');
        $stmt->execute([$addQty, $itemName]);

        if ($stmt->rowCount() === 0) {
            sendError('Item not found.', 404);
        }

        // Return new stock level
        $newStmt = $db->prepare('SELECT stock FROM inventory WHERE item_name = ?');
        $newStmt->execute([$itemName]);
        $row = $newStmt->fetch();

        sendSuccess(['item_name' => $itemName, 'new_stock' => (int)$row['stock']], 'Stock added successfully.');
    }

    // --- Update item price
    if ($action === 'update_price') {
        $itemName = trim($body['item_name'] ?? '');
        $newPrice = (float) ($body['unit_price'] ?? -1);

        if (!$itemName || $newPrice < 0) {
            sendError('item_name and a non-negative unit_price are required.');
        }

        $stmt = $db->prepare('UPDATE inventory SET unit_price = ? WHERE item_name = ?');
        $stmt->execute([$newPrice, $itemName]);

        if ($stmt->rowCount() === 0) {
            sendError('Item not found.', 404);
        }

        sendSuccess(['item_name' => $itemName, 'unit_price' => $newPrice], 'Price updated.');
    }

    // --- Add new inventory item
    if ($action === 'add_item') {
        $itemName  = trim($body['item_name']  ?? '');
        $category  = trim($body['category']   ?? '');
        $stock     = (int) ($body['stock']     ?? 0);
        $maxStock  = (int) ($body['max_stock'] ?? $stock);
        $unit      = trim($body['unit']        ?? 'pcs');
        $unitPrice = (float) ($body['unit_price'] ?? 0.00);
        $threshold = (int) ($body['threshold'] ?? max(1, intval($stock * 0.2)));

        if (!$itemName || !$category) {
            sendError('item_name and category are required.');
        }

        $allowed = ['Main Items', 'Cheese & Sauces', 'Packaging & Buns'];
        if (!in_array($category, $allowed)) {
            sendError('Invalid category. Must be: Main Items, Cheese & Sauces, or Packaging & Buns.');
        }

        $stmt = $db->prepare('
            INSERT INTO inventory (item_name, category, stock, max_stock, unit, threshold, unit_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ');
        try {
            $stmt->execute([$itemName, $category, $stock, $maxStock, $unit, $threshold, $unitPrice]);
            sendSuccess(['item_name' => $itemName], 'Item added to inventory.', 201);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                sendError('An item with this name already exists.', 409);
            }
            sendError('Failed to add item: ' . $e->getMessage(), 500);
        }
    }

    // --- Delete item
    if ($action === 'delete') {
        $itemName = trim($body['item_name'] ?? '');
        if (!$itemName) {
            sendError('item_name is required.');
        }

        $stmt = $db->prepare('DELETE FROM inventory WHERE item_name = ?');
        $stmt->execute([$itemName]);

        if ($stmt->rowCount() === 0) {
            sendError('Item not found.', 404);
        }

        sendSuccess(['item_name' => $itemName], 'Item deleted successfully.');
    }

    sendError('Unknown action. Use ?action=restock, ?action=update, ?action=add_stock, ?action=add_item, or ?action=delete');
}

sendError('Method not allowed.', 405);
