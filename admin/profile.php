<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';
admin_required();

if (is_super_admin()) {
    http_response_code(403);
    exit('Dieses Profil ist nur für Partner-Accounts.');
}

$error = null;
$success = null;
$userId = current_user_id();

function sanitize_svg(string $source): ?string
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

$stmt = $pdo->prepare('SELECT username, display_name, website, logo_path FROM users WHERE id = ? AND active = 1 LIMIT 1');
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (!$user) {
    http_response_code(403);
    exit('Account nicht verfügbar.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $website = trim((string)($_POST['website'] ?? ''));
    if ($website !== '') {
        $parts = parse_url($website);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));

        if (!filter_var($website, FILTER_VALIDATE_URL) || !in_array($scheme, ['http', 'https'], true)) {
            $error = 'Bitte eine vollständige Website-Adresse mit http:// oder https:// eingeben.';
        }
    }

    $newLogoPath = (string)($user['logo_path'] ?? '');

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
                $content = is_string($raw) ? sanitize_svg($raw) : null;

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
                        if ($newLogoPath !== '' && str_starts_with($newLogoPath, '/uploads/friends/')) {
                            $old = dirname(__DIR__) . $newLogoPath;
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
        $stmt = $pdo->prepare('UPDATE users SET website = ?, logo_path = ? WHERE id = ?');
        $stmt->execute([
            $website !== '' ? $website : null,
            $newLogoPath !== '' ? $newLogoPath : null,
            $userId,
        ]);

        $user['website'] = $website;
        $user['logo_path'] = $newLogoPath;
        $success = 'Profil gespeichert.';
    }
}
?>
<!doctype html>
<html lang="de" class="admin-page-root">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>tech3ventz // profil</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="admin-page">
<main class="admin-shell">
    <div class="actions" style="justify-content:space-between;margin-bottom:18px">
        <a class="button secondary" href="/admin/">← Events</a>
        <a class="button secondary" href="/admin/logout.php">Logout</a>
    </div>

    <section class="admin-card">
        <h1>FRIEND PROFIL</h1>
        <p><small>Website und Logo werden auf der Friends-Wall verwendet. Logos liegen lokal auf tech3ventz.ch.</small></p>

        <?php if ($error): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
        <?php if ($success): ?><p><?= h($success) ?></p><?php endif; ?>

        <form method="post" enctype="multipart/form-data">
            <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
            <input type="hidden" name="MAX_FILE_SIZE" value="5242880">

            <label>
                Website
                <input type="url" name="website" maxlength="500" value="<?= h((string)($user['website'] ?? '')) ?>" placeholder="https://example.org">
            </label>

            <label>
                Logo
                <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml">
            </label>

            <p><small>PNG, JPEG, WebP oder sanitisiertes SVG · maximal 5 MB.</small></p>

            <?php if (!empty($user['logo_path'])): ?>
                <p class="friend-profile-preview">
                    <img src="<?= h((string)$user['logo_path']) ?>" alt="<?= h((string)$user['display_name']) ?>">
                </p>
            <?php endif; ?>

            <p><button type="submit">PROFIL SPEICHERN</button></p>
        </form>
    </section>
</main>
</body>
</html>
