#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const FIELD_ALIASES = {
  mediaType: ["mediatype", "type", "media", "category", "format"],
  title: ["title", "name", "recommendation", "item", "what"],
  url: ["link", "url", "linkurl", "website", "hyperlink", "href", "sourceurl"],
  blurb: ["blurb", "description", "why", "notes", "note", "comments", "comment", "reason", "summary"],
  source: [
    "creatorsource",
    "creator",
    "source",
    "author",
    "publication",
    "podcast",
    "podcastname",
    "director",
    "publisher",
    "outlet",
    "show",
    "by"
  ]
};

const MEDIA_TYPE_SYNONYMS = {
  book: "book",
  books: "book",
  article: "article",
  articles: "article",
  essay: "article",
  essays: "article",
  blog: "article",
  blogpost: "article",
  web: "article",
  movie: "movie",
  movies: "movie",
  film: "movie",
  films: "movie",
  documentary: "movie",
  podcast: "podcast",
  podcasts: "podcast",
  episode: "podcast",
  episodes: "podcast",
  audio: "podcast"
};

const USAGE = `Usage: node scripts/import-recommendations.js <responses.csv> [-o data/recommendations.json]

Converts a Microsoft Forms / Excel CSV export into the JSON file the site loads.

Options:
  -o, --out <path>   Output JSON path (default: data/recommendations.json)
  -h, --help         Show this help`;

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === "\r") {
        if (text[i + 1] === "\n") i++;
        field += " ";
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      continue;
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function buildFieldIndexes(headers) {
  const indexes = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = headers.findIndex((header) => aliases.includes(header));
    if (index !== -1) indexes[field] = index;
  }
  return indexes;
}

function normalizeMediaType(value) {
  return MEDIA_TYPE_SYNONYMS[normalizeHeader(value)] || null;
}

function printUsage() {
  console.log(USAGE);
}

function main() {
  const args = process.argv.slice(2);
  let input = null;
  let output = "data/recommendations.json";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--out") {
      output = args[++i];
      if (!output) {
        console.error("Error: --out requires a path.");
        process.exit(1);
      }
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else if (input === null) {
      input = arg;
    } else {
      console.error(`Error: unexpected argument "${arg}".`);
      printUsage();
      process.exit(1);
    }
  }

  if (!input) {
    printUsage();
    console.error("\nError: an input CSV path is required.");
    process.exit(1);
  }

  let csv;
  try {
    csv = readFileSync(input, "utf8");
  } catch (error) {
    console.error(`Could not read ${input}: ${error.message}`);
    process.exit(1);
  }
  csv = csv.replace(/^\uFEFF/, "");

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    console.error("The CSV appears to contain no data rows.");
    process.exit(1);
  }

  const headers = rows[0].map(normalizeHeader);
  const indexes = buildFieldIndexes(headers);

  if (indexes.mediaType === undefined || indexes.title === undefined) {
    console.error(
      `Could not find required columns ("media type" and "title").\nFound headers: ${rows[0].join(", ")}`
    );
    process.exit(1);
  }

  const seen = new Set();
  const records = [];
  const warnings = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    const get = (field) => (indexes[field] === undefined ? "" : String(row[indexes[field]] ?? "").trim());

    const mediaType = normalizeMediaType(get("mediaType"));
    const title = get("title");

    if (!mediaType && !title) return;

    if (!mediaType) {
      warnings.push(
        `Row ${excelRow}: unrecognized media type "${get("mediaType")}" (use book, movie, article, or podcast). Skipped.`
      );
      return;
    }
    if (!title) {
      warnings.push(`Row ${excelRow}: missing title. Skipped.`);
      return;
    }

    const url = get("url");
    if (url && !/^https?:\/\//i.test(url)) {
      warnings.push(`Row ${excelRow}: "${url}" does not look like a URL; imported as-is.`);
    }

    const dedupeKey = `${mediaType}|${title.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      warnings.push(`Row ${excelRow}: duplicate "${title}" (${mediaType}). Skipped.`);
      return;
    }
    seen.add(dedupeKey);

    records.push({
      mediaType,
      title,
      url,
      blurb: get("blurb"),
      source: get("source")
    });
  });

  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) console.error(`  - ${warning}`);
  }

  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(records, null, 2)}\n`);
  console.log(`Imported ${records.length} recommendation${records.length === 1 ? "" : "s"} -> ${output}`);
}

main();
