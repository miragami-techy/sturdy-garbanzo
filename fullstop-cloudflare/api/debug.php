<?php
$hash = '$2y$10$JQ9yZqqihM9J8md2eNX6V.6acz65XbWT8XvysmDHGe5sdqTBUb2EO';
echo "password: " . (password_verify('password', $hash) ? 'YES' : 'NO') . "\n";
echo "admin: " . (password_verify('admin', $hash) ? 'YES' : 'NO') . "\n";
echo "admin123: " . (password_verify('admin123', $hash) ? 'YES' : 'NO') . "\n";
echo "fs-admin: " . (password_verify('fs-admin', $hash) ? 'YES' : 'NO') . "\n";
