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

    // Lightweight schema migrations for installations that predate newer event fields.
    $shortTextColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'short_text'")->fetch();
    if (!$shortTextColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN short_text VARCHAR(64) NULL AFTER icon");
    }

    $locationColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'location'")->fetch();
    if (!$locationColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN location VARCHAR(255) NULL AFTER category");
    }
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function h(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}


function site_base_url(): string
{
    global $config;

    $configured = trim((string)($config['site']['base_url'] ?? ''));
    if ($configured !== '') {
        return rtrim($configured, '/');
    }

    return 'https://tech3ventz.ch';
}

function event_slug(array $event): string
{
    $title = trim((string)($event['title'] ?? 'event'));
    $year = '';

    if (!empty($event['start_date'])) {
        $year = substr((string)$event['start_date'], 0, 4);
    }

    $source = trim($title . ' ' . $year);

    if (function_exists('iconv')) {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $source);
        if ($ascii !== false) {
            $source = $ascii;
        }
    }

    $slug = strtolower($source);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');

    return $slug !== '' ? $slug : 'event';
}

function event_path(array $event): string
{
    $id = (int)($event['id'] ?? 0);
    return '/event/' . $id . '/' . event_slug($event);
}

function event_url(array $event): string
{
    return site_base_url() . event_path($event);
}

function xml_h(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
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
