<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';

if (is_super_admin() || current_user_id() !== null) {
    header('Location: /admin/');
    exit;
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if ($username === '' && password_verify($password, $config['admin_password_hash'])) {
        session_regenerate_id(true);
        $_SESSION = [
            'is_admin' => true,
            'csrf' => bin2hex(random_bytes(32)),
        ];
        header('Location: /admin/');
        exit;
    }

    if ($username !== '') {
        $stmt = $pdo->prepare('SELECT id, username, display_name, password_hash FROM users WHERE username = ? AND active = 1 LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, (string)$user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION = [
                'is_admin' => false,
                'user_id' => (int)$user['id'],
                'username' => (string)$user['username'],
                'display_name' => (string)$user['display_name'],
                'csrf' => bin2hex(random_bytes(32)),
            ];
            header('Location: /admin/');
            exit;
        }
    }

    $error = 'Login fehlgeschlagen.';
}
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // login</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<main class="admin-shell">
    <section class="admin-card">
        <h1>TECH3VENTZ // LOGIN</h1>
        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <form method="post">
            <label>
                Username
                <input type="text" name="username" autocomplete="username" placeholder="Partner-Login">
            </label>
            <label>
                Password
                <input type="password" name="password" autocomplete="current-password" required autofocus>
            </label>
            <p><small>Admin: Username leer lassen.</small></p>
            <p><button type="submit">LOGIN</button></p>
        </form>
    </section>
</main>
</body>
</html>
