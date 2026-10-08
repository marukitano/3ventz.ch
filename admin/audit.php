<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
super_admin_required();

$rows = $pdo->query(
    'SELECT actor_name, action, event_id, event_title, created_at
     FROM audit_log
     ORDER BY id DESC
     LIMIT 200'
)->fetchAll();
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // audit</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/admin/">← Events</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1>AUDIT LOG</h1>
        <p><small>Die letzten 200 Event-Änderungen. Nur für den Administrator sichtbar.</small></p>
        <div style="overflow:auto">
            <table class="event-list">
                <thead>
                    <tr><th>Zeit</th><th>User</th><th>Aktion</th><th>Event</th></tr>
                </thead>
                <tbody>
                <?php foreach ($rows as $row): ?>
                    <tr>
                        <td><?= h((string)$row['created_at']) ?></td>
                        <td><?= h((string)$row['actor_name']) ?></td>
                        <td><?= h((string)$row['action']) ?></td>
                        <td>
                            <?= h((string)($row['event_title'] ?? '')) ?>
                            <?php if (!empty($row['event_id'])): ?>
                                <small>#<?= (int)$row['event_id'] ?></small>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$rows): ?><tr><td colspan="4">Noch keine protokollierten Änderungen.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</main>
</body>
</html>
