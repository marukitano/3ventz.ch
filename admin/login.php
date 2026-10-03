<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';

if (!empty($_SESSION['is_admin'])) {
    header('Location: /admin/');
    exit;
}

$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string)($_POST['password'] ?? '');

    if (password_verify($password, $config['admin_password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['is_admin'] = true;
        header('Location: /admin/');
        exit;
    }

    $error = 'Login fehlgeschlagen.';
}
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>3ventz // admin login</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<main class="admin-shell">
    <section class="admin-card">
        <h1>3VENTZ // ADMIN</h1>
        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <form method="post">
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
