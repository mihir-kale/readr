const MEMORY_CACHE = new Map();
const STORE_PREFIX = "readr:cover:v3:";

function configuredTmdbKey() {
  let key = "";
  try {
    const meta = document.querySelector('meta[name="tmdb-api-key"]');
    key = meta && meta.content ? meta.content.trim() : "";
  } catch {}
  if (!key) {
    try {
      key = (localStorage.getItem("tmdbApiKey") || "").trim();
    } catch {}
  }
  return key;
}

function cacheKey(rec) {
  return `${rec.mediaType}|${rec.title.toLowerCase()}|${(rec.source || "").toLowerCase()}`;
}

function readCache(key) {
  if (MEMORY_CACHE.has(key)) return MEMORY_CACHE.get(key);
  try {
    const stored = sessionStorage.getItem(STORE_PREFIX + key);
    if (stored !== null) {
      MEMORY_CACHE.set(key, stored);
      return stored;
    }
  } catch {}
  return undefined;
}

function writeCache(key, value) {
  MEMORY_CACHE.set(key, value);
  try {
    sessionStorage.setItem(STORE_PREFIX + key, value);
  } catch {}
}

function loadImage(url, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    img.addEventListener("load", () => {
      clearTimeout(timer);
      resolve(url);
    });
    img.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("load failed"));
    });
    img.src = url;
  });
}

async function firstLoadable(urls) {
  for (const url of urls) {
    if (!url) continue;
    try {
      return await loadImage(url);
    } catch {}
  }
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function googleBookCandidates(title, author) {
  try {
    const query = [`intitle:"${title}"`, author ? `inauthor:"${author}"` : ""]
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("+");
    const data = await fetchJson(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&country=US`
    );
    const links = (data.items || [])
      .map((item) => item.volumeInfo && item.volumeInfo.imageLinks)
      .find(Boolean);
    if (!links) return [];
    const best =
      links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail;
    if (!best) return [];
    const secure = best.replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "");
    const zoomed = /([?&])zoom=\d+/.test(secure)
      ? secure.replace(/([?&])zoom=\d+/, "$1zoom=3")
      : `${secure}${secure.includes("?") ? "&" : "?"}zoom=3`;
    return [...new Set([zoomed, secure])];
  } catch {
    return [];
  }
}

async function openLibraryCandidates(title, author) {
  try {
    const params = new URLSearchParams({ title, limit: "5", fields: "cover_i" });
    if (author) params.set("author", author);
    const data = await fetchJson(`https://openlibrary.org/search.json?${params}`);
    const hit = (data.docs || []).find((doc) => doc.cover_i);
    return hit ? [`https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`] : [];
  } catch {
    return [];
  }
}

async function tmdbCandidates(title) {
  const key = configuredTmdbKey();
  if (!key) return [];
  try {
    const params = new URLSearchParams({
      query: title,
      include_adult: "false",
      language: "en-US",
      page: "1"
    });
    const data = await fetchJson(`https://api.themoviedb.org/3/search/movie?${params}&api_key=${key}`);
    const hit = (data.results || []).find((result) => result.poster_path);
    return hit ? [`https://image.tmdb.org/t/p/w500${hit.poster_path}`] : [];
  } catch {
    return [];
  }
}

export async function resolveCover(rec) {
  const key = cacheKey(rec);
  const cached = readCache(key);
  if (cached !== undefined) return cached || null;

  let candidates = [];
  if (rec.mediaType === "book") {
    const [google, library] = await Promise.all([
      googleBookCandidates(rec.title, rec.source),
      openLibraryCandidates(rec.title, rec.source)
    ]);
    candidates = [...google, ...library];
  } else if (rec.mediaType === "movie") {
    candidates = await tmdbCandidates(rec.title);
  }

  const url = await firstLoadable(candidates);
  if (url) writeCache(key, url);
  return url;
}
