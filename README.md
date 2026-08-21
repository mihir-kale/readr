# Reading & Watching — John Locke Foundation (POC)

A static, editorial-style site that displays staff media recommendations (books, films, articles, podcasts). Built with plain HTML/CSS/JavaScript — no build step, no dependencies.

```text
Microsoft Forms → Excel / SharePoint → CSV → scripts/import-recommendations.js
    → data/recommendations.json → static site → GitHub Pages
```

## Quick start

`fetch()` cannot read local files from `file://`, so serve the folder over HTTP:

```sh
python3 -m http.server 8000        # or: npx serve .
```

Then open <http://localhost:8000>.

## Project structure

```text
/
├── index.html                      Page shell (masthead, filters, grid, colophon)
├── styles.css                      Editorial theme (cream paper, serif type, masonry grid)
├── js/
│   ├── app.js                      Rendering, filtering, cover hydration
│   ├── data.js                     Data layer — loads + validates recommendations JSON
│   └── covers.js                   Book-cover / movie-poster lookup with caching + fallbacks
├── data/
│   └── recommendations.json        The single data source the frontend reads
├── scripts/
│   └── import-recommendations.js   CSV → JSON importer for Microsoft Forms exports
└── README.md
```

## Editing recommendations

Edit `data/recommendations.json` directly. Each entry:

| Field       | Required | Notes                                                        |
| ----------- | -------- | ------------------------------------------------------------ |
| `mediaType` | yes      | `book`, `movie`, `article`, or `podcast`                     |
| `title`     | yes      | Book/film/episode/article title                              |
| `url`       | no       | Absolute URL opened in a new tab when clicked                |
| `blurb`     | no       | Staff-written hook                                           |
| `source`    | no       | Author, publication, podcast name, or director               |

Display behavior by type:

- **Books** — cover fetched client-side: Google Books first, Open Library as fallback.
- **Movies** — poster via TMDB if an API key is configured (see below), otherwise a typographic placeholder.
- **Articles / Podcasts** — text-only entries; the title links to the submitted URL.

If a cover can't be found or a URL is missing/invalid, the entry degrades gracefully (placeholder art, plain-text title).

## Importing from Microsoft Forms

1. In Microsoft Forms: **Responses → Open in Excel** (or download the CSV).
2. In Excel: **File → Save As → CSV UTF-8**.
3. Run the importer:

```sh
node scripts/import-recommendations.js ~/Downloads/responses.csv
node scripts/import-recommendations.js responses.csv -o data/recommendations.json
npm run import -- responses.csv          # equivalent via npm
```

The importer recognizes flexible column headers — any of these aliases work:

| Field       | Accepted headers                                                        |
| ----------- | ----------------------------------------------------------------------- |
| Media type  | `Media type`, `Type`, `Category`, `Format`                               |
| Title       | `Title`, `Name`, `Recommendation`                                        |
| Link        | `Link`, `Link (URL)`, `URL`, `Website`                                   |
| Blurb       | `Blurb`, `Description`, `Why`, `Notes`, `Comments`                       |
| Creator     | `Creator/Source`, `Author`, `Publication`, `Podcast`, `Director`, `Show` |

Behavior: normalizes media types (`Books` → `book`, `Film` → `movie`, …), skips duplicate and unrecognized rows with warnings, preserves submission order, and **overwrites** the output file. Commit the generated JSON rather than the CSV.

## Movie posters (optional TMDB key)

Book covers need no key. For movie posters, get a free TMDB API key (<https://www.themoviedb.org/settings/api> — copy the *API Key (v3)*), then either:

- paste it into `<meta name="tmdb-api-key" content="">` in `index.html`, or
- run `localStorage.setItem('tmdbApiKey', '…')` once in your browser's DevTools.

Without a key, movies render with an intentional typographic placeholder — the site still works.

## Deploying to GitHub Pages

1. Create a GitHub repository and push these files to the `main` branch.
2. Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, Folder: `/ (root)` → **Save**.
3. The site goes live at `https://<username>.github.io/<repo>/` within a couple of minutes.

All asset and data paths are relative, so subpath hosting works unchanged. Updating the site (including new recommendation data) is just another push.

## Swapping in real data later

The frontend only knows about `loadRecommendations()` in `js/data.js`, which fetches `data/recommendations.json`. Any process that writes that same JSON shape — a scheduled export, Microsoft Graph automation, etc. — replaces the mock data with zero frontend changes.

## Notes

- Typeface: [Newsreader](https://fonts.google.com/specimen/Newsreader) via Google Fonts; everything else uses system fonts.
- Google Books, Open Library, and TMDB all allow browser-side requests (CORS enabled); covers are resolved at runtime and cached per session.
