<?php
declare(strict_types=1);
require __DIR__ . '/lib/bootstrap.php';

$legal = $config['legal'] ?? [];
$legalReady =
    !empty($legal['name']) &&
    !empty($legal['email']);

if (!$legalReady) {
    http_response_code(503);
}
?>
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon.png">
    <title>Impressum + Datenschutz // tech3ventz.ch</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<main class="legal-page">
    <h1>impressum + datenschutz</h1>

    <section class="legal-community">
        <h2>Von der Community für die Community</h2>
        <p>
            tech3ventz.ch ist ein unabhängiges Community-Projekt ohne Werbung.
            Jeder darf passende Hacker-, Maker-, Retro-, Coding- und Tech-Events einreichen.
            Die Seite bleibt kostenlos – für Besucherinnen und Besucher genauso wie für Veranstalter.
        </p>
        <p>
            Wir verkaufen keine Personendaten und verwenden sie nicht für Werbung oder Profiling.
            Es gibt keine Werbetracker und keine versteckten Nutzerprofile.
        </p>
    </section>

    <?php if (!$legalReady): ?>
        <p>Die rechtlichen Kontaktdaten sind noch nicht konfiguriert.</p>
    <?php else: ?>
        <h2>Impressum</h2>
        <address>
            <?= h((string)$legal['name']) ?><br>
            E-Mail: <a href="mailto:<?= h((string)$legal['email']) ?>"><?= h((string)$legal['email']) ?></a>
        </address>

        <h2>Datenschutz</h2>
        <p>
            Verantwortlich für die Bearbeitung von Personendaten auf dieser Website ist die oben
            genannte Person. Fragen zum Datenschutz können an die angegebene E-Mail-Adresse gerichtet werden.
        </p>

        <p>
            Die Website wird bei ALL-INKL.COM – Neue Medien Münnich in Deutschland gehostet.
            Beim Abruf der Website können durch den Hosting-Anbieter technisch erforderliche
            Server-Logdaten verarbeitet werden, insbesondere IP-Adresse, Zeitpunkt, angeforderte Datei,
            Referrer sowie Angaben zu Browser und Betriebssystem. Diese Daten dienen insbesondere dem
            sicheren und zuverlässigen Betrieb des Webservers.
        </p>

        <p>
            tech3ventz.ch verwendet keinen Analyse- oder Werbetracker. Für den sichtbaren Besucherzähler
            wird bei jedem Aufruf lediglich ein gemeinsamer Zähler für das jeweilige Kalenderjahr um
            eins erhöht. Dabei wird für diesen Zähler keine Besucher-ID, IP-Adresse oder sonstige
            Kennung gespeichert.
        </p>

        <p>
            Die ausgewählte Darstellung («Theme») wird ausschliesslich lokal im Browser mittels
            localStorage gespeichert, damit die Auswahl beim nächsten Besuch wiederhergestellt werden
            kann. Diese Theme-Einstellung wird nicht an tech3ventz.ch übertragen und nicht zu Werbe- oder
            Profilingzwecken verwendet.
        </p>


        <h2>Partner-Accounts und Passwortsicherheit</h2>
        <p>
            Für Veranstalter können geschützte Partner-Accounts eingerichtet werden. Dabei werden
            insbesondere Benutzername, Anzeigename, Account-Status und die dem Account zugeordneten
            Events verarbeitet. Passwörter werden nicht im Klartext gespeichert, sondern ausschliesslich
            als kryptografischer Passwort-Hash mittels der von PHP bereitgestellten
            <code>password_hash()</code>-Funktion.
        </p>

        <p>
            Änderungen an Events werden aus Sicherheits- und Nachvollziehbarkeitsgründen in einem
            internen Audit-Protokoll festgehalten. Dabei werden insbesondere der verwendete Account,
            die Art der Änderung, das betroffene Event und der Zeitpunkt gespeichert. Dieses Protokoll
            ist nur für die Administration zugänglich und wird nicht für Werbung oder Profiling verwendet.
        </p>

        <p>
            Wenn ein Partner freiwillig ein neues Passwort setzt, wird dieses vor der Speicherung gegen
            den Dienst «Pwned Passwords» von Have I Been Pwned geprüft, um bereits aus bekannten
            Datenleaks kompromittierte Passwörter zu erkennen. Das Passwort selbst wird dabei niemals an
            Have I Been Pwned übertragen.
        </p>

        <p>
            Für diese Prüfung wird auf dem Server lokal ein SHA-1-Hash des eingegebenen Passworts
            erzeugt. An die Pwned-Passwords-API werden ausschliesslich die ersten fünf Zeichen dieses
            Hashes übertragen. Der vollständige Hash sowie das Klartext-Passwort verlassen
            tech3ventz.ch nicht. Die API liefert eine Menge möglicher Hash-Endungen zurück; der eigentliche
            Vergleich mit dem vollständigen Hash erfolgt ausschliesslich lokal auf unserem Server.
            Dieses Verfahren wird als k-Anonymity bezeichnet.
        </p>

        <p>
            Die Abfrage an Have I Been Pwned erfolgt serverseitig und nicht direkt aus dem Browser des
            Benutzers. Dabei können beim externen Dienst technisch notwendige Verbindungsdaten der
            Serveranfrage verarbeitet werden. Das Klartext-Passwort, der vollständige Passwort-Hash,
            der Benutzername des tech3ventz-Accounts und die Browser-IP-Adresse werden von
            tech3ventz.ch nicht als Bestandteil der Passwortprüfung an Have I Been Pwned übermittelt.
        </p>

        <p>
            Externe Links führen zu Angeboten Dritter. Für deren Inhalte und Datenbearbeitungen gelten
            die jeweiligen Bestimmungen der Drittanbieter.
        </p>

        <p>
            Betroffene Personen können sich für Auskunft, Berichtigung oder Löschung ihrer bei uns
            bearbeiteten Personendaten an die oben angegebene E-Mail-Adresse wenden.
        </p>
    <?php endif; ?>

    <a class="legal-back" href="/">← back to tech3ventz</a>
</main>
</body>
</html>
