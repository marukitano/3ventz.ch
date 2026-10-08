<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

$edit = null;
if (isset($_GET['edit'])) {
    if (is_super_admin()) {
        $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
        $stmt->execute([(int)$_GET['edit']]);
    } else {
        $stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? AND owner_user_id = ?');
        $stmt->execute([(int)$_GET['edit'], current_user_id()]);
    }

    $edit = $stmt->fetch() ?: null;

    if (!$edit) {
        http_response_code(403);
        exit('Dieses Event darfst du nicht bearbeiten.');
    }
}

if (is_super_admin()) {
    $events = $pdo->query(
        'SELECT e.*, u.display_name AS owner_name
         FROM events e
         LEFT JOIN users u ON u.id = e.owner_user_id
         ORDER BY e.start_date DESC, e.title'
    )->fetchAll();
} else {
    $stmt = $pdo->prepare(
        'SELECT e.*, u.display_name AS owner_name
         FROM events e
         LEFT JOIN users u ON u.id = e.owner_user_id
         WHERE e.owner_user_id = ?
         ORDER BY e.start_date DESC, e.title'
    );
    $stmt->execute([current_user_id()]);
    $events = $stmt->fetchAll();
}

$categoryOptions = [
    'CCC',
    'DEMO',
    'RETRO',
    'MAKER',
    'MOVIE',
    'LAN',
    'MUSIC',
    'CODING',
    'HACKING',
];

$iconOptions = [
    'none' => 'Kein Icon',
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
];

function admin_date_display(?string $date): string
{
    if (!$date) {
        return '';
    }

    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    return $parsed ? $parsed->format('d.m.Y') : $date;
}
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // admin</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/">← Kalender</a>
        <div class="actions">
            <span><?= h(current_user_name()) ?></span>
            <?php if (is_super_admin()): ?>
                <a class="button secondary" href="/admin/audit.php">Audit</a>
                <a class="button secondary" href="/admin/users.php">Users</a>
            <?php endif; ?>
            <a class="button secondary" href="/admin/logout.php">Logout</a>
        </div>
    </div>

    <section class="admin-card">
        <h1><?= $edit ? 'EVENT EDIT' : 'NEW EVENT' ?></h1>

        <?php if (!is_super_admin()): ?>
            <p><small>Du kannst nur deine eigenen Events anlegen, bearbeiten und löschen.</small></p>
        <?php endif; ?>

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
                    <select name="category" required>
                        <?php foreach ($categoryOptions as $category): ?>
                            <option value="<?= h($category) ?>" <?= (($edit['category'] ?? 'CCC') === $category) ? 'selected' : '' ?>>
                                <?= h($category) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>
                    Ort
                    <input name="location" maxlength="255"
                           value="<?= h($edit['location'] ?? '') ?>"
                           placeholder="z.B. Schaffhausen, Schweiz">
                </label>
                <label>
                    Start
                    <input type="text" inputmode="numeric" name="start_date" required
                           placeholder="TT.MM.JJJJ" pattern="\d{2}\.\d{2}\.\d{4}"
                           value="<?= h(admin_date_display($edit['start_date'] ?? null)) ?>">
                </label>
                <label>
                    Ende
                    <input type="text" inputmode="numeric" name="end_date"
                           placeholder="TT.MM.JJJJ" pattern="\d{2}\.\d{2}\.\d{4}"
                           value="<?= h(admin_date_display($edit['end_date'] ?? null)) ?>">
                </label>
                <label>
                    URL
                    <input type="text" name="url" maxlength="500" value="<?= h($edit['url'] ?? '') ?>" placeholder="example.org oder https://...">
                </label>
                <label>
                    Neonfarbe
                    <input type="color" name="color" value="<?= h($edit['color'] ?? '#00f5ff') ?>">
                </label>
                <label>
                    Icon
                    <select name="icon">
                        <?php foreach ($iconOptions as $value => $label): ?>
                            <option value="<?= h($value) ?>" <?= (($edit['icon'] ?? 'none') === $value) ? 'selected' : '' ?>>
                                <?= h($label) ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>
                    Kurztext (nur ohne Icon)
                    <input name="short_text" maxlength="64" value="<?= h($edit['short_text'] ?? '') ?>" placeholder="z.B. CCC, CTF, HAM">
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
        <h2><?= is_super_admin() ? 'EVENT DATABASE' : 'MY EVENTS' ?></h2>
        <div style="overflow:auto">
            <table class="event-list">
                <thead>
                    <tr>
                        <th>Datum</th>
                        <th>Event</th>
                        <?php if (is_super_admin()): ?><th>Owner</th><?php endif; ?>
                        <th>Aktion</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($events as $event): ?>
                    <tr>
                        <td><?= h(admin_date_display($event['start_date'])) ?><?= $event['end_date'] ? ' → ' . h(admin_date_display($event['end_date'])) : '' ?></td>
                        <td>
                            <strong><?= h($event['title']) ?></strong>
                            <?php if ($event['category']): ?><br><small><?= h($event['category']) ?></small><?php endif; ?>
                            <?php if (!empty($event['location'])): ?><br><small><?= h($event['location']) ?></small><?php endif; ?>
                        </td>
                        <?php if (is_super_admin()): ?>
                            <td><?= h($event['owner_name'] ?? 'Admin') ?></td>
                        <?php endif; ?>
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
                    <tr><td colspan="<?= is_super_admin() ? '4' : '3' ?>">Noch keine Events.</td></tr>
                <?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</main>
</body>
</html>
