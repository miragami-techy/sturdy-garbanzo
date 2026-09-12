<?php
require 'd:/Download/Xampp/htdocs/fullstop/api/config.php';
$db = getDB();

$db->exec("
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

$db->exec("
    CREATE TABLE IF NOT EXISTS inquiry_messages (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        inquiry_id    INT NOT NULL,
        sender        ENUM('guest', 'admin') NOT NULL,
        message_text  TEXT NOT NULL,
        created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE
    )
");

echo "Tables created successfully.";
