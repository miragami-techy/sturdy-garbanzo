<?php
require 'config.php';
$db = getDB();

$db->exec("
    CREATE TABLE IF NOT EXISTS auto_replies (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        question_text VARCHAR(255) NOT NULL,
        answer_text   TEXT NOT NULL,
        created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
");

echo "auto_replies table created successfully.\n";
