"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  Menu,
  Play,
  User,
  LogOut,
  Bookmark,
  Clock,
  ChevronDown,
  Film,
  Tv,
  Home,
} from "lucide-react";
import { api, type Title } from "@/lib/model";
import { titleHref } from "@/lib/curation";
import { Artwork } from "./artwork";
import { read, write } from "@/lib/storage";
import { useAccount } from "./account-context";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Play size={17} fill="currentColor" />
      </span>
      pin<span className="brand-accent">flix</span>
      <i />
    </span>
  );
}
const links = [
  ["/", "Home"],
  ["/movies/", "Movies"],
  ["/series/", "TV Series"],
  ["/my-list/", "My List"],
  ["/services/", "Services"],
  ["/about/", "About"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const explorer = /^\/(?:search|movies|series)?\/?$/.test(pathname);
  const router = useRouter();
  const { user, preferences, logout } = useAccount();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Title[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const openSearch = () => {
    const r = read<unknown>("search", []);
    setRecent(
      Array.isArray(r)
        ? r.filter((x): x is string => typeof x === "string").slice(0, 6)
        : [],
    );
    setQ("");
    setItems([]);
    setActive(-1);
    setOpen(true);
    setMenu(false);
  };
  const closeSearch = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 35);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      ) {
        e.preventDefault();
        trigger.current?.click();
      }
      if (e.key === "Escape") {
        setMenu(false);
        setProfile(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (!profile) return;
    const handle = (e: PointerEvent) => {
      if (!dropdown.current?.contains(e.target as Node)) setProfile(false);
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, [profile]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const r = await fetch(api("/suggest?q=" + encodeURIComponent(q)), {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!controller.signal.aborted) setItems(d.items || []);
      } catch {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  function search(value = q) {
    const term = value.trim();
    if (!term) return;
    write("search", [term, ...recent.filter((x) => x !== term)].slice(0, 6));
    setOpen(false);
    router.push("/search/?q=" + encodeURIComponent(term));
  }
  const name = user?.name || preferences.name;
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header
        className={`header ${pathname === "/" && !scrolled ? "header-transparent" : "header-solid"} ${explorer ? "explorer-hide" : ""}`}
      >
        <Link href="/" aria-label="PinFlix home">
          <Brand />
        </Link>
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={`nav-links ${menu ? "mobile-open" : ""}`}
        >
          {links.map(([url, label]) => (
            <Link
              key={url}
              href={url}
              onClick={() => setMenu(false)}
              aria-current={
                (url === "/"
                  ? pathname === "/"
                  : pathname.startsWith(url.replace(/\/$/, "")))
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
          <Link
            href="/my-list/?tab=continue-watching"
            className="mobile-only"
            onClick={() => setMenu(false)}
          >
            Continue Watching
          </Link>
        </nav>
        <div className="nav-right">
          <button
            className="search-trigger"
            aria-label="Search catalogue (press /)"
            title="Search · /"
            onClick={openSearch}
            ref={trigger}
          >
            <Search size={18} />
            <span>Find a story</span>
            <kbd>/</kbd>
          </button>
          <span className="nav-divider" />
          <div className="profile-nav" ref={dropdown}>
            <button
              className={`avatar avatar-${preferences.avatar}`}
              aria-label="Open profile menu"
              aria-expanded={profile}
              onClick={() => setProfile((p) => !p)}
            >
              {name.charAt(0).toUpperCase()}
            </button>
            {profile && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-heading">
                  <strong>{name}</strong>
                  <small>{user ? "Your account" : "Your local profile"}</small>
                </div>
                <Link href="/profile/" onClick={() => setProfile(false)}>
                  <User size={16} /> Profile & preferences
                </Link>
                <Link href="/my-list/" onClick={() => setProfile(false)}>
                  <Bookmark size={16} /> Watch Later
                </Link>
                <Link
                  href="/my-list/?tab=continue-watching"
                  onClick={() => setProfile(false)}
                >
                  <Clock size={16} /> Continue Watching
                </Link>
                {user ? (
                  <button
                    onClick={() => {
                      void logout();
                      setProfile(false);
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                ) : (
                  <Link href="/login/" onClick={() => setProfile(false)}>
                    <ArrowUpRight size={16} /> Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
          <button
            className="menu-toggle icon-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="main-navigation"
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      <main id="content" className={explorer ? "main-explorer" : undefined}><div className="ambient-backdrop" aria-hidden="true" />{children}</main>
      <footer className={`footer ${explorer ? "explorer-hide" : ""}`}>
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" aria-label="PinFlix home">
              <Brand />
            </Link>
            <h2>
              A world of stories.
              <br />
              <span>All in one place.</span>
            </h2>
            <p>
              Discover your next favourite movie or series.
              <br />
              Make every movie night your own.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <span>EXPLORE</span>
              <Link href="/movies/">Movies A–Z</Link>
              <Link href="/series/">TV Series A–Z</Link>
              <Link href="/search/">Search the collection</Link>
              <Link href="/my-list/">Your library</Link>
            </div>
            <div>
              <span>PINFLIX</span>
              <Link href="/about/">About us</Link>
              <Link href="/services/">Our services</Link>
              <Link href="/profile/">Your preferences</Link>
              <Link href="/login/">Sign in</Link>
            </div>
            <div>
              <span>THE DETAILS</span>
              <Link href="/privacy-policy/">Privacy policy</Link>
              <Link href="/terms-and-conditions/">Terms & conditions</Link>
              <a href="#content">
                Back to top <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} PinFlix</span>
          <span className="footer-signature">
            <i /> YOUR NEXT STORY STARTS HERE
          </span>
          <span>Made for the love of stories.</span>
        </div>
      </footer>
      <nav className={`bottom-nav ${explorer ? "explorer-hide" : ""}`} aria-label="Quick navigation">
        {[
          ["/", "Home", Home],
          ["/movies", "Movies", Film],
          ["/series", "Series", Tv],
          ["/my-list", "My List", Bookmark],
        ].map(([href, label, Icon]) => {
          const C = Icon as typeof Home;
          return (
            <Link
              key={href as string}
              href={href as string}
              aria-current={
                pathname.replace(/\/$/, "") === (href === "/" ? "" : href)
                  ? "page"
                  : undefined
              }
            >
              <C size={19} />
              <span>{label as string}</span>
            </Link>
          );
        })}
      </nav>
      {open && (
        <div
          className="search-overlay"
          role="presentation"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeSearch();
          }}
        >
          <div
            className="search-dialog"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-label"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                closeSearch();
              }
              if (e.key === "Tab") {
                const els = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button,input,a",
                  ),
                ).filter((el) => !el.hasAttribute("disabled"));
                const first = els[0],
                  last = els.at(-1);
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="search-dialog-heading">
              <span id="search-label">FIND YOUR NEXT STORY</span>
              <button
                className="icon-button"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <X size={19} />
              </button>
            </div>
            <form
              className="search-box"
              onSubmit={(e) => {
                e.preventDefault();
                if (active >= 0 && items[active]) {
                  setOpen(false);
                  router.push(titleHref(items[active]));
                } else search();
              }}
            >
              <Search size={24} />
              <input
                ref={input}
                value={q}
                placeholder="Movies, series, a new obsession…"
                aria-label="Search movies and series"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls="search-suggestions"
                aria-autocomplete="list"
                aria-activedescendant={
                  active >= 0 ? `suggestion-${active}` : undefined
                }
                onChange={(e) => {
                  setQ(e.target.value);
                  setItems([]);
                  setActive(-1);
                  setLoading(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => Math.min(items.length - 1, i + 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => Math.max(-1, i - 1));
                  }
                }}
              />
              {q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQ("");
                    setItems([]);
                    setActive(-1);
                    input.current?.focus();
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </form>
            {q.trim().length < 2 ? (
              <div className="search-recent">
                <div className="small-label">
                  {recent.length
                    ? "RECENT SEARCHES"
                    : "START WITH A LITTLE CURIOSITY"}
                  {recent.length > 0 && (
                    <button
                      onClick={() => {
                        write("search", []);
                        setRecent([]);
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {recent.length ? (
                  recent.map((r) => (
                    <button key={r} onClick={() => search(r)}>
                      <Clock size={15} />
                      {r}
                      <ArrowUpRight size={14} />
                    </button>
                  ))
                ) : (
                  <p>
                    Search the PinFlix collection by title. Your next favourite
                    is waiting.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div role="status" className="search-status">
                  {loading
                    ? "Finding stories…"
                    : error
                      ? "The collection could not be reached. Try again."
                      : items.length
                        ? `${items.length} stories found`
                        : "No matching stories. Try another title."}
                </div>
                <div
                  id="search-suggestions"
                  role="listbox"
                  aria-label="Suggested titles"
                  className="search-suggestions"
                >
                  {items.map((t, i) => (
                    <Link
                      key={t.id}
                      id={`suggestion-${i}`}
                      href={titleHref(t)}
                      role="option"
                      aria-selected={active === i}
                      className={active === i ? "selected" : ""}
                      onClick={() => setOpen(false)}
                    >
                      <Artwork src={t.poster} alt="" />
                      <span>
                        <strong>{t.title}</strong>
                        <small>
                          {t.kind === "series" ? "TV Series" : "Movie"}
                          {t.year ? ` · ${t.year}` : ""}
                        </small>
                      </span>
                      <ArrowUpRight size={18} />
                    </Link>
                  ))}
                </div>
                <button className="search-all" onClick={() => search()}>
                  See all results for “{q}” <ArrowUpRight size={16} />
                </button>
              </>
            )}
            <div className="search-hints">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> to explore <kbd>↵</kbd> to open
              </span>
              <span>
                <kbd>esc</kbd> to close <ChevronDown size={12} />
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
