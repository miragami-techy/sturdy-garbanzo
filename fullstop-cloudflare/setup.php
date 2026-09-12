<?php
// ============================================================
// setup.php — One-time setup helper
// Run this ONCE in your browser: http://localhost/fullstop/setup.php
// It will:
//   1. Create the database if it doesn't exist
//   2. Create all tables
//   3. Seed the admin account with the correct password hash
//   4. Seed inventory items
// DELETE this file after setup is complete!
// ============================================================

$host    = 'localhost';
$user    = 'root';
$pass    = '';
$dbName  = 'fullstop_db';

echo "<pre style='font-family:monospace;font-size:14px;padding:20px;'>";
echo "=== FULLSTOP BURGER — DATABASE SETUP ===\n\n";

try {
    // Connect without selecting a database first
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    // Create database
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "✅ Database '$dbName' ready.\n";

    // Switch to it
    $pdo->exec("USE `$dbName`");

    // ---- Create tables ----
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            login_id      VARCHAR(50)  NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role          ENUM('admin','branch') NOT NULL DEFAULT 'branch',
            name          VARCHAR(100) NOT NULL,
            location      VARCHAR(100) DEFAULT NULL,
            is_active     TINYINT(1)   NOT NULL DEFAULT 1,
            created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Table 'users' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            item_name  VARCHAR(100)  NOT NULL UNIQUE,
            category   VARCHAR(60)   NOT NULL,
            stock      INT           NOT NULL DEFAULT 0,
            max_stock  INT           NOT NULL DEFAULT 0,
            unit       VARCHAR(30)   NOT NULL,
            threshold  INT           NOT NULL DEFAULT 0,
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            updated_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Table 'inventory' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            order_code   VARCHAR(20)  NOT NULL UNIQUE,
            branch_id    INT          NOT NULL,
            type         ENUM('STANDARD','RUSH') NOT NULL DEFAULT 'STANDARD',
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status       ENUM('Pending','Approved','Cancelled') NOT NULL DEFAULT 'Pending',
            date_placed  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (branch_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");
    echo "✅ Table 'orders' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS order_items (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            order_id   INT           NOT NULL,
            item_name  VARCHAR(100)  NOT NULL,
            quantity   INT           NOT NULL DEFAULT 1,
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
    ");
    echo "✅ Table 'order_items' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS announcements (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            message    TEXT      NOT NULL,
            sent_by    INT       NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE CASCADE
        )
    ");
    echo "✅ Table 'announcements' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS announcement_reads (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            announcement_id INT       NOT NULL,
            branch_id       INT       NOT NULL,
            read_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_read (announcement_id, branch_id),
            FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
            FOREIGN KEY (branch_id)       REFERENCES users(id)         ON DELETE CASCADE
        )
    ");
    echo "✅ Table 'announcement_reads' ready.\n\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inquiries (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            tracking_code VARCHAR(50)  NOT NULL UNIQUE,
            package_type  VARCHAR(100) NOT NULL,
            guest_name    VARCHAR(150) NOT NULL,
            contact_info  VARCHAR(150) NOT NULL,
            status        ENUM('Unread', 'Replied', 'Closed') DEFAULT 'Unread',
            created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Table 'inquiries' ready.\n";

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inquiry_messages (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            inquiry_id    INT NOT NULL,
            sender        ENUM('guest', 'admin') NOT NULL,
            message_text  TEXT NOT NULL,
            created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
        )
    ");
    echo "✅ Table 'inquiry_messages' ready.\n\n";

    // ---- Seed Admin ----
    $check = $pdo->prepare("SELECT id FROM users WHERE login_id = 'FS-ADMIN'");
    $check->execute();
    if (!$check->fetch()) {
        $hash = password_hash('admin123', PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (login_id, password_hash, role, name, location) VALUES ('FS-ADMIN', ?, 'admin', 'Main Office Admin', 'Head Quarters')");
        $stmt->execute([$hash]);
        echo "✅ Admin account created. Login: FS-ADMIN / admin123\n";
    } else {
        echo "ℹ️  Admin account already exists. Skipped.\n";
    }

    // ---- Seed Inventory ----
    $invItems = [
        ['Burger Patty',           'Main Items',        5000, 5000, 'pcs',    1000, 13.00],
        ['Hotdog (26pcs)',          'Main Items',         200,  200, 'packs',    50, 210.00],
        ['Hungarian (9pcs)',        'Main Items',         150,  150, 'packs',    30, 295.00],
        ['Footlong (10pcs)',        'Main Items',         200,  200, 'packs',    40, 215.00],
        ['Sliced Cheese',           'Cheese & Sauces',  1000, 1000, 'packs',   200,  83.00],
        ['Bar Cheese',              'Cheese & Sauces',   500,  500, 'blocks',  100, 120.00],
        ['Mayonnaise (1 Gal)',      'Cheese & Sauces',   100,  100, 'gal',      20, 390.00],
        ['Ketchup (1 Gal)',         'Cheese & Sauces',   150,  150, 'gal',      30, 100.00],
        ['Hot Sauce (1 Gal)',       'Cheese & Sauces',    80,   80, 'gal',      15, 155.00],
        ['Burger Buns (6pcs)',      'Packaging & Buns', 1000, 1000, 'packs',   200,  19.00],
        ['Foot Long Buns (6pcs)',   'Packaging & Buns',  500,  500, 'packs',   100,  18.00],
        ['Burger Plastic (1k)',     'Packaging & Buns',   50,   50, 'packs',    10, 295.00],
        ['Hotdog Plastic (1k)',     'Packaging & Buns',   50,   50, 'packs',    10, 300.00],
        ['Foot Long Plastic (1k)',  'Packaging & Buns',   50,   50, 'packs',    10, 115.00],
        ['Tiny Wrapper (620pcs)',   'Packaging & Buns',  100,  100, 'packs',    20, 150.00],
    ];

    $invStmt = $pdo->prepare("
        INSERT IGNORE INTO inventory (item_name, category, stock, max_stock, unit, threshold, unit_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $seeded = 0;
    foreach ($invItems as $item) {
        $invStmt->execute($item);
        if ($invStmt->rowCount()) $seeded++;
    }
    echo "✅ Inventory: $seeded new item(s) seeded (" . count($invItems) . " total).\n\n";

    echo "===========================================\n";
    echo "🎉 SETUP COMPLETE!\n\n";
    echo "Next steps:\n";
    echo "  1. Delete this file (setup.php) for security.\n";
    echo "  2. Open: http://localhost/fullstop/system-portal.html\n";
    echo "  3. Login with: FS-ADMIN / admin123\n";
    echo "===========================================\n";

} catch (PDOException $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "\nMake sure XAMPP is running (Apache + MySQL).\n";
}

echo "</pre>";
