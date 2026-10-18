<?php
declare(strict_types=1);

/**
 * PinFlix PHP catalogue/provider layer. Requires PHP >= 8.2.
 * Every upstream request uses a fixed, known endpoint on cineplexbd.net;
 * callers cannot supply an upstream hostname, redirect target or media URL.
 */
const PF_ORIGIN = 'http://cineplexbd.net';
const PF_MAX_RESPONSE = 1500000;

function pf_enabled(string $name): bool {
    return getenv($name) === 'true';
}
function pf_snapshot(): array {
    static $snapshot = null;
    if ($snapshot === null) {
        $path = __DIR__ . '/catalogue.json';
        $data = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
        $snapshot = is_array($data) ? $data : ['items'=>[], 'categories'=>[], 'years'=>[], 'details'=>[], 'retrievedAt'=>null];
    }
    return $snapshot;
}
function pf_clean(string $s): string {
    return trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($s), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
}
function pf_mature(string $s): bool {
    return (bool) preg_match('/adult|xxx|porn|18\+|mature|erotic/i', $s);
}
function pf_allowed_image(?string $src): ?string {
    if (!$src || strlen($src) > 1500) return null;
    if (str_starts_with($src, '/uploads/')) $src = PF_ORIGIN . $src;
    $parts = parse_url($src);
    if (!is_array($parts) || isset($parts['user']) || isset($parts['pass']) || isset($parts['port']) || isset($parts['fragment'])) return null;
    $host = strtolower((string) ($parts['host'] ?? ''));
    $path = (string) ($parts['path'] ?? '');
    $scheme = (string) ($parts['scheme'] ?? '');
    if ($host === 'cineplexbd.net' && in_array($scheme, ['http','https'], true)
        && preg_match('~^/uploads/[A-Za-z0-9_./%-]+\.(?:jpe?g|png|webp)$~i', $path)
        && !str_contains($path, '..')) return $src;
    if ($host === 'image.tmdb.org' && $scheme === 'https'
        && preg_match('~^/t/p/[A-Za-z0-9/_-]+\.(?:jpe?g|png|webp)$~i', $path)) return $src;
    return null;
}
function pf_cache(string $key, int $ttl, callable $loader): mixed {
    $dir = __DIR__ . '/cache';
    $path = $dir . '/' . hash('sha256', $key) . '.json';
    if (is_file($path) && time() - (int) filemtime($path) < $ttl) {
        $cached = json_decode((string) file_get_contents($path), true);
        if (is_array($cached) && array_key_exists('value', $cached)) return $cached['value'];
    }
    $value = $loader();
    if ((is_dir($dir) || @mkdir($dir, 0700, true)) && is_writable($dir)) {
        $tmp = @tempnam($dir, 'pf-');
        if ($tmp) {
            @chmod($tmp, 0600);
            @file_put_contents($tmp, json_encode(['value'=>$value], JSON_INVALID_UTF8_SUBSTITUTE));
            @rename($tmp, $path);
        }
    }
    return $value;
}
function pf_http_read(string $url, int $limit = PF_MAX_RESPONSE): string {
    $body = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) throw new RuntimeException('upstream_unavailable');
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => 9,
            CURLOPT_USERAGENT => 'PinFlixCatalogue/1.0',
            CURLOPT_HTTPHEADER => ['Accept: text/html, application/json, image/*'],
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, $limit): int {
                if (strlen($body) + strlen($chunk) > $limit) return 0;
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($ok === false || $status < 200 || $status >= 300) throw new RuntimeException('upstream_unavailable');
        return $body;
    }
    // Hosts without cURL can use the built-in HTTP stream handler (no redirects).
    $ctx = stream_context_create(['http'=>[
        'method'=>'GET', 'timeout'=>8, 'follow_location'=>0,
        'header'=>"User-Agent: PinFlixCatalogue/1.0\r\nAccept: text/html, application/json, image/*\r\n",
    ]]);
    $handle = @fopen($url, 'rb', false, $ctx);
    if ($handle === false) throw new RuntimeException('upstream_unavailable');
    $statusHeader = ($http_response_header ?? [])[0] ?? '';
    if (!preg_match('~^HTTP/\S+\s+2\d\d\b~', $statusHeader)) {
        fclose($handle);
        throw new RuntimeException('upstream_unavailable');
    }
    $body = stream_get_contents($handle, $limit + 1);
    fclose($handle);
    if ($body === false || strlen($body) > $limit) throw new RuntimeException('response_too_large');
    return $body;
}
function pf_upstream(string $endpoint, array $params = []): string {
    if (pf_enabled('PINFLIX_OFFLINE_MODE')) throw new RuntimeException('offline_mode');
    if (!in_array($endpoint, ['/', '/search.php', '/search_ajax.php', '/category.php', '/tcategory.php',
        '/tvs.php', '/tvs_more.php', '/view.php', '/watch.php'], true)) throw new InvalidArgumentException('invalid_endpoint');
    $url = PF_ORIGIN . $endpoint . ($params ? '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986) : '');
    return pf_cache('provider:' . $url, 180, static fn() => pf_http_read($url));
}
function pf_xpath(string $markup): ?DOMXPath {
    if (!class_exists('DOMDocument')) return null;
    $doc = new DOMDocument();
    $prior = libxml_use_internal_errors(true);
    $loaded = $doc->loadHTML('<?xml encoding="utf-8"?>' . $markup, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    libxml_clear_errors();
    libxml_use_internal_errors($prior);
    return $loaded ? new DOMXPath($doc) : null;
}
function pf_attr(?DOMNode $node, string $name): string {
    if (!$node instanceof DOMElement) return '';
    return $node->getAttribute($name);
}
function pf_one(DOMXPath $x, string $query, ?DOMNode $context = null): ?DOMNode {
    $nodes = $x->query($query, $context);
    return $nodes && $nodes->length ? $nodes->item(0) : null;
}
function pf_language(string $category): ?string {
    foreach (['Bangla','Hindi','English','Tamil','Telugu','Malayalam','Kannada','Korean','Japanese','Chinese'] as $l) {
        if (stripos($category, $l) !== false) return $l;
    }
    return null;
}
function pf_title(string $id, string $name, ?string $poster, string $category = '', ?int $year = null, string $kind = 'movie'): array {
    return [
        'id'=>$kind . '-' . $id, 'providerId'=>$id, 'kind'=>$kind, 'title'=>$name,
        'poster'=>pf_allowed_image($poster), 'backdrop'=>null, 'year'=>$year,
        'category'=>$category, 'language'=>pf_language($category), 'quality'=>null,
        'rating'=>null, 'mature'=>pf_mature($category), 'addedLabel'=>null,
        'synopsis'=>'', 'genres'=>[], 'cast'=>[], 'runtime'=>null, 'seasons'=>[]
    ];
}
function pf_parse_titles(string $markup, ?string $kindFilter = null): array {
    $x = pf_xpath($markup);
    if (!$x) return [];
    $links = $x->query('//a[@href]');
    if (!$links) return [];
    $items = [];
    foreach ($links as $a) {
        $href = pf_attr($a, 'href');
        $linkHost = parse_url($href, PHP_URL_HOST);
        if ($linkHost !== null && strtolower((string) $linkHost) !== 'cineplexbd.net') continue;
        $path = parse_url($href, PHP_URL_PATH);
        if (!str_starts_with((string)$path, '/')) $path = '/' . ltrim((string)$path, '/');
        $kind = in_array($path, ['/view.php','/player.php'], true) ? 'movie'
            : (in_array($path, ['/watch.php','/tview.php'], true) ? 'series' : null);
        if (!$kind || ($kindFilter && $kind !== $kindFilter)) continue;
        parse_str((string) parse_url($href, PHP_URL_QUERY), $params);
        $id = (string) ($params['id'] ?? $params['series_id'] ?? '');
        if (!preg_match('/^\d{1,12}$/D', $id)) continue;
        $img = pf_one($x, './/img[not(@alt="IMDb")][1]', $a);
        $name = pf_clean(pf_attr($img, 'alt'));
        if ($name === '' || $name === 'Poster' || preg_match('/^E\d+$/', $name)) continue;
        $text = pf_clean($a->textContent ?? '');
        preg_match_all('/\b(?:19|20)\d{2}\b/', $text, $yrs);
        $year = $yrs[0] ? (int) end($yrs[0]) : null;
        $categoryNode = pf_one($x, './/*[contains(concat(" ", normalize-space(@class), " "), " catLabel ") or contains(concat(" ", normalize-space(@class), " "), " meta-cat ")]', $a);
        $category = pf_clean($categoryNode?->textContent ?? '');
        $item = pf_title($id, $name, pf_attr($img, 'src'), $category, $year, $kind);
        if (preg_match('/\b(4K|2160p|1080p|720p)\b/i', $text, $quality)) $item['quality'] = strtoupper($quality[1]);
        $items[$item['id']] = $item;
    }
    return array_values($items);
}
function pf_parse_search(string $raw): array {
    $data = json_decode($raw, true);
    $items = [];
    foreach ((array) ($data['results'] ?? []) as $row) {
        if (!is_array($row)) continue;
        $id = (string) ($row['id'] ?? '');
        $kind = (string) ($row['type'] ?? '');
        $title = pf_clean((string) ($row['title'] ?? ''));
        if (!preg_match('/^\d{1,12}$/D', $id) || !in_array($kind, ['movie','series'], true) || $title === '') continue;
        $poster = $row['poster'] ?? null;
        if (is_string($poster) && !str_contains($poster, '/')) $poster = 'https://image.tmdb.org/t/p/w500/' . $poster;
        $yr = filter_var($row['year'] ?? null, FILTER_VALIDATE_INT);
        $year = $yr && $yr >= 1888 && $yr <= (int) date('Y') + 3 ? (int) $yr : null;
        $item = pf_title($id, $title, is_string($poster) ? $poster : null, (string) ($row['category'] ?? ''), $year, $kind);
        $item['quality'] = isset($row['resolution']) && is_string($row['resolution']) ? $row['resolution'] : null;
        $items[$item['id']] = $item;
    }
    return array_values($items);
}
function pf_permitted(array $item): bool {
    return !($item['mature'] ?? false) || pf_enabled('PINFLIX_MATURE_ENABLED');
}
function pf_filter(array $items, array $q): array {
    $query = strtolower((string) ($q['q'] ?? ''));
    return array_values(array_filter($items, static function ($t) use ($q,$query): bool {
        if (!is_array($t) || !pf_permitted($t)) return false;
        if (($q['kind'] ?? '') !== '' && ($t['kind'] ?? '') !== $q['kind']) return false;
        if (($q['category'] ?? '') !== '' && ($t['category'] ?? '') !== $q['category']) return false;
        if (($q['year'] ?? 0) && ($t['year'] ?? null) !== (int) $q['year']) return false;
        return $query === '' || str_contains(strtolower(($t['title'] ?? '') . ' ' . ($t['category'] ?? '') . ' ' . ($t['year'] ?? '')), $query);
    }));
}
function pf_catalogue(array $q): array {
    $seed = pf_snapshot();
    $page = min(100, max(1, (int) ($q['page'] ?? 1)));
    $kind = ($q['kind'] ?? '') === 'series' ? 'series' : (($q['kind'] ?? '') === 'movie' ? 'movie' : '');
    $term = trim((string) ($q['q'] ?? ''));
    $category = (string) ($q['category'] ?? '');
    $year = (int) ($q['year'] ?? 0);
    $items = [];
    $stale = false;
    try {
        if ($term !== '') {
            $items = pf_parse_search(pf_upstream('/search_ajax.php', ['q'=>$term,'limit'=>60]));
            if (!$items) $items = pf_parse_titles(pf_upstream('/search.php', ['q'=>$term]));
        } elseif ($kind === 'series' && $category !== '') {
            $items = pf_parse_titles(pf_upstream('/tcategory.php', ['page'=>$page,'category'=>$category]), 'series');
        } elseif ($kind === 'series') {
            $items = pf_parse_titles(pf_upstream('/tvs.php'), 'series');
        } elseif ($category !== '') {
            $items = pf_parse_titles(pf_upstream('/category.php', ['page'=>$page,'category'=>$category]), 'movie');
        } else {
            $items = pf_parse_titles(pf_upstream($page === 1 && !$year ? '/' : '/category.php',
                ['page'=>$page] + ($year ? ['year[]'=>$year] : [])), 'movie');
        }
        if (!$items) throw new RuntimeException('catalogue_empty');
    } catch (Throwable) {
        $stale = true;
        $items = $seed['items'] ?? [];
    }
    // Include snapshot fallback without claiming it is live.
    $items = pf_filter($items, ['kind'=>$kind, 'category'=>$category, 'year'=>$year, 'q'=>$term]);
    $perPage = 24;
    $start = $stale ? ($page - 1) * $perPage : 0;
    $hasNext = $stale ? count($items) > $start + $perPage : count($items) >= $perPage;
    return [
        'items'=>array_slice($items, $start, $perPage),
        'categories'=>array_values(array_filter($seed['categories'] ?? [], static fn($c) => is_array($c) && (!($c['mature'] ?? false) || pf_enabled('PINFLIX_MATURE_ENABLED')))),
        'years'=>$seed['years'] ?? [], 'page'=>$page, 'hasNext'=>$hasNext,
        'stale'=>$stale, 'retrievedAt'=>$stale ? ($seed['retrievedAt'] ?? null) : gmdate('c'),
    ];
}
function pf_detail(string $id, int $season = 1): array {
    if (!preg_match('/^(movie|series)-(\d{1,12})$/D', $id, $match)) throw new InvalidArgumentException('invalid_id');
    $kind = $match[1]; $pid = $match[2];
    $seed = pf_snapshot();
    $stored = null;
    foreach (($seed['details'] ?? []) as $d) if (($d['title']['id'] ?? '') === $id) { $stored = $d; break; }
    foreach (($seed['items'] ?? []) as $t) {
        if (($t['id'] ?? '') === $id && !$stored) $stored = ['title'=>$t, 'episodes'=>[], 'season'=>$season];
    }
    $data = $stored;
    $stale = true;
    try {
        $markup = pf_upstream($kind === 'movie' ? '/view.php' : '/watch.php', ['id'=>$pid, 'season'=>$season]);
        $x = pf_xpath($markup);
        if (!$x) throw new RuntimeException('dom_unavailable');
        $h = pf_one($x, '//h1');
        $title = pf_clean($h?->textContent ?? '');
        if (!$title) throw new RuntimeException('detail_unavailable');
        $img = pf_one($x, $kind === 'series' ? '//video[@poster]' : '//*[contains(concat(" ",normalize-space(@class)," ")," poster ")]');
        $poster = pf_attr($img, $kind === 'series' ? 'poster' : 'src');
        $detailTitle = pf_title($pid, $title, $poster ?: ($stored['title']['poster'] ?? null), '', null, $kind);
        $description = pf_one($x, '//*[@id="synopsis"]');
        $detailTitle['synopsis'] = pf_clean($description?->textContent ?? '');
        $episodes = []; $seasons = [];
        $seasonNodes = $x->query('//select[@name="season"]/option');
        foreach ($seasonNodes ?: [] as $option) {
            $n = (int) pf_attr($option, 'value');
            if ($n > 0 && $n < 100) $seasons[] = $n;
        }
        $epNodes = $x->query('//*[contains(concat(" ",normalize-space(@class)," ")," ep-card ")]');
        foreach ($epNodes ?: [] as $ep) {
            $n = (int) pf_attr($ep, 'data-ep');
            if ($n < 1) continue;
            $nameNode = pf_one($x, './/span[contains(concat(" ",normalize-space(@class)," ")," truncate ")]', $ep);
            $thumb = pf_one($x, './/img', $ep);
            $episodes[] = ['number'=>$n,'season'=>$season,'title'=>pf_clean($nameNode?->textContent ?? '') ?: 'Episode '.$n,
                'thumbnail'=>pf_allowed_image(pf_attr($thumb, 'src')), 'quality'=>null];
        }
        $detailTitle = array_replace(($stored['title'] ?? []), $detailTitle);
        $detailTitle['synopsis'] = $detailTitle['synopsis'] ?: ($stored['title']['synopsis'] ?? '');
        $detailTitle['seasons'] = $seasons ?: ($stored['title']['seasons'] ?? []);
        $data = ['title'=>$detailTitle, 'episodes'=>$episodes ?: ($stored['episodes'] ?? []), 'season'=>$season];
        $stale = false;
    } catch (Throwable) {
        if (!$data) throw new RuntimeException('detail_unavailable');
    }
    if (!pf_permitted($data['title'])) throw new DomainException('mature_disabled');
    $data['related'] = array_slice(pf_filter($seed['items'] ?? [], ['kind'=>$kind]), 0, 12);
    $data['stale'] = $stale;
    return $data;
}
function pf_playback(string $id, int $season, int $episode): array {
    if (!preg_match('/^(movie|series)-\d{1,12}$/D', $id)) throw new InvalidArgumentException('invalid_id');
    if (!pf_enabled('PINFLIX_PLAYBACK_AUTHORIZED')) return ['status'=>'authorization_required','message'=>'Playback is not enabled for this provider.','checkedAt'=>gmdate('c')];
    // A hosting flag is not proof of rights: an operator must separately supply
    // approved URLs in a private manifest and explicitly allow each HTTPS host.
    $manifest = __DIR__ . '/media.json';
    $media = is_file($manifest) ? json_decode((string) file_get_contents($manifest), true) : [];
    $key = $id . ($season ? ':'.$season.':'.$episode : '');
    $entry = $media[$key] ?? $media[$id] ?? null;
    $url = $entry['url'] ?? '';
    $parts = is_string($url) ? parse_url($url) : false;
    $host = is_array($parts) ? strtolower((string)($parts['host'] ?? '')) : '';
    $allow = array_filter(array_map('trim', explode(',', strtolower((string)(getenv('PINFLIX_MEDIA_HOSTS') ?: '')))));
    if (!is_array($entry) || !is_string($url) || !is_array($parts) ||
        ($parts['scheme'] ?? '') !== 'https' ||
        isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment']) ||
        !in_array($host, $allow, true)
        || !preg_match('/\.(mp4|m3u8)(?:\?|$)/i', $url)) {
        return ['status'=>'unavailable','message'=>'No approved HTTPS media source configured for this title.','checkedAt'=>gmdate('c')];
    }
    return ['status'=>'ready','url'=>$url,'format'=>str_contains(parse_url($url, PHP_URL_PATH) ?: '', '.m3u8') ? 'hls' : 'mp4',
        'subtitles'=>[], 'message'=>'', 'checkedAt'=>gmdate('c')];
}
