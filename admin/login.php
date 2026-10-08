<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';

if (is_super_admin() || current_user_id() !== null) {
    header('Location: /admin/');
    exit;
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = strtolower(trim((string)($_POST['username'] ?? '')));
    $password = (string)($_POST['password'] ?? '');

    if (login_rate_limited($username)) {
        http_response_code(429);
        header('Retry-After: 900');
        $error = 'Zu viele fehlgeschlagene Login-Versuche. Bitte in 15 Minuten erneut versuchen.';
    } else {
        $authenticated = false;

        if ($username === '' && password_verify($password, (string)$config['admin_password_hash'])) {
            clear_login_failures($username);
            session_regenerate_id(true);
            $_SESSION = [
                'is_admin' => true,
                'csrf' => bin2hex(random_bytes(32)),
            ];
            $authenticated = true;
        } elseif ($username !== '') {
            $stmt = $pdo->prepare('SELECT id, username, display_name, password_hash FROM users WHERE username = ? AND active = 1 LIMIT 1');
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            // Keep response timing closer for unknown and known usernames.
            $hash = $user
                ? (string)$user['password_hash']
                : '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llCQfSZcS1fddD4.';

            if (password_verify($password, $hash) && $user) {
                clear_login_failures($username);
                session_regenerate_id(true);
                $_SESSION = [
                    'is_admin' => false,
                    'user_id' => (int)$user['id'],
                    'username' => (string)$user['username'],
                    'display_name' => (string)$user['display_name'],
                    'csrf' => bin2hex(random_bytes(32)),
                ];
                $authenticated = true;
            }
        }

        if ($authenticated) {
            header('Location: /admin/');
            exit;
        }

        record_login_failure($username);
        usleep(random_int(100000, 250000));
        $error = 'Login fehlgeschlagen.';
    }
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
            <p><button type="submit">LOGIN</button></p>
        </form>
    </section>
</main>
</body>
</html>
