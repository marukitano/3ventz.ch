<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

$year = filter_input(INPUT_GET, 'year', FILTER_VALIDATE_INT) ?: (int)date('Y');
$year = max(2000, min(2100, $year));

$filterRequested = (string)($_GET['filtered'] ?? '') === '1';
$allowedCategories = ['CCC', 'DEMO', 'RETRO', 'MAKER', 'MOVIE', 'LAN', 'MUSIC', 'CODING', 'HACKING'];
$selectedCategories = [];

if ($filterRequested) {
    $rawCategories = trim((string)($_GET['categories'] ?? ''));

    if ($rawCategories !== '') {
        $requestedCategories = array_map(
            static fn(string $category): string => strtoupper(trim($category)),
            explode(',', $rawCategories)
        );

        $selectedCategories = array_values(array_unique(array_intersect(
            $requestedCategories,
            $allowedCategories
        )));
    }
}

if ($demoMode) {
    $events = [
        [
            'id' => 'demo-1',
            'title' => 'Hacknacht Zürich',
            'start_date' => sprintf('%04d-02-14', $year),
            'end_date' => null,
            'category' => 'Meetup',
            'url' => '',
            'description' => 'Demo event',
        ],
        [
            'id' => 'demo-2',
            'title' => 'Open Source Weekend',
            'start_date' => sprintf('%04d-04-18', $year),
            'end_date' => sprintf('%04d-04-19', $year),
            'category' => 'Open Source',
            'url' => '',
            'description' => 'Demo event',
        ],
    ];
} else {
    $stmt = $pdo->prepare(
        'SELECT id, title, start_date, end_date, category, url, description
         FROM events
         WHERE start_date <= :year_end
           AND COALESCE(end_date, start_date) >= :year_start
         ORDER BY start_date, title'
    );
    $stmt->execute([
        'year_start' => sprintf('%04d-01-01', $year),
        'year_end' => sprintf('%04d-12-31', $year),
    ]);
    $events = $stmt->fetchAll();
}

if ($filterRequested) {
    if ($selectedCategories === []) {
        $events = [];
    } else {
        $events = array_values(array_filter(
            $events,
            static fn(array $event): bool => in_array(
                strtoupper(trim((string)($event['category'] ?? ''))),
                $selectedCategories,
                true
            )
        ));
    }
}

function ics_escape(string $value): string
{
    $value = str_replace("\\", "\\\\", $value);
    $value = str_replace(["\r\n", "\r", "\n"], "\\n", $value);
    return str_replace([';', ','], ['\\;', '\\,'], $value);
}

function ics_date(string $date): string
{
    return str_replace('-', '', $date);
}

function ics_fold(string $line): string
{
    $lines = [];
    $prefix = '';

    while (strlen($line) > 73) {
        $chunk = function_exists('mb_strcut')
            ? mb_strcut($line, 0, 73, 'UTF-8')
            : substr($line, 0, 73);

        $lines[] = $prefix . $chunk;
        $line = substr($line, strlen($chunk));
        $prefix = ' ';
    }

    $lines[] = $prefix . $line;
    return implode("\r\n", $lines);
}

$calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//3VENTZ//Event Export//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:' . ics_escape('3VENTZ ' . $year . ($filterRequested && $selectedCategories ? ' // ' . implode('+', $selectedCategories) : '')),
];

$stamp = gmdate('Ymd\\THis\\Z');

foreach ($events as $event) {
    $start = new DateTimeImmutable((string)$event['start_date']);
    $end = new DateTimeImmutable((string)($event['end_date'] ?: $event['start_date']));
    $exclusiveEnd = $end->modify('+1 day');

    $uidSeed = implode('|', [
        (string)($event['id'] ?? ''),
        (string)$event['title'],
        (string)$event['start_date'],
        (string)($event['end_date'] ?? ''),
    ]);

    $calendar[] = 'BEGIN:VEVENT';
    $calendar[] = 'UID:' . sha1($uidSeed) . '@3ventz.ch';
    $calendar[] = 'DTSTAMP:' . $stamp;
    $calendar[] = 'DTSTART;VALUE=DATE:' . ics_date($start->format('Y-m-d'));
    $calendar[] = 'DTEND;VALUE=DATE:' . ics_date($exclusiveEnd->format('Y-m-d'));
    $calendar[] = 'SUMMARY:' . ics_escape((string)$event['title']);

    if (!empty($event['category'])) {
        $calendar[] = 'CATEGORIES:' . ics_escape((string)$event['category']);
    }

    if (!empty($event['description'])) {
        $calendar[] = 'DESCRIPTION:' . ics_escape((string)$event['description']);
    }

    if (!empty($event['url']) && $event['url'] !== '#') {
        $calendar[] = 'URL:' . ics_escape((string)$event['url']);
    }

    $calendar[] = 'END:VEVENT';
}

$calendar[] = 'END:VCALENDAR';

header('Content-Type: text/calendar; charset=utf-8');
header('Content-Disposition: attachment; filename="3ventz_' . $year . '.ics"');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

echo implode("\r\n", array_map('ics_fold', $calendar)) . "\r\n";
