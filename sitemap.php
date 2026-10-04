<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

header('Content-Type: application/xml; charset=UTF-8');

$base = site_base_url();
$currentYear = (int)date('Y');
$urls = [
    [
        'loc' => $base . '/',
        'lastmod' => null,
    ],
];

if (!$demoMode) {
    $years = $pdo->query(
        'SELECT DISTINCT YEAR(start_date) AS event_year
         FROM events
         WHERE start_date IS NOT NULL
         ORDER BY event_year DESC'
    )->fetchAll();

    foreach ($years as $row) {
        $eventYear = (int)($row['event_year'] ?? 0);
        if ($eventYear <= 0 || $eventYear === $currentYear) {
            continue;
        }

        $urls[] = [
            'loc' => $base . '/?year=' . $eventYear,
            'lastmod' => null,
        ];
    }

    $events = $pdo->query(
        'SELECT id, title, start_date, updated_at
         FROM events
         ORDER BY start_date DESC, id DESC'
    )->fetchAll();

    foreach ($events as $event) {
        $urls[] = [
            'loc' => event_url($event),
            'lastmod' => !empty($event['updated_at'])
                ? (new DateTimeImmutable($event['updated_at']))->format(DATE_ATOM)
                : null,
        ];
    }
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($urls as $entry): ?>
    <url>
        <loc><?= xml_h($entry['loc']) ?></loc>
<?php if (!empty($entry['lastmod'])): ?>
        <lastmod><?= xml_h($entry['lastmod']) ?></lastmod>
<?php endif; ?>
    </url>
<?php endforeach; ?>
</urlset>
