<?php
declare(strict_types=1);
// This document root is served by PHP/LiteSpeed; no Node process or build needed.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (!preg_match('~^/(?:$|movies/?$|series/?$|search/?$|library/?$|title/(?:movie|series)-[0-9]{1,12}/?$)~', $path)) {
    http_response_code(404);
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; img-src 'self' data: https://image.tmdb.org; media-src 'self' blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#101211">
  <meta name="description" content="Discover movies and series in PinFlix. Explore collections, seasons and episodes.">
  <meta name="robots" content="noindex,nofollow">
  <title>PinFlix — A world of stories</title>
  <link rel="stylesheet" href="/assets/app.css?v=1">
  <script defer src="https://cdn.jsdelivr.net/npm/hls.js@1.6.15/dist/hls.min.js"></script>
  <script defer src="/assets/player.js?v=1"></script>
  <script defer src="/assets/app.js?v=1"></script>
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="header">
    <a class="brand" href="/" aria-label="PinFlix home"><span class="brand-mark">▶</span>Pin<span>Flix</span><i></i></a>
    <nav class="nav-links" aria-label="Main navigation">
      <a data-nav href="/">Home</a><a data-nav href="/movies">Movies</a>
      <a data-nav href="/series">TV series</a><a data-nav href="/library">My list</a>
    </nav>
    <form class="search" id="search-form" role="search">
      <label class="sr-only" for="search-input">Search movies and TV shows</label>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.3 16.3 4.4 4.4"/></svg>
      <input id="search-input" type="search" name="q" placeholder="Search titles or year…" autocomplete="off" maxlength="120">
      <div id="suggestions" class="suggestions" hidden></div>
    </form>
    <button id="mobile-menu" class="menu-button" aria-label="Toggle navigation" aria-expanded="false">☰</button>
  </header>
  <main id="content" tabindex="-1"><div class="loading-screen"><span class="spinner"></span><p>Loading your next story…</p></div></main>
  <footer class="footer"><a class="brand" href="/">Pin<span>Flix</span></a><span>Stories worth finding. · PHP edition</span><span id="source-note"></span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <noscript><section class="noscript">PinFlix requires JavaScript for catalogue discovery and the video player.</section></noscript>
</body>
</html>
