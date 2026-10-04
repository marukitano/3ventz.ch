<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$year = filter_input(INPUT_GET, 'year', FILTER_VALIDATE_INT) ?: (int)date('Y');
$year = max(2000, min(2100, $year));

$visitYear = (int)date('Y');
$pageViewNumber = 0;

if (!$demoMode) {
    // Aggregate page-view counter only: no visitor ID, IP address or cookie is stored here.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS pageview_counter (
            visit_year SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
            views BIGINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $counterInsert = $pdo->prepare(
        'INSERT IGNORE INTO pageview_counter (visit_year, views) VALUES (:visit_year, 0)'
    );
    $counterInsert->execute(['visit_year' => $visitYear]);

    // LAST_INSERT_ID(expr) is connection-local, so concurrent requests each
    // receive the exact ordinal number assigned to their own page view.
    $counterUpdate = $pdo->prepare(
        'UPDATE pageview_counter
         SET views = LAST_INSERT_ID(views + 1)
         WHERE visit_year = :visit_year'
    );
    $counterUpdate->execute(['visit_year' => $visitYear]);
    $pageViewNumber = (int)$pdo->lastInsertId();
}

if ($demoMode) {
    $events = [
        [
            'title' => 'Hacknacht Zürich',
            'start_date' => sprintf('%04d-02-14', $year),
            'end_date' => null,
            'category' => 'Meetup',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#00f5ff',
            'icon' => 'terminal',
            'short_text' => null,
        ],
        [
            'title' => 'Open Source Weekend',
            'start_date' => sprintf('%04d-04-18', $year),
            'end_date' => sprintf('%04d-04-19', $year),
            'category' => 'Open Source',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#59ff8b',
            'icon' => 'pebble_toolbox',
            'short_text' => null,
        ],
        [
            'title' => 'CTF // Basel',
            'start_date' => sprintf('%04d-06-06', $year),
            'end_date' => null,
            'category' => 'CTF',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#ff3df2',
            'icon' => 'pebble_warning',
            'short_text' => null,
        ],
        [
            'title' => 'Retrocomputing Meetup',
            'start_date' => sprintf('%04d-09-12', $year),
            'end_date' => null,
            'category' => 'Retro',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#ffe45e',
            'icon' => 'pebble_floppy',
            'short_text' => null,
        ],
        [
            'title' => 'Chaos Weekend',
            'start_date' => sprintf('%04d-12-27', $year),
            'end_date' => sprintf('%04d-12-30', $year),
            'category' => 'Congress',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#00f5ff',
            'icon' => 'terminal',
            'short_text' => null,
        ],
    ];
} else {
    $stmt = $pdo->prepare(
        'SELECT * FROM events
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

$eventsByDate = [];
foreach ($events as $event) {
    $start = new DateTimeImmutable($event['start_date']);
    $end = new DateTimeImmutable($event['end_date'] ?: $event['start_date']);
    $cursor = $start;

    while ($cursor <= $end) {
        if ((int)$cursor->format('Y') === $year) {
            $eventsByDate[$cursor->format('Y-m-d')][] = $event;
        }
        $cursor = $cursor->modify('+1 day');
    }
}

$monthNames = [
    1 => 'JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN',
    'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'
];

$categoryFilters = ['CCC', 'DEMO', 'RETRO', 'MAKER', 'MOVIE', 'LAN', 'MUSIC', 'CODING', 'HACKING'];

function event_icon_markup(string $icon): string
{
    if ($icon === 'none') {
        return '';
    }

    $pebbleIcons = [
        'pebble_rocket' => '25px_Rocket.svg',
        'pebble_console' => '25px_Developer_console.svg',
        'pebble_toolbox' => '25px_Apps_toolbox_closed.svg',
        'pebble_floppy' => '25px_Floppy_disk_generic.svg',
        'pebble_location' => '25px_Location.svg',
        'pebble_calendar' => '25px_Calendar.svg',
        'pebble_warning' => '25px_Warning_sign.svg',
        'pebble_microphone' => '25px_Microphone.svg',
        'pebble_radio' => '25px_Music_radio.svg',
    ];

    if (isset($pebbleIcons[$icon])) {
        return '<img src="/assets/icons/' . $pebbleIcons[$icon] . '" alt="" width="20" height="20">';
    }

    // Terminal is the built-in fallback for old/unknown icon keys.
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 8 4 4-4 4M12 16h6"/></svg>';
}
function event_short_text(string $text, int $days): string
{
    $text = trim($text);
    if ($text === '') {
        return '';
    }

    // Total visible capacity including the leading terminal prompt:
    // 1 day = 5 chars, 2 = 11, 3 = 17, then +6/day.
    $maxChars = max(5, ($days * 6) - 1);
    $textChars = max(1, $maxChars - 1);

    if (function_exists('mb_substr')) {
        $text = mb_substr($text, 0, $textChars, 'UTF-8');
    } else {
        $text = substr($text, 0, $textChars);
    }

    return '>' . $text;
}

function event_text_mask_uri(string $text): string
{
    if ($text === '') {
        return 'none';
    }

    $escaped = htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="22" viewBox="0 0 320 22">'
         . '<text x="318" y="18" text-anchor="end" fill="white" '
         . 'font-family="VT323, Courier New, monospace" font-size="20" letter-spacing="0.8">'
         . $escaped
         . '</text></svg>';

    return 'url("data:image/svg+xml,' . rawurlencode($svg) . '")';
}

function month_calendar(int $year, int $month, array $eventsByDate): string
{
    $first = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month));
    $daysInMonth = (int)$first->format('t');
    $offset = (int)$first->format('N') - 1;

    $cells = array_fill(0, 42, null);
    for ($day = 1; $day <= $daysInMonth; $day++) {
        $cells[$offset + $day - 1] = $day;
    }

    $weeks = array_chunk($cells, 7);

    // Deduplicate events because $eventsByDate contains the same event on every covered day.
    $monthEvents = [];
    foreach ($eventsByDate as $date => $dateEvents) {
        if (substr($date, 0, 7) !== sprintf('%04d-%02d', $year, $month)) {
            continue;
        }

        foreach ($dateEvents as $event) {
            $key = isset($event['id'])
                ? 'id:' . $event['id']
                : implode('|', [
                    (string)($event['title'] ?? ''),
                    (string)($event['start_date'] ?? ''),
                    (string)($event['end_date'] ?? ''),
                    (string)($event['url'] ?? ''),
                ]);

            $monthEvents[$key] = $event;
        }
    }

    $monthStart = $first;
    $monthEnd = $first->modify('last day of this month');

    ob_start();
    ?>
    <div class="weekdays">
        <?php foreach (['MO','DI','MI','DO','FR','SA','SO'] as $day): ?>
            <span><?= $day ?></span>
        <?php endforeach; ?>
    </div>

    <div class="days">
        <?php foreach ($weeks as $weekIndex => $week):
            $weekStart = $first->modify(sprintf('%+d days', $weekIndex * 7 - $offset));
            $weekEnd = $weekStart->modify('+6 days');

            $segments = [];
            foreach ($monthEvents as $event) {
                $eventStart = new DateTimeImmutable($event['start_date']);
                $eventEnd = new DateTimeImmutable($event['end_date'] ?: $event['start_date']);

                $segmentStart = $eventStart > $weekStart ? $eventStart : $weekStart;
                $segmentEnd = $eventEnd < $weekEnd ? $eventEnd : $weekEnd;
                $segmentStart = $segmentStart > $monthStart ? $segmentStart : $monthStart;
                $segmentEnd = $segmentEnd < $monthEnd ? $segmentEnd : $monthEnd;

                if ($segmentStart > $segmentEnd) {
                    continue;
                }

                $segments[] = [
                    'event' => $event,
                    'start' => $segmentStart,
                    'end' => $segmentEnd,
                    'start_col' => (int)$segmentStart->format('N'),
                    'end_col' => (int)$segmentEnd->format('N') + 1,
                ];
            }

            $displayNumbers = [];
            foreach ($week as $day) {
                if ($day !== null) {
                    $displayNumbers[$day] = (string)$day;
                }
            }

            foreach ($segments as $segment) {
                $eventStart = new DateTimeImmutable($segment['event']['start_date']);
                $eventEnd = new DateTimeImmutable($segment['event']['end_date'] ?: $segment['event']['start_date']);

                // For a multi-day visible segment, replace the first day with a range
                // (e.g. 29–30) and hide the following day numbers inside the same frame.
                if ($segment['start'] < $segment['end']) {
                    $startDay = (int)$segment['start']->format('j');
                    $endDay = (int)$segment['end']->format('j');

                    if (array_key_exists($startDay, $displayNumbers)) {
                        $displayNumbers[$startDay] = $startDay . '–' . $endDay;
                    }

                    $cursor = $segment['start']->modify('+1 day');
                    while ($cursor <= $segment['end']) {
                        $coveredDay = (int)$cursor->format('j');
                        if (array_key_exists($coveredDay, $displayNumbers)) {
                            $displayNumbers[$coveredDay] = '';
                        }
                        $cursor = $cursor->modify('+1 day');
                    }
                }
            }
        ?>
            <div class="week-row">
                <?php foreach ($week as $day): ?>
                    <?php if ($day === null): ?>
                        <span class="day empty"></span>
                    <?php else: ?>
                        <div class="day">
                            <span class="number" data-day="<?= (int)$day ?>"><?= h($displayNumbers[$day] ?? (string)$day) ?></span>
                        </div>
                    <?php endif; ?>
                <?php endforeach; ?>

                <div class="week-events">
                    <?php foreach ($segments as $segment):
                        $event = $segment['event'];
                        $eventStart = new DateTimeImmutable($event['start_date']);
                        $eventEnd = new DateTimeImmutable($event['end_date'] ?: $event['start_date']);
                        $eventDateLabel = $eventStart->format('d.m.Y');
                        if ($eventEnd->format('Y-m-d') !== $eventStart->format('Y-m-d')) {
                            $eventDateLabel .= ' – ' . $eventEnd->format('d.m.Y');
                        }
                        $hasEventUrl = !empty($event['url']) && $event['url'] !== '#';
                        $style = sprintf(
                            '--span-start:%d;--span-end:%d;--event-color:%s',
                            $segment['start_col'],
                            $segment['end_col'],
                            h((string)$event['color'])
                        );
                        $eventIconKey = (string)($event['icon'] ?? 'none');
                        $eventIconMarkup = event_icon_markup($eventIconKey);
                        $segmentDays = ((int)$segment['end']->diff($segment['start'])->days) + 1;
                        $eventShortText = $eventIconKey === 'none'
                            ? event_short_text((string)($event['short_text'] ?? ''), $segmentDays)
                            : '';
                        if ($eventShortText !== '') {
                            $style .= ';--event-text-mask:' . h(event_text_mask_uri($eventShortText));
                        }
                    ?>
                        <?php if ($hasEventUrl): ?>
                            <a class="event-span"
                               href="<?= h($event['url']) ?>"
                               target="_blank"
                               rel="noopener noreferrer"
                               style="<?= $style ?>"
                               data-event-title="<?= h($event['title']) ?>"
                               data-segment-start-day="<?= (int)$segment['start']->format('j') ?>"
                               data-segment-end-day="<?= (int)$segment['end']->format('j') ?>"
                               data-event-date="<?= h($eventDateLabel) ?>"
                               data-event-category="<?= h($event['category'] ?? '') ?>"
                               data-event-description="<?= h($event['description'] ?? '') ?>"
                               data-event-url="<?= h($event['url']) ?>"
                               aria-label="<?= h($event['title']) ?>">
                                <?php if ($eventIconMarkup !== ''): ?>
                                    <span class="event-span-icon-overlay" aria-hidden="true"><?= $eventIconMarkup ?></span>
                                <?php elseif ($eventShortText !== ''): ?>
                                    <span class="event-span-short-text" aria-hidden="true"><?= h(ltrim($eventShortText, '>')) ?></span>
                                <?php endif; ?>
                            </a>
                        <?php else: ?>
                            <span class="event-span"
                                  style="<?= $style ?>"
                                  data-event-title="<?= h($event['title']) ?>"
                               data-segment-start-day="<?= (int)$segment['start']->format('j') ?>"
                               data-segment-end-day="<?= (int)$segment['end']->format('j') ?>"
                                  data-event-date="<?= h($eventDateLabel) ?>"
                                  data-event-category="<?= h($event['category'] ?? '') ?>"
                                  data-event-description="<?= h($event['description'] ?? '') ?>"
                                  aria-label="<?= h($event['title']) ?>"
                                  tabindex="0">
                                <?php if ($eventIconMarkup !== ''): ?>
                                    <span class="event-span-icon-overlay" aria-hidden="true"><?= $eventIconMarkup ?></span>
                                <?php elseif ($eventShortText !== ''): ?>
                                    <span class="event-span-short-text" aria-hidden="true"><?= h(ltrim($eventShortText, '>')) ?></span>
                                <?php endif; ?>
                            </span>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
    <?php
    return (string)ob_get_clean();
}
$legal = $config['legal'] ?? [];
$legalReady =
    !empty($legal['name']) &&
    !empty($legal['address']) &&
    !empty($legal['email']);
