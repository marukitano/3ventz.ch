<?php
declare(strict_types=1);

$configFile = dirname(__DIR__) . '/config.local.php';
$demoMode = !is_file($configFile);
$pdo = null;
$config = [];

if (!$demoMode) {
    $config = require $configFile;

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $config['db']['host'],
        $config['db']['name'],
        $config['db']['charset'] ?? 'utf8mb4'
    );

    $pdo = new PDO(
        $dsn,
        $config['db']['user'],
        $config['db']['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    // Lightweight schema migration for installations that predate event short text.
    $shortTextColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'short_text'")->fetch();
    if (!$shortTextColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN short_text VARCHAR(64) NULL AFTER icon");
    }
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function h(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}

function admin_required(): void
{
    global $demoMode;

    if ($demoMode) {
        http_response_code(503);
        exit('Admin is disabled in local demo mode.');
    }

    if (empty($_SESSION['is_admin'])) {
        header('Location: /admin/login.php');
        exit;
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    $token = $_POST['csrf'] ?? '';
    if (!hash_equals($_SESSION['csrf'] ?? '', $token)) {
        http_response_code(403);
        exit('Invalid CSRF token');
    }
}
