<?php
declare(strict_types=1);
// Development-only router: php -S 127.0.0.1:8080 -t php php/router.php
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('~^/(?:private|tests|\.|composer|node_modules)(?:/|$)~i', $uri)) {
    http_response_code(403);
    echo "Forbidden";
    return true;
}
if (preg_match('~^/assets/[A-Za-z0-9_-]+\.(?:css|js|svg|png|webp)$~', $uri)) return false;
if ($uri === '/api' || $uri === '/api/' || $uri === '/api/index.php') {
    require __DIR__ . '/api/index.php';
    return true;
}
if (preg_match('~^/(?:$|movies/?$|series/?$|search/?$|library/?$|title/(?:movie|series)-\d{1,12}/?$)~', $uri)) {
    require __DIR__ . '/index.php';
    return true;
}
http_response_code(404); echo 'Not found';
