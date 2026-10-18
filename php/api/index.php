<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/private/provider.php';
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET'); http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error'=>'Method not allowed.']); exit;
}
function respond(mixed $body, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_SLASHES);
    exit;
}
function input(string $key, int $limit = 140): string {
    $v = $_GET[$key] ?? '';
    if (!is_string($v) || strlen($v) > $limit || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $v)) {
        respond(['error'=>'Invalid parameter: ' . $key], 400);
    }
    return trim($v);
}
$action = input('action', 30) ?: 'health';
if ($action === 'health') {
    respond(['ok'=>true,'service'=>'PinFlix PHP','runtime'=>'php','version'=>'1']);
}
if ($action === 'image') {
    $url = pf_allowed_image(input('src', 1500));
    if (!$url) respond(['error'=>'Image unavailable.'], 404);
    try {
        $bytes = pf_cache('poster:' . $url, 86400, static fn() => base64_encode(pf_http_read($url, 2000000)));
        $bytes = base64_decode((string) $bytes, true);
        if ($bytes === false) throw new RuntimeException('invalid_image');
        $mime = str_starts_with($bytes, "\xFF\xD8\xFF") ? 'image/jpeg'
            : (str_starts_with($bytes, "\x89PNG\r\n\x1a\n") ? 'image/png'
            : (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP' ? 'image/webp' : null));
        if (!$mime) throw new RuntimeException('invalid_image');
        header('Content-Type: ' . $mime);
        header('Cache-Control: public, max-age=3600');
        echo $bytes;
        exit;
    } catch (Throwable) {
        respond(['error'=>'Image unavailable.'], 502);
    }
}
try {
    if ($action === 'catalogue' || $action === 'search') {
        $kind = input('kind', 10);
        if (!in_array($kind, ['', 'movie', 'series'], true)) respond(['error'=>'Unknown kind.'], 400);
        $year = input('year', 4);
        if ($year !== '' && (!ctype_digit($year) || (int) $year < 1888 || (int) $year > (int) date('Y') + 3)) {
            respond(['error'=>'Invalid year.'], 400);
        }
        $category = input('category', 160);
        $query = input('q', 120);
        $page = input('page', 3) ?: '1';
        if (!ctype_digit($page) || (int) $page < 1 || (int) $page > 100) respond(['error'=>'Invalid page.'], 400);
        respond(pf_catalogue(['kind'=>$kind,'q'=>$query,'category'=>$category,'year'=>(int)$year,'page'=>(int)$page]));
    }
    if ($action === 'detail') {
        $season = input('season', 3) ?: '1';
        if (!ctype_digit($season) || (int) $season < 1 || (int) $season > 100) respond(['error'=>'Invalid season.'], 400);
        respond(pf_detail(input('id', 32), (int)$season));
    }
    if ($action === 'playback') {
        $season = input('season', 3) ?: '1';
        $episode = input('episode', 4) ?: '1';
        if (!ctype_digit($season) || (int)$season < 1 || (int)$season > 100 ||
            !ctype_digit($episode) || (int)$episode < 1 || (int)$episode > 1000) {
            respond(['error'=>'Invalid episode.'], 400);
        }
        respond(pf_playback(input('id', 32), (int)$season, (int)$episode));
    }
    respond(['error'=>'Unknown endpoint.'], 404);
} catch (InvalidArgumentException) {
    respond(['error'=>'Invalid request.'], 400);
} catch (DomainException) {
    respond(['error'=>'This title is restricted.'], 403);
} catch (Throwable) {
    respond(['error'=>'Catalogue temporarily unavailable.'], 503);
}
