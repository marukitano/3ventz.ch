<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
super_admin_required();

$error = null;
$success = null;

function sanitize_admin_svg(string $source): ?string
{
    if (strlen($source) > 5 * 1024 * 1024) {
        return null;
    }

    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    if (!$doc->loadXML($source, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING)) {
        return null;
    }

    $allowedElements = [
        'svg','g','path','rect','circle','ellipse','line','polyline','polygon',
        'defs','linearGradient','radialGradient','stop','clipPath','mask','title','desc'
    ];
    $allowedAttributes = [
        'xmlns','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry',
        'd','points','fill','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin',
        'stroke-opacity','opacity','transform','gradientUnits','gradientTransform','offset',
        'stop-color','stop-opacity','clip-path','mask','preserveAspectRatio','role','aria-label'
    ];

    $nodes = [];
    foreach ($doc->getElementsByTagName('*') as $node) {
        $nodes[] = $node;
    }

    foreach ($nodes as $node) {
        if (!in_array($node->tagName, $allowedElements, true)) {
            $node->parentNode?->removeChild($node);
            continue;
        }

        $remove = [];
        foreach ($node->attributes ?? [] as $attr) {
            $name = $attr->name;
            $value = trim($attr->value);

            if (
                !in_array($name, $allowedAttributes, true) ||
                str_starts_with(strtolower($name), 'on') ||
                preg_match('/(?:javascript:|data:|https?:|file:)/i', $value)
            ) {
                $remove[] = $name;
            }
        }

        foreach ($remove as $name) {
            $node->removeAttribute($name);
        }
    }

    $root = $doc->documentElement;
    if (!$root || $root->tagName !== 'svg') {
        return null;
    }

    return $doc->saveXML($root) ?: null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string)($_POST['action'] ?? 'create');

    if ($action === 'create') {
        $username = strtolower(trim((string)($_POST['username'] ?? '')));
        $displayName = trim((string)($_POST['display_name'] ?? ''));
        $password = (string)($_POST['password'] ?? '');

        if (!preg_match('/^[a-z0-9._-]{3,80}$/', $username)) {
            $error = 'Username: 3–80 Zeichen, nur a-z, 0-9, Punkt, Unterstrich oder Bindestrich.';
        } elseif ($displayName === '' || strlen($displayName) > 120) {
            $error = 'Display Name fehlt oder ist zu lang.';
        } elseif (strlen($password) < 10) {
            $error = 'Passwort muss mindestens 10 Zeichen lang sein.';
        } else {
            try {
                $stmt = $pdo->prepare(
                    'INSERT INTO users (username, display_name, password_hash, active)
                     VALUES (?, ?, ?, 1)'
                );
                $stmt->execute([$username, $displayName, password_hash($password, PASSWORD_DEFAULT)]);
                $success = 'User angelegt.';
            } catch (PDOException $e) {
                if ((string)$e->getCode() === '23000') {
                    $error = 'Dieser Username existiert bereits.';
                } else {
                    throw $e;
                }
            }
        }
    }

    if ($action === 'edit_profile') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $displayName = trim((string)($_POST['display_name'] ?? ''));
        $website = trim((string)($_POST['website'] ?? ''));

        if ($userId <= 0) {
            $error = 'Ungültiger User.';
        } elseif ($displayName === '' || strlen($displayName) > 120) {
            $error = 'Display Name fehlt oder ist zu lang.';
        } elseif ($website !== '') {
            $parts = parse_url($website);
            $scheme = strtolower((string)($parts['scheme'] ?? ''));
            if (!filter_var($website, FILTER_VALIDATE_URL) || $scheme !== 'https') {
                $error = 'Website muss eine vollständige HTTPS-Adresse sein.';
            }
        }

        $currentLogoPath = '';
        if (!$error) {
            $stmt = $pdo->prepare('SELECT logo_path FROM users WHERE id = ? LIMIT 1');
            $stmt->execute([$userId]);
            $row = $stmt->fetch();
            if (!$row) {
                $error = 'User nicht gefunden.';
            } else {
                $currentLogoPath = (string)($row['logo_path'] ?? '');
            }
        }

        $newLogoPath = $currentLogoPath;

        if (!$error && isset($_FILES['logo']) && is_array($_FILES['logo']) && ($_FILES['logo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $file = $_FILES['logo'];

            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                $error = 'Logo-Upload fehlgeschlagen.';
            } elseif ((int)($file['size'] ?? 0) > 5 * 1024 * 1024) {
                $error = 'Das Logo darf maximal 5 MB gross sein.';
            } else {
                $tmp = (string)($file['tmp_name'] ?? '');
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $mime = (string)$finfo->file($tmp);

                $extensions = [
                    'image/png' => 'png',
                    'image/jpeg' => 'jpg',
                    'image/webp' => 'webp',
                    'image/svg+xml' => 'svg',
                    'text/xml' => 'svg',
                    'application/xml' => 'svg',
                ];

                $extension = $extensions[$mime] ?? null;
                $content = null;

                if ($extension === null) {
                    $error = 'Erlaubt sind PNG, JPEG, WebP oder SVG.';
                } elseif ($extension === 'svg') {
                    $raw = file_get_contents($tmp);
                    $content = is_string($raw) ? sanitize_admin_svg($raw) : null;
                    if ($content === null) {
                        $error = 'Diese SVG-Datei konnte nicht sicher verarbeitet werden.';
                    }
                }

                if (!$error) {
                    $uploadDir = dirname(__DIR__) . '/uploads/friends';
                    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
                        $error = 'Upload-Verzeichnis konnte nicht erstellt werden.';
                    } else {
                        $filename = 'friend-' . $userId . '-' . bin2hex(random_bytes(8)) . '.' . $extension;
                        $target = $uploadDir . '/' . $filename;

                        $saved = $extension === 'svg'
                            ? file_put_contents($target, $content) !== false
                            : move_uploaded_file($tmp, $target);

                        if (!$saved) {
                            $error = 'Logo konnte nicht gespeichert werden.';
                        } else {
                            if ($currentLogoPath !== '' && str_starts_with($currentLogoPath, '/uploads/friends/')) {
                                $old = dirname(__DIR__) . $currentLogoPath;
                                if (is_file($old)) {
                                    @unlink($old);
                                }
                            }
                            $newLogoPath = '/uploads/friends/' . $filename;
                        }
                    }
                }
            }
        }

        if (!$error) {
            $stmt = $pdo->prepare('UPDATE users SET display_name = ?, website = ?, logo_path = ? WHERE id = ?');
            $stmt->execute([
                $displayName,
                $website !== '' ? $website : null,
                $newLogoPath !== '' ? $newLogoPath : null,
                $userId,
            ]);
            $success = 'User-Profil geändert.';
        }
    }

    if ($action === 'toggle') {
        $userId = (int)($_POST['user_id'] ?? 0);
        if ($userId > 0) {
            $stmt = $pdo->prepare('UPDATE users SET active = IF(active = 1, 0, 1) WHERE id = ?');
            $stmt->execute([$userId]);
            $success = 'User-Status geändert.';
        }
    }

    if ($action === 'password') {
        $userId = (int)($_POST['user_id'] ?? 0);
        $password = (string)($_POST['password'] ?? '');

        if ($userId <= 0 || strlen($password) < 10) {
            $error = 'Neues Passwort muss mindestens 10 Zeichen lang sein.';
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([password_hash($password, PASSWORD_DEFAULT), $userId]);
            $success = 'Passwort geändert.';
        }
    }
}

