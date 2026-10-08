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

    // Lightweight schema migrations for older installations.
    $shortTextColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'short_text'")->fetch();
    if (!$shortTextColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN short_text VARCHAR(64) NULL AFTER icon");
    }

    $locationColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'location'")->fetch();
    if (!$locationColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN location VARCHAR(255) NULL AFTER category");
    }

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL UNIQUE,
            display_name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $ownerColumn = $pdo->query("SHOW COLUMNS FROM events LIKE 'owner_user_id'")->fetch();
    if (!$ownerColumn) {
        $pdo->exec("ALTER TABLE events ADD COLUMN owner_user_id INT UNSIGNED NULL AFTER short_text");
        $pdo->exec("ALTER TABLE events ADD INDEX idx_events_owner_user_id (owner_user_id)");
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

function is_super_admin(): bool
{
    return !empty($_SESSION['is_admin']);
}

function current_user_id(): ?int
{
    return empty($_SESSION['user_id']) ? null : (int)$_SESSION['user_id'];
}

function current_user_name(): string
{
    if (is_super_admin()) {
        return 'Admin';
    }

    return (string)($_SESSION['display_name'] ?? $_SESSION['username'] ?? 'User');
}

function admin_required(): void
{
    global $demoMode;

    if ($demoMode) {
        http_response_code(503);
        exit('Admin is disabled in local demo mode.');
    }

    if (!is_super_admin() && current_user_id() === null) {
        header('Location: /admin/login.php');
        exit;
    }
}

function super_admin_required(): void
{
    admin_required();

    if (!is_super_admin()) {
        http_response_code(403);
        exit('Nur der Administrator darf Benutzer verwalten.');
    }
}

function can_manage_event(array $event): bool
{
    if (is_super_admin()) {
        return true;
    }

    $userId = current_user_id();
    return $userId !== null
        && isset($event['owner_user_id'])
        && (int)$event['owner_user_id'] === $userId;
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
