<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

csrf_check();

function normalize_admin_date(string $value): ?string
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }

    if (preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $value)) {
        $date = DateTimeImmutable::createFromFormat('!d.m.Y', $value);
        if ($date && $date->format('d.m.Y') === $value) {
            return $date->format('Y-m-d');
        }
        return null;
    }

    // Backward-compatible fallback for older/native date submissions.
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if ($date && $date->format('Y-m-d') === $value) {
            return $value;
        }
    }

    return null;
}

$id = (int)($_POST['id'] ?? 0);
$title = trim((string)($_POST['title'] ?? ''));
$startInput = trim((string)($_POST['start_date'] ?? ''));
$endInput = trim((string)($_POST['end_date'] ?? ''));
$start = normalize_admin_date($startInput);
$end = normalize_admin_date($endInput);
$category = trim((string)($_POST['category'] ?? ''));
$location = trim((string)($_POST['location'] ?? ''));
if (function_exists('mb_substr')) {
    $location = mb_substr($location, 0, 255, 'UTF-8');
} else {
    $location = substr($location, 0, 255);
}
$allowedCategories = ['CCC', 'DEMO', 'RETRO', 'MAKER', 'MOVIE', 'LAN', 'MUSIC', 'CODING', 'HACKING'];
if (!in_array($category, $allowedCategories, true)) {
    http_response_code(422);
    exit('Ungültige Kategorie.');
}
$url = trim((string)($_POST['url'] ?? ''));
$description = trim((string)($_POST['description'] ?? ''));
$color = (string)($_POST['color'] ?? '#00f5ff');
$shortText = trim((string)($_POST['short_text'] ?? ''));
if (function_exists('mb_substr')) {
    $shortText = mb_substr($shortText, 0, 64, 'UTF-8');
} else {
    $shortText = substr($shortText, 0, 64);
}
$allowedIcons = ['none', 'terminal', 'pebble_rocket', 'pebble_console', 'pebble_toolbox', 'pebble_floppy', 'pebble_location', 'pebble_calendar', 'pebble_warning', 'pebble_microphone', 'pebble_radio'];
$icon = trim((string)($_POST['icon'] ?? 'terminal'));
if (!in_array($icon, $allowedIcons, true)) {
    $icon = 'terminal';
}

if ($title === '' || $startInput === '' || $start === null) {
    http_response_code(422);
    exit('Titel und ein gültiges Startdatum im Format TT.MM.JJJJ sind Pflichtfelder.');
}

if ($endInput !== '' && $end === null) {
    http_response_code(422);
    exit('Enddatum bitte im Format TT.MM.JJJJ eingeben.');
}

if ($end !== null && $end < $start) {
    http_response_code(422);
    exit('Enddatum darf nicht vor dem Startdatum liegen.');
}

if ($url !== '') {
    if (!preg_match('~^[a-z][a-z0-9+.-]*://~i', $url)) {
        $url = 'https://' . $url;
    }

    if (filter_var($url, FILTER_VALIDATE_URL) === false) {
        http_response_code(422);
        exit('Ungültige URL.');
    }
}

if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
    $color = '#00f5ff';
}

$params = [
    'title' => $title,
    'start_date' => $start,
    'end_date' => $end,
    'category' => $category !== '' ? $category : null,
    'location' => $location !== '' ? $location : null,
    'url' => $url !== '' ? $url : null,
    'description' => $description !== '' ? $description : null,
    'color' => $color,
    'icon' => $icon,
    'short_text' => $shortText !== '' ? $shortText : null,
];

if ($id > 0) {
    $params['id'] = $id;
    $stmt = $pdo->prepare(
        'UPDATE events
         SET title=:title, start_date=:start_date, end_date=:end_date,
             category=:category, location=:location, url=:url, description=:description, color=:color, icon=:icon,
             short_text=:short_text
         WHERE id=:id'
    );
} else {
    $stmt = $pdo->prepare(
        'INSERT INTO events (title,start_date,end_date,category,location,url,description,color,icon,short_text)
         VALUES (:title,:start_date,:end_date,:category,:location,:url,:description,:color,:icon,:short_text)'
    );
}

$stmt->execute($params);

header('Location: /admin/');
exit;