$users = $pdo->query(
    'SELECT u.id, u.username, u.display_name, u.website, u.logo_path, u.active, u.created_at, COUNT(e.id) AS event_count
     FROM users u
     LEFT JOIN events e ON e.owner_user_id = u.id
     GROUP BY u.id, u.username, u.display_name, u.website, u.logo_path, u.active, u.created_at
     ORDER BY u.display_name, u.username'
)->fetchAll();
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // users</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/admin/">← Events</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1>PARTNER USERS</h1>
        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <?php if ($success): ?><p><?= h($success) ?></p><?php endif; ?>

        <form method="post">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="action" value="create">
            <div class="form-grid">
                <label>
                    Username
                    <input name="username" maxlength="80" pattern="[a-z0-9._-]{3,80}" required placeholder="diskette">
                </label>
                <label>
                    Display Name
                    <input name="display_name" maxlength="120" required placeholder="Diskette e.V.">
                </label>
                <label>
                    Password
                    <input type="password" name="password" minlength="10" autocomplete="new-password" required>
                </label>
            </div>
            <p><button type="submit">CREATE USER</button></p>
        </form>
    </section>

    <section class="admin-card">
        <h2>USERS</h2>
        <div style="overflow:auto">
            <table class="event-list">
                <thead><tr><th>User</th><th>Events</th><th>Status</th><th>Aktion</th></tr></thead>
                <tbody>
                <?php foreach ($users as $user): ?>
                    <tr>
                        <td><strong><?= h($user['display_name']) ?></strong><br><small><?= h($user['username']) ?></small></td>
                        <td><?= (int)$user['event_count'] ?></td>
                        <td><?= (int)$user['active'] === 1 ? 'active' : 'disabled' ?></td>
                        <td>
                            <div class="actions">
                                <form method="post" enctype="multipart/form-data" class="admin-user-edit">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="edit_profile">
                                    <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                    <input type="hidden" name="MAX_FILE_SIZE" value="5242880">
                                    <input name="display_name" maxlength="120" value="<?= h((string)$user['display_name']) ?>" placeholder="Display Name" required>
                                    <input type="url" name="website" maxlength="500" value="<?= h((string)($user['website'] ?? '')) ?>" placeholder="https://example.org">
                                    <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml">
                                    <?php if (!empty($user['logo_path'])): ?>
                                        <img class="admin-user-logo-preview" src="<?= h((string)$user['logo_path']) ?>" alt="">
                                    <?php endif; ?>
                                    <button type="submit" class="secondary">Save profile</button>
                                </form>
                                <form method="post">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="toggle">
                                    <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                    <button type="submit" class="secondary"><?= (int)$user['active'] === 1 ? 'Disable' : 'Enable' ?></button>
                                </form>
                                <form method="post">
                                    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="password">
                                    <input type="hidden" name="user_id" value="<?= (int)$user['id'] ?>">
                                    <input type="password" name="password" minlength="10" autocomplete="new-password" placeholder="New password" required>
                                    <button type="submit" class="secondary">Set password</button>
                                </form>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?>
                <?php if (!$users): ?><tr><td colspan="4">Noch keine Partner-User.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
    </section>
</main>
</body>
</html>
