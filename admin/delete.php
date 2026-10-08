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
    $stmt = $pdo->prepare('SELECT id, owner_user_id FROM events WHERE id = ?');
    $stmt->execute([$id]);
    $event = $stmt->fetch();

    if (!$event) {
        http_response_code(404);
        exit('Event nicht gefunden.');
    }

    if (!can_manage_event($event)) {
        http_response_code(403);
        exit('Dieses Event darfst du nicht löschen.');
    }

    if (is_super_admin()) {
        $stmt = $pdo->prepare('DELETE FROM events WHERE id = ?');
        $stmt->execute([$id]);
    } else {
        $stmt = $pdo->prepare('DELETE FROM events WHERE id = ? AND owner_user_id = ?');
        $stmt->execute([$id, current_user_id()]);
    }

    audit_event('event.delete', $id, (string)($event['title'] ?? ''));
}

header('Location: /admin/');
exit;
