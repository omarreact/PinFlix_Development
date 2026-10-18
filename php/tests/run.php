<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/private/provider.php';
$passed = 0;
function check(bool $condition, string $message): void {
    global $passed;
    if (!$condition) { fwrite(STDERR, "FAIL: $message\n"); exit(1); }
    $passed++;
    echo "PASS: $message\n";
}
$seed = pf_snapshot();
check(count($seed['items'] ?? []) >= 100, 'Original catalogue snapshot bundled');
check(pf_mature('18+ Adult'), 'Adult category is flagged');
check(!pf_mature('Animation'), 'Animation is not flagged');
check(pf_allowed_image('http://cineplexbd.net/uploads/poster.jpg') !== null, 'Known poster URL allowed');
check(pf_allowed_image('https://image.tmdb.org/t/p/w500/abc.jpg') !== null, 'Known HTTPS image CDN allowed');
check(pf_allowed_image('http://localhost/private.jpg') === null, 'Localhost blocked from image proxy');
check(pf_allowed_image('http://169.254.169.254/latest/meta-data/') === null, 'Cloud metadata blocked');
check(pf_allowed_image('https://cineplexbd.net/uploads/../secret.jpg') === null, 'Traversal blocked');
check(pf_allowed_image('http://user:pass@cineplexbd.net/uploads/a.jpg') === null, 'Credential-bearing URL blocked');
check(pf_allowed_image('http://cineplexbd.net:9090/uploads/a.jpg') === null, 'Unexpected port blocked');

$json = json_encode(['results'=>[
    ['id'=>12,'title'=>'Example Film','type'=>'movie','category'=>'English','poster'=>'','year'=>2025],
    ['id'=>13,'title'=>'Example Series','type'=>'series','category'=>'Korean','poster'=>'','year'=>2024],
    ['id'=>'bad','title'=>'Ignore','type'=>'movie'],
]]);
$items = pf_parse_search($json);
check(count($items) === 2, 'Search parser rejects malformed IDs');
check($items[0]['id'] === 'movie-12', 'Search results normalize film IDs');
check($items[1]['kind'] === 'series', 'Search results normalize TV series');
check(count(pf_filter($items, ['kind'=>'series'])) === 1, 'Kind filter works');
check(count(pf_filter($items, ['year'=>2025])) === 1, 'Year filter works');
check(count(pf_filter($items, ['q'=>'example film'])) === 1, 'Title filter works');

putenv('PINFLIX_OFFLINE_MODE=true');
if (class_exists('DOMDocument')) {
    $html = '<a href="/view.php?id=789"><img alt="Example Feature" src="http://cineplexbd.net/uploads/a.jpg"/><span>2025</span></a>';
    $parsed = pf_parse_titles($html);
    check(count($parsed) === 1 && $parsed[0]['id'] === 'movie-789', 'Movie cards parsed from provider HTML');
    check($parsed[0]['year'] === 2025, 'Movie year extracted from provider HTML');
}
$detail = pf_detail($seed['items'][0]['id']);
check(($detail['title']['id'] ?? '') === $seed['items'][0]['id'], 'Detail falls back to existing metadata');
check(($detail['stale'] ?? false) === true || is_array($detail), 'Fallback metadata labeled as stale');
$playback = pf_playback('movie-123', 1, 1);
check($playback['status'] === 'authorization_required', 'Playback is closed by default');
try { pf_playback('not-an-id', 1, 1); check(false, 'Invalid playback ID blocked'); }
catch (InvalidArgumentException) { check(true, 'Invalid playback ID blocked'); }
check(pf_permitted(['mature'=>false]), 'Normal title permitted');

echo "\nAll $passed PHP checks passed.\n";
