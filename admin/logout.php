<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/bootstrap.php';

$_SESSION = [];
session_destroy();

header('Location: /admin/login.php');
exit;