?>
<!doctype html>
<html lang="de" data-theme="hackers">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>3ventz // <?= $year ?></title>
    <link rel="stylesheet" href="/assets/style.css?v=rabbit-export-1">
</head>
<body>
    <main class="shell<?= $demoMode ? ' demo-mode' : '' ?>">
        <header class="topbar">
            <div class="identity">
                <form class="brand-terminal crt-title" id="terminal" autocomplete="off">
                    <span class="brand-prefix">nerd@3ventz:<span class="prompt-home">~</span>$</span>
                    <span class="brand-command-wrap">
                        <input
                            id="terminal-input"
                            type="text"
                            spellcheck="false"
                            aria-label="3ventz command line"
                            placeholder=""
                            autofocus
                        >
                        <span class="cursor" id="terminal-cursor">_</span>
                        <span class="terminal-hint" id="terminal-hint">try: man</span>
                    </span>
                    <span class="terminal-output" id="terminal-output" aria-live="polite"></span>
                </form>
                <div class="category-filters" aria-label="Event-Kategorien filtern">
                    <?php foreach ($categoryFilters as $category): ?>
                        <button
                            type="button"
                            class="category-filter is-active"
                            data-category-filter="<?= h($category) ?>"
                            aria-pressed="true"
                        ><?= h($category) ?></button>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="nav-stack">
                <div class="theme-indicator nerd-indicator" id="nerd-indicator" hidden>echo $nerd=true</div>
                <div class="theme-indicator" id="theme-indicator">echo $theme=hackers</div>
                <nav class="year-nav" aria-label="Jahr wählen">
                    <a href="?year=<?= $year - 1 ?>">‹</a>
                    <strong><?= $year ?></strong>
                    <a href="?year=<?= $year + 1 ?>">›</a>
                </nav>
            </div>
        </header>

        <?php if ($demoMode): ?>
            <div style="margin:-3px 0 18px;color:#ff3df2;font-size:.75rem;letter-spacing:.08em">
                // LOCAL DEMO MODE · sample events
            </div>
        <?php endif; ?>

        <section class="calendar-grid">
            <?php for ($month = 1; $month <= 12; $month++): ?>
                <article class="month">
                    <h2><span><?= str_pad((string)$month, 2, '0', STR_PAD_LEFT) ?></span> <?= $monthNames[$month] ?></h2>
                    <?= month_calendar($year, $month, $eventsByDate) ?>
                </article>
            <?php endfor; ?>
        </section>

        <footer>
            <span>
                3ventz.ch
                <?php if ($legalReady): ?>
                    · <a href="/impressum.php">impressum + datenschutz</a>
                <?php endif; ?>
            </span>
            <span>// <?= count($events) ?> events loaded</span>
        </footer>
    </main>
    <script>
        window.THREEVENTZ = {
            year: <?= $year ?>,
            eventCount: <?= count($events) ?>,
            visitYear: <?= $visitYear ?>,
            pageViewNumber: <?= $pageViewNumber ?>
        };
    </script>
    <script src="/assets/app.js?v=rabbit-export-2"></script>
</body>
</html>
