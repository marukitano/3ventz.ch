<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

csrf_check();

$id = (int)($_POST['id'] ?? 0);
if ($id > 0) {
    $stmt = $pdo->prepare('DELETE FROM events WHERE id = ?');
    $stmt->execute([$id]);
}

header('Location: /admin/');
exit;
