<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$year = filter_input(INPUT_GET, 'year', FILTER_VALIDATE_INT) ?: (int)date('Y');
$year = max(2000, min(2100, $year));

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
        ],
        [
            'title' => 'Open Source Weekend',
            'start_date' => sprintf('%04d-04-18', $year),
            'end_date' => sprintf('%04d-04-19', $year),
            'category' => 'Open Source',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#59ff8b',
        ],
        [
            'title' => 'CTF // Basel',
            'start_date' => sprintf('%04d-06-06', $year),
            'end_date' => null,
            'category' => 'CTF',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#ff3df2',
        ],
        [
            'title' => 'Retrocomputing Meetup',
            'start_date' => sprintf('%04d-09-12', $year),
            'end_date' => null,
            'category' => 'Retro',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#ffe45e',
        ],
        [
            'title' => 'Chaos Weekend',
            'start_date' => sprintf('%04d-12-27', $year),
            'end_date' => sprintf('%04d-12-30', $year),
            'category' => 'Congress',
            'url' => '#',
            'description' => 'Demo event',
            'color' => '#00f5ff',
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

function month_calendar(int $year, int $month, array $eventsByDate): string
{
    $first = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month));
    $days = (int)$first->format('t');
    $offset = (int)$first->format('N') - 1;

    ob_start();
    ?>
    <div class="weekdays">
        <?php foreach (['MO','DI','MI','DO','FR','SA','SO'] as $day): ?>
            <span><?= $day ?></span>
        <?php endforeach; ?>
    </div>
    <div class="days">
        <?php for ($i = 0; $i < $offset; $i++): ?><span class="day empty"></span><?php endfor; ?>
        <?php for ($day = 1; $day <= $days; $day++):
            $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $dayEvents = $eventsByDate[$date] ?? [];
        ?>
            <div class="day<?= $dayEvents ? ' has-event' : '' ?>">
                <span class="number"><?= $day ?></span>
                <?php foreach ($dayEvents as $event): ?>
                    <?php if (!empty($event['url']) && $event['url'] !== '#'): ?>
                        <a class="event-dot"
                           href="<?= h($event['url']) ?>"
                           target="_blank"
                           rel="noopener noreferrer"
                           style="--event-color: <?= h($event['color']) ?>"
                           title="<?= h($event['title']) ?>"></a>
                    <?php else: ?>
                        <span class="event-dot"
                              style="--event-color: <?= h($event['color']) ?>"
                              title="<?= h($event['title']) ?>"></span>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>
        <?php endfor; ?>
        <?php
            $usedCells = $offset + $days;
            for ($i = $usedCells; $i < 42; $i++):
        ?>
            <span class="day empty"></span>
        <?php endfor; ?>
    </div>
    <?php
    return (string)ob_get_clean();
}
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>3ventz // <?= $year ?></title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
    <main class="shell">
        <header class="topbar">
            <div class="identity">
                <form class="brand-terminal crt-title" id="terminal" autocomplete="off">
                    <span class="brand-prefix">3VENTZ:~$</span>
                    <span class="brand-command-wrap">
                        <input
                            id="terminal-input"
                            type="text"
                            spellcheck="false"
                            aria-label="3ventz command line"
                            placeholder=""
                        >
                        <span class="cursor" id="terminal-cursor">_</span>
                    </span>
                </form>
                <div class="tagline">HACK · MAKE · BREAK · MEET</div>
                <div class="terminal-output" id="terminal-output" aria-live="polite"></div>
            </div>
            <nav class="year-nav" aria-label="Jahr wählen">
                <a href="?year=<?= $year - 1 ?>">‹</a>
                <strong><?= $year ?></strong>
                <a href="?year=<?= $year + 1 ?>">›</a>
            </nav>
        </header>

        <?php if ($demoMode): ?>
            <div style="margin:-8px 0 18px;color:#ff3df2;font-size:.75rem;letter-spacing:.08em">
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
            <span>3ventz.ch</span>
            <span>// <?= count($events) ?> events loaded</span>
        </footer>
    </main>
    <script>
        window.THREEVENTZ = {
            year: <?= $year ?>,
            eventCount: <?= count($events) ?>
        };
    </script>
    <script src="/assets/app.js"></script>
</body>
</html>
