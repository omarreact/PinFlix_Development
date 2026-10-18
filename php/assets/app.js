(function appJs() {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const main = $("#content"), nav = $(".nav-links"), search = $("#search-input"), suggestionBox = $("#suggestions");
  const KEY = "pinflix:php:v1:list", HISTORY = "pinflix:php:v1:history";
  let currentRequest = 0, searchTimer = 0, currentPlayer = null;
  const state = { path: location.pathname, query: new URLSearchParams(location.search) };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const safeJson = key => { try { const x = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } };
  const store = (key, items) => { try { localStorage.setItem(key, JSON.stringify(items.slice(0, 200))); } catch { /* private mode */ } };
  const poster = src => src ? `/api/?action=image&src=${encodeURIComponent(src)}` : "";
  const validId = id => /^(movie|series)-[0-9]{1,12}$/.test(id || "");
  const titleUrl = t => `/title/${encodeURIComponent(t.id)}`;
  const genre = t => t.category || (t.kind === "series" ? "TV series" : "Movie");
  const label = t => [t.year, t.quality, genre(t)].filter(Boolean).join(" · ");
  const loading = () => `<div class="loading-screen"><span class="spinner"></span><p>Finding your next story…</p></div>`;
  const empty = (title, message) => `<div class="empty"><span>◇</span><h2>${esc(title)}</h2><p>${esc(message)}</p><a class="primary" data-link href="/movies">Explore movies →</a></div>`;
  async function request(params) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 13000);
    try {
      const res = await fetch("/api/?" + new URLSearchParams(params), {signal:controller.signal,headers:{Accept:"application/json"}});
      if (!res.ok) throw new Error("API " + res.status);
      return await res.json();
    } finally { clearTimeout(timeout); }
  }
  function notify(message) {
    const node = $("#toast"); node.textContent = message; node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 3200);
  }
  const staleNote = result => result?.stale ? `<p class="availability-note">Showing a dated catalogue snapshot. The live provider could not be reached.</p>` : "";
  function card(t) {
    const image = poster(t.poster);
    return `<a class="title-card" data-link href="${titleUrl(t)}" aria-label="Open ${esc(t.title)}"><div class="card-image">
      ${image ? `<img loading="lazy" src="${esc(image)}" alt="">` : `<span class="poster-fallback">▶</span>`}
      <span class="quality">${esc(t.quality || (t.kind === "series" ? "SERIES" : "FILM"))}</span><span class="card-action">↗</span></div>
      <h3>${esc(t.title)}</h3><p>${esc(label(t))}</p></a>`;
  }
  function row(title, items, href, kicker = "DISCOVER") {
    if (!items.length) return "";
    return `<section class="collection"><div class="section-heading"><div><p class="eyebrow">${esc(kicker)}</p><h2>${esc(title)}</h2></div>
      <a data-link href="${href}">View all ↗</a></div><div class="poster-grid">${items.slice(0, 12).map(card).join("")}</div></section>`;
  }
  function hero(t) {
    const backdrop = t ? poster(t.backdrop || t.poster) : "";
    return `<section class="hero">${backdrop ? `<div class="hero-photo"><img src="${esc(backdrop)}" alt=""></div>` : ""}
      <div class="hero-gradient"></div><div class="hero-copy">
      <p class="eyebrow"><span class="signal"></span> FEATURED ON PINFLIX</p>
      <p class="hero-meta">${t ? esc(label(t)) : "MOVIES · SERIES · DISCOVERY"}</p>
      <h1>${t ? esc(t.title) : "Find your next obsession."}</h1>
      <p class="hero-description">${t ? esc(t.synopsis || "Stories you will remember. Discover a world beyond the ordinary.") : "Discover films and shows, and find your next favourite."}</p>
      <div class="hero-actions"><a class="primary" data-link href="${t ? titleUrl(t) : "/movies"}">▶ &nbsp; Discover title</a>
      <a class="secondary" data-link href="/movies">Browse collection →</a></div></div>
      <div class="hero-footer"><span>CURATED FOR THE CURIOUS</span><span>01 / 01</span></div></section>`;
  }
  function updateNav() {
    state.path = location.pathname; state.query = new URLSearchParams(location.search);
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.getAttribute("href") === state.path));
    nav.classList.remove("expanded"); $("#mobile-menu").setAttribute("aria-expanded", "false");
  }
  function navigate(url) {
    const dest = new URL(url, location.origin);
    if (dest.origin !== location.origin) { location.assign(url); return; }
    history.pushState({}, "", dest.pathname + dest.search);
    if (currentPlayer) { currentPlayer.destroy(); currentPlayer = null; }
    suggestionBox.hidden = true; updateNav(); main.innerHTML = loading();
    scrollTo({top:0,behavior:"instant"}); void render();
  }
  async function renderHome(token) {
    const [movies, series] = await Promise.all([
      request({action:"catalogue",kind:"movie"}), request({action:"catalogue",kind:"series"})
    ]);
    if (token !== currentRequest) return;
    const cats = (movies.categories || []).filter(c => c.kind === "movie").slice(0, 9);
    main.innerHTML = hero(movies.items[0] || series.items[0]) + `<div class="page-content">
      <div class="discovery-bar"><span>Find your kind of story</span><div class="chips">
      ${cats.map(c => `<a data-link href="/movies?category=${encodeURIComponent(c.name)}">${esc(c.name)}</a>`).join("")}
      <a data-link href="/movies">All collections ↗</a></div></div>
      ${row("New stories, new obsessions", movies.items, "/movies", "FRESH ON THE SHELF")}
      <section class="editorial"><div><p class="eyebrow">ONE EPISODE IS NEVER ENOUGH</p>
      <h2>Make room for<br>a longer story.</h2><p>Explore seasons, discover episodes and keep your place.</p>
      <a class="primary" data-link href="/series">Find a series ↗</a></div>
      <div class="editorial-posters">${series.items.slice(0,3).map(t => `<a data-link href="${titleUrl(t)}"><img loading="lazy" src="${esc(poster(t.poster))}" alt="${esc(t.title)}"></a>`).join("")}</div></section>
      ${row("Series to settle into", series.items, "/series", "THE NEXT CHAPTER")}
      ${row("More to discover", movies.items.slice(12), "/movies", "EXPLORE FURTHER")}
      ${staleNote(movies)}${staleNote(series)}</div>`;
    $("#source-note").textContent = movies.stale ? "Catalogue snapshot mode" : "";
  }
  function pageUrl(changes) {
    const params = new URLSearchParams(location.search);
    Object.entries(changes).forEach(([k,v]) => params.set(k,String(v)));
    return location.pathname + "?" + params;
  }
  async function renderBrowse(token, kind = "") {
    const q = state.query.get("q") || "", category = state.query.get("category") || "";
    const year = state.query.get("year") || "", page = state.query.get("page") || "1";
    const result = await request({action:"catalogue",kind,q,category,year,page});
    if (token !== currentRequest) return;
    const heading = q ? `Results for “${q}”` : kind === "series" ? "Explore TV series" : kind === "movie" ? "The movie collection" : "Search PinFlix";
    const cats = (result.categories || []).filter(c => !kind || c.kind === kind);
    main.innerHTML = `<section class="browse page-content"><p class="eyebrow">DISCOVER YOUR NEXT STORY</p><h1>${esc(heading)}</h1>
      <p class="browse-intro">Explore original collections, hidden gems and big-screen favourites.</p>
      <form class="filters" id="filters"><label>Collection<select name="category"><option value="">All categories</option>
      ${cats.map(c => `<option value="${esc(c.name)}" ${c.name === category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>Year<select name="year"><option value="">All years</option>${(result.years || []).map(y=>`<option value="${y}" ${String(y)===year?"selected":""}>${y}</option>`).join("")}</select></label>
      <input type="hidden" name="q" value="${esc(q)}"><button class="primary" type="submit">Apply filters</button>
      <a class="text-link" data-link href="${kind === "series" ? "/series" : kind === "movie" ? "/movies" : "/search"}">Reset</a></form>
      <p class="result-count">${result.items.length} titles on this page ${result.stale ? "· Cached snapshot" : ""}</p>
      ${result.items.length ? `<div class="poster-grid poster-grid-full">${result.items.map(card).join("")}</div>` : empty("No matching titles", "Try different filters or a different title.")}
      <div class="pagination">${Number(page)>1?`<a class="secondary" data-link href="${pageUrl({page:Number(page)-1})}">← Previous</a>`:""}
      <span>Page ${esc(page)}</span>${result.hasNext?`<a class="secondary" data-link href="${pageUrl({page:Number(page)+1})}">Next →</a>`:""}</div>
      ${staleNote(result)}</section>`;
    $("#filters").addEventListener("submit", e => {
      e.preventDefault(); const next = new URLSearchParams();
      for (const [k,v] of new FormData(e.currentTarget).entries()) if(v) next.set(k,String(v));
      navigate(state.path + (next.size ? "?" + next : ""));
    });
    if(q) search.value = q;
  }
  const inList = id => safeJson(KEY).some(t => t.id === id);
  function toggleList(t) {
    const existing = inList(t.id), items = safeJson(KEY);
    store(KEY, existing ? items.filter(x=>x.id!==t.id) : [t,...items]);
    notify(existing ? "Removed from My List" : "Added to My List");
    const btn = $("#save-title"); if(btn) btn.textContent = existing ? "+ My List" : "✓ In My List";
  }
  async function renderDetail(token) {
    const id = decodeURIComponent(state.path.split("/").filter(Boolean)[1] || "");
    if(!validId(id)) { main.innerHTML = empty("Title not found","The title ID is invalid.");return; }
    const season = Number(state.query.get("season")) || 1;
    const data = await request({action:"detail",id,season});
    if(token!==currentRequest) return;
    const t = data.title, image = poster(t.backdrop || t.poster);
    main.innerHTML = `<div class="detail-nav page-content"><a data-link href="${t.kind==="series"?"/series":"/movies"}">← Back to ${t.kind==="series"?"series":"movies"}</a>
      <span>${t.kind==="series"?"THE NEXT CHAPTER":"BEHIND THE STORY"}</span></div>
      <section id="detail-hero" class="detail-hero">${image?`<div class="detail-art"><img src="${esc(image)}" alt=""></div>`:""}
      <div class="hero-gradient"></div><div class="detail-copy"><p class="eyebrow">${esc(genre(t))}</p><h1>${esc(t.title)}</h1>
      <p class="hero-meta">${esc(label(t))}</p><p class="hero-description">${esc(t.synopsis || "More information about this story is coming soon.")}</p>
      <div class="hero-actions"><button id="play-title" class="primary" type="button">▶ &nbsp; Play ${t.kind==="series"?"episode":"movie"}</button>
      <button class="secondary" id="save-title">${inList(id)?"✓ In My List":"+ My List"}</button></div>
      <p class="play-note" id="play-note" role="status"></p></div></section>
      <div class="page-content detail-content"><div class="story"><p class="eyebrow">THE STORY</p>
      <h2>${t.kind==="series"?"A world to return to.":"Take a closer look."}</h2>
      <p>${esc(t.synopsis || "No synopsis is available.")}</p></div>
      ${t.kind==="series"?`<section class="episodes"><div class="section-heading"><h2>Episodes</h2>
      <label>Season <select id="season-select">${[...new Set([...(t.seasons||[]),season])].sort((a,b)=>a-b).map(n=>`<option value="${n}" ${n===season?"selected":""}>${n}</option>`).join("")}</select></label></div>
      <div class="episode-grid">${(data.episodes||[]).length?data.episodes.map(ep=>`<button class="episode" data-episode="${ep.number}">
      <span>E${String(ep.number).padStart(2,"0")}</span><span>${esc(ep.title)}</span><span>▶</span></button>`).join(""):`<p class="availability-note">Episode metadata is temporarily unavailable.</p>`}</div></section>`:""}
      ${row("You might also enjoy",(data.related||[]).filter(x=>x.id!==id),t.kind==="series"?"/series":"/movies","YOU MAY ALSO LIKE")}
      ${data.stale?`<p class="availability-note">Details shown from a dated snapshot.</p>`:""}</div>`;
    $("#save-title").addEventListener("click",()=>toggleList(t));
    $("#play-title").addEventListener("click",()=>playTitle(t,season,1));
    $("#season-select")?.addEventListener("change",e=>navigate(`${titleUrl(t)}?season=${e.target.value}`));
    document.querySelectorAll("[data-episode]").forEach(btn=>btn.addEventListener("click",()=>playTitle(t,season,Number(btn.dataset.episode))));
  }
  async function playTitle(t,season,episode){
    const btn=$("#play-title"),note=$("#play-note"); if(btn)btn.disabled=true;
    if(note)note.textContent="Checking approved playback sources…";
    try {
      const source=await request({action:"playback",id:t.id,season,episode});
      if(source.status!=="ready"||!source.url){if(note)note.textContent=source.message||"Playback unavailable.";return;}
      const container=$("#detail-hero");
      if(currentPlayer)currentPlayer.destroy();
      currentPlayer=window.PinFlixPlayer.mount(container,source,{title:t.title,key:`${t.id}:${season}:${episode}`,onClose:()=>{currentPlayer=null;void render();}});
      const watch=safeJson(HISTORY).filter(x=>x.id!==t.id);store(HISTORY,[t,...watch]);
    } catch {if(note)note.textContent="Could not check playback. Please retry.";}
    finally{if(btn)btn.disabled=false;}
  }
  function renderLibrary(){
    const saved=safeJson(KEY).filter(t=>validId(t.id)),seen=safeJson(HISTORY).filter(t=>validId(t.id));
    main.innerHTML=`<section class="page-content browse"><p class="eyebrow">YOUR PERSONAL SPACE</p><h1>My List</h1>
    <p class="browse-intro">Keep favourites close. Saved privately on this device.</p>
    ${saved.length?`<div class="poster-grid poster-grid-full">${saved.map(card).join("")}</div>`:empty("Nothing saved yet","Explore movies and series, then save your favourites.")}
    ${seen.length?row("Continue exploring",seen,"/movies","RECENTLY OPENED"):""}</section>`;
  }
  async function render(){
    const token=++currentRequest;updateNav();main.innerHTML=loading();
    try{
      if(state.path.startsWith("/library")){renderLibrary();return;}
      if(state.path.startsWith("/title/")){await renderDetail(token);return;}
      if(state.path.startsWith("/movies")){await renderBrowse(token,"movie");return;}
      if(state.path.startsWith("/series")){await renderBrowse(token,"series");return;}
      if(state.path.startsWith("/search")){await renderBrowse(token);return;}
      await renderHome(token);
    }catch(error){if(token===currentRequest)main.innerHTML=empty("Discovery interrupted","Please reload or try again shortly.");console.error(error);}
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest("a[data-link]");if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
    e.preventDefault();navigate(a.href);
  });
  $("#search-form").addEventListener("submit",e=>{e.preventDefault();const q=search.value.trim();navigate("/search"+(q?"?q="+encodeURIComponent(q):""));});
  search.addEventListener("input",()=>{
    clearTimeout(searchTimer);const q=search.value.trim();if(q.length<2){suggestionBox.hidden=true;return;}
    searchTimer=setTimeout(async()=>{
      try{
        const r=await request({action:"search",q,page:1});if(search.value.trim()!==q)return;
        const items=r.items.slice(0,5);suggestionBox.innerHTML=items.map(t=>`<a data-link href="${titleUrl(t)}">${esc(t.title)} <small>${esc(t.year||genre(t))}</small></a>`).join("")||"<span>No matches found.</span>";
        suggestionBox.hidden=false;
      }catch{suggestionBox.hidden=true;}
    },340);
  });
  document.addEventListener("click",e=>{if(!e.target.closest(".search"))suggestionBox.hidden=true;});
  $("#mobile-menu").addEventListener("click",()=>{const open=nav.classList.toggle("expanded");$("#mobile-menu").setAttribute("aria-expanded",String(open));});
  addEventListener("popstate",()=>{if(currentPlayer){currentPlayer.destroy();currentPlayer=null;}void render();});
  void render();
})();
