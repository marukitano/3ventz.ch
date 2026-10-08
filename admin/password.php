<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

if (is_super_admin()) {
    http_response_code(403);
    exit('Der Administrator verwaltet sein Passwort über die Server-Konfiguration.');
}

$error = null;
$success = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $currentPassword = (string)($_POST['current_password'] ?? '');
    $newPassword = (string)($_POST['new_password'] ?? '');
    $confirmPassword = (string)($_POST['confirm_password'] ?? '');
    $userId = current_user_id();

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ? AND active = 1 LIMIT 1');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, (string)$user['password_hash'])) {
        $error = 'Das aktuelle Passwort ist nicht korrekt.';
    } elseif (strlen($newPassword) < 10) {
        $error = 'Das neue Passwort muss mindestens 10 Zeichen lang sein.';
    } elseif ($newPassword !== $confirmPassword) {
        $error = 'Die neuen Passwörter stimmen nicht überein.';
    } else {
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $stmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $userId]);

        session_regenerate_id(true);
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        $success = 'Passwort erfolgreich geändert.';
    }
}
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // passwort</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/admin/">← Events</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1>PASSWORT ÄNDERN</h1>
        <p><small>Optional: Dein bisheriges Passwort bleibt gültig, solange du es nicht hier änderst.</small></p>

        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <?php if ($success): ?><p><?= h($success) ?></p><?php endif; ?>

        <form method="post">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">

            <label>
                Aktuelles Passwort
                <input type="password" name="current_password" autocomplete="current-password" required>
            </label>

            <label>
                Neues Passwort
                <input type="password" name="new_password" minlength="10" autocomplete="new-password" required>
            </label>

            <label>
                Neues Passwort wiederholen
                <input type="password" name="confirm_password" minlength="10" autocomplete="new-password" required>
            </label>

            <p><button type="submit">PASSWORT ÄNDERN</button></p>
        </form>
    </section>
</main>
</body>
</html>
