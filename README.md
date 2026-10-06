# tech3ventz.ch

A tiny cyberpunk-style yearly calendar for hacker, maker, open-source and security events.

🌐 **Live:** https://tech3ventz.ch/

## V1

- Public one-page yearly calendar
- Dark / neon UI
- Admin login
- Create, edit and delete events
- MySQL storage
- No framework, no build step

## Setup

1. Create a MySQL database.
2. Import `database/schema.sql`.
3. Copy `config.example.php` to `config.local.php`.
4. Fill in your database credentials.
5. Generate an admin password hash:

```bash
php -r "echo password_hash('CHANGE-ME', PASSWORD_DEFAULT), PHP_EOL;"
```

6. Put the resulting hash into `config.local.php`.
7. Point the webroot to this repository.

The real `config.local.php` is ignored by Git and must never be committed.
