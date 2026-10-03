<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

$edit = null;
if (isset($_GET['edit'])) {
    $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
    $stmt->execute([(int)$_GET['edit']]);
    $edit = $stmt->fetch() ?: null;
}

$events = $pdo->query('SELECT * FROM events ORDER BY start_date DESC, title')->fetchAll();

$iconOptions = [
    'terminal' => '>_ Terminal',
    'pebble_rocket' => 'Pebble Rocket',
    'pebble_console' => 'Pebble Developer Console',
    'pebble_toolbox' => 'Pebble Toolbox',
    'pebble_floppy' => 'Pebble Floppy Disk',
    'pebble_location' => 'Pebble Location',
    'pebble_calendar' => 'Pebble Calendar',
    'pebble_warning' => 'Pebble Warning',
    'pebble_microphone' => 'Pebble Microphone',
    'pebble_radio' => 'Pebble Radio',
]
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>3ventz // admin</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/">← Kalender</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1><?= $edit ? 'EVENT EDIT' : 'NEW EVENT' ?></h1>

        <form method="post" action="/admin/save.php">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="id" value="<?= h((string)($edit['id'] ?? '')) ?>">

            <div class="form-grid">
                <label>
                    Titel
                    <input name="title" maxlength="180" required value="<?= h($edit['title'] ?? '') ?>">
                </label>
                <label>
                    Kategorie
                    <input name="category" maxlength="80" value="<?= h($edit['category'] ?? '') ?>" placeholder="CCC, CTF, Meetup ...">
                </label>
                <label>
                    Start
                    <input type="date" name="start_date" required value="<?= h($edit['start_date'] ?? '') ?>">
                </label>
                <label>
                    Ende
                    <input type="date" name="end_date" value="<?= h($edit['end_date'] ?? '') ?>">
                </label>
                <label>
                    URL
                    <input type="text" name="url" maxlength="500" value="<?= h($edit['url'] ?? '') ?>" placeholder="odenwilusenz.ch oder https://...">
                </label>
                <label>
                    Neonfarbe
                    <input type="color" name="color" value="<?= h($edit['color'] ?? '#00f5ff') ?>">
                </label>
                <label>
                    Icon
                    <select name="icon">
                        <?php foreach ($iconOptions as $value => $label): ?>
                            <option value="<?= h($value) ?>" <?= (($edit['icon'] ?? 'terminal') === $value) ? 'selected' : '' ?>>
                                <?= h($label) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>
            </div>

            <p>
                <label>
                    Beschreibung
                    <textarea name="description"><?= h($edit['description'] ?? '') ?></textarea>
                </label>
            </p>

            <div class="actions">
                <button type="submit"><?= $edit ? 'SAVE CHANGES' : 'ADD EVENT' ?></button>
                <?php if ($edit): ?><a class="button secondary" href="/admin/">Cancel</a><?php endif; ?>
            </div>
        </form>
    </section>

    <section class="admin-card">
        <h2>EVENT DATABASE</h2>
        <div style="overflow:auto">
            <table class="event-list">
                <thead><tr><th>Datum</th><th>Event</th><th>Aktion</th></tr></thead>
                <tbody>
                <?php foreach ($events as $event): ?>
                    <tr>
                        <td><?= h($event['start_date']) ?><?= $event['end_date'] ? ' → ' . h($event['end_date']) : '' ?></td>
                        <td>
                            <strong><?= h($event['title']) ?></strong>
                            <?php if ($event['category']): ?><br><small><?= h($event['category']) ?></small><?php endif; ?>
                        </td>
                        <td>
                            <div class="actions">
                                <a class="button secondary" href="?edit=<?= (int)$event['id'] ?>">Edit</a>
                                <form method="post" action="/admin/delete.php" onsubmit="return confirm('Event wirklich löschen?')">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="id" value="<?= (int)$event['id'] ?>">
                                    <button class="danger" type="submit">Delete</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$events): ?>
                    <tr><td colspan="3">Noch keine Events.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</main>
</body>
</html>
