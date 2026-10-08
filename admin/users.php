<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
super_admin_required();

$error = null;
$success = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string)($_POST['action'] ?? 'create');

    if ($action === 'create') {
        $username = strtolower(trim((string)($_POST['username'] ?? '')));
        $displayName = trim((string)($_POST['display_name'] ?? ''));
        $password = (string)($_POST['password'] ?? '');

        if (!preg_match('/^[a-z0-9._-]{3,80}$/', $username)) {
            $error = 'Username: 3–80 Zeichen, nur a-z, 0-9, Punkt, Unterstrich oder Bindestrich.';
        } elseif ($displayName === '' || strlen($displayName) > 120) {
            $error = 'Display Name fehlt oder ist zu lang.';
        } elseif (strlen($password) < 10) {
            $error = 'Passwort muss mindestens 10 Zeichen lang sein.';
        } else {
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO users (username, display_name, password_hash, active)
                     VALUES (?, ?, ?, 1)'
                );
                $stmt->execute([$username, $displayName, password_hash($password, PASSWORD_DEFAULT)]);
                $success = 'User angelegt.';
            } catch (PDOException $e) {
                if ((string)$e->getCode() === '23000') {
                    $error = 'Dieser Username existiert bereits.';
                } else {
                    throw $e;
                }
            }
        }
    }

    if ($action === 'toggle') {
        $userId = (int)($_POST['user_id'] ?? 0);
        if ($userId > 0) {
            $stmt = $pdo->prepare('UPDATE users SET active = IF(active = 1, 0, 1) WHERE id = ?');
            $stmt->execute([$userId]);
            $success = 'User-Status geändert.';
        }
    }

    if ($action === 'password') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $password = (string)($_POST['password'] ?? '');

        if ($userId <= 0 || strlen($password) < 10) {
            $error = 'Neues Passwort muss mindestens 10 Zeichen lang sein.';
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
            $success = 'Passwort geändert.';
        }
    }
}

$users = $pdo->query(
    'SELECT u.id, u.username, u.display_name, u.active, u.created_at, COUNT(e.id) AS event_count
     FROM users u
     LEFT JOIN events e ON e.owner_user_id = u.id
     GROUP BY u.id, u.username, u.display_name, u.active, u.created_at
     ORDER BY u.display_name, u.username'
)->fetchAll();
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // users</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/admin/">← Events</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1>PARTNER USERS</h1>
        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <?php if ($success): ?><p><?= h($success) ?></p><?php endif; ?>

        <form method="post">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="action" value="create">
            <div class="form-grid">
                <label>
                    Username
                    <input name="username" maxlength="80" pattern="[a-z0-9._-]{3,80}" required placeholder="diskette">
                </label>
                <label>
                    Display Name
                    <input name="display_name" maxlength="120" required placeholder="Diskette e.V.">
                </label>
                <label>
                    Password
                    <input type="password" name="password" minlength="10" autocomplete="new-password" required>
                </label>
            </div>
            <p><button type="submit">CREATE USER</button></p>
        </form>
    </section>

    <section class="admin-card">
        <h2>USERS</h2>
        <div style="overflow:auto">
            <table class="event-list">
                <thead><tr><th>User</th><th>Events</th><th>Status</th><th>Aktion</th></tr></thead>
                <tbody>
                <?php foreach ($users as $user): ?>
                    <tr>
                        <td><strong><?= h($user['display_name']) ?></strong><br><small><?= h($user['username']) ?></small></td>
                        <td><?= (int)$user['event_count'] ?></td>
                        <td><?= (int)$user['active'] === 1 ? 'active' : 'disabled' ?></td>
                        <td>
                            <div class="actions">
                                <form method="post">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="toggle">
                                    <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                    <button type="submit" class="secondary"><?= (int)$user['active'] === 1 ? 'Disable' : 'Enable' ?></button>
                                </form>
                                <form method="post">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="password">
                                    <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                    <input type="password" name="password" minlength="10" autocomplete="new-password" placeholder="New password" required>
                                    <button type="submit" class="secondary">Set password</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$users): ?><tr><td colspan="4">Noch keine Partner-User.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</main>
</body>
</html>
