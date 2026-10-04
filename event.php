<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

if ($demoMode) {
    http_response_code(503);
    exit('Event pages are unavailable in demo mode.');
}

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$id) {
    http_response_code(404);
    exit('Event not found.');
}

$stmt = $pdo->prepare('SELECT * FROM events WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$event = $stmt->fetch();

if (!$event) {
    http_response_code(404);
    exit('Event not found.');
}

$canonicalPath = event_path($event);
$canonicalUrl = event_url($event);
$requestedSlug = trim((string)($_GET['slug'] ?? ''));

if ($requestedSlug !== event_slug($event)) {
    header('Location: ' . $canonicalPath, true, 301);
    exit;
}

$start = new DateTimeImmutable($event['start_date']);
$end = new DateTimeImmutable($event['end_date'] ?: $event['start_date']);
$dateLabel = $start->format('d.m.Y');
if ($end->format('Y-m-d') !== $start->format('Y-m-d')) {
    $dateLabel .= ' – ' . $end->format('d.m.Y');
}

$category = trim((string)($event['category'] ?? ''));
$location = trim((string)($event['location'] ?? ''));
$description = trim((string)($event['description'] ?? ''));
$officialUrl = trim((string)($event['url'] ?? ''));

$metaParts = [$event['title'], $dateLabel];
if ($location !== '') {
    $metaParts[] = $location;
}
if ($category !== '') {
    $metaParts[] = $category;
}
$metaDescription = implode(' · ', $metaParts);
if ($description !== '') {
    $metaDescription .= ' — ' . $description;
}
if (function_exists('mb_substr')) {
    $metaDescription = mb_substr($metaDescription, 0, 200, 'UTF-8');
} else {
    $metaDescription = substr($metaDescription, 0, 200);
}

$eventSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'Event',
    'name' => (string)$event['title'],
    'startDate' => $start->format('Y-m-d'),
    'url' => $canonicalUrl,
    'mainEntityOfPage' => $canonicalUrl,
];

if ($end->format('Y-m-d') !== $start->format('Y-m-d')) {
    $eventSchema['endDate'] = $end->format('Y-m-d');
}
if ($description !== '') {
    $eventSchema['description'] = $description;
}
if ($location !== '') {
    $eventSchema['location'] = [
        '@type' => 'Place',
        'name' => $location,
    ];
}
if ($officialUrl !== '' && $officialUrl !== '#') {
    $eventSchema['sameAs'] = $officialUrl;
}

$backYear = (int)$start->format('Y');
?>
<!doctype html>
<html lang="de" data-theme="hackers">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title><?= h($event['title']) ?> // 3ventz</title>
    <meta name="description" content="<?= h($metaDescription) ?>">
    <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">
    <link rel="canonical" href="<?= h($canonicalUrl) ?>">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="3ventz">
    <meta property="og:title" content="<?= h($event['title']) ?>">
    <meta property="og:description" content="<?= h($metaDescription) ?>">
    <meta property="og:url" content="<?= h($canonicalUrl) ?>">

    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="<?= h($event['title']) ?>">
    <meta name="twitter:description" content="<?= h($metaDescription) ?>">

    <link rel="stylesheet" href="/assets/style.css?v=seo-event-1">
    <script type="application/ld+json"><?= json_encode($eventSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
</head>
<body>
    <main class="event-detail-shell">
        <a class="event-detail-back" href="/<?= $backYear === (int)date('Y') ? '' : '?year=' . $backYear ?>">← 3ventz // <?= $backYear ?></a>

        <article class="event-detail-card" style="--event-color:<?= h((string)$event['color']) ?>">
            <div class="event-detail-tape" aria-hidden="true"></div>
            <div class="event-detail-content">
                <p class="event-detail-kicker"><?= h($category !== '' ? $category : 'EVENT') ?></p>
                <h1><?= h($event['title']) ?></h1>

                <dl class="event-detail-meta">
                    <div>
                        <dt>DATUM</dt>
                        <dd><?= h($dateLabel) ?></dd>
                    </div>
                    <?php if ($location !== ''): ?>
                        <div>
                            <dt>ORT</dt>
                            <dd><?= h($location) ?></dd>
                        </div>
                    <?php endif; ?>
                </dl>

                <?php if ($description !== ''): ?>
                    <p class="event-detail-description"><?= nl2br(h($description)) ?></p>
                <?php endif; ?>

                <?php if ($officialUrl !== '' && $officialUrl !== '#'): ?>
                    <p class="event-detail-actions">
                        <a class="button" href="<?= h($officialUrl) ?>" target="_blank" rel="noopener noreferrer">OFFICIAL WEBSITE ↗</a>
                    </p>
                <?php endif; ?>
            </div>
        </article>
    </main>
</body>
</html>
