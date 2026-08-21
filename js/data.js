export const MEDIA_TYPES = ["book", "movie", "article", "podcast"];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRecommendation(raw) {
  const rec = {
    mediaType: clean(raw && raw.mediaType).toLowerCase(),
    title: clean(raw && raw.title),
    url: clean(raw && raw.url),
    blurb: clean(raw && raw.blurb),
    source: clean(raw && raw.source)
  };
  if (!MEDIA_TYPES.includes(rec.mediaType)) {
    throw new Error(`unknown media type "${raw.mediaType}"`);
  }
  if (!rec.title) {
    throw new Error("missing title");
  }
  return rec;
}

export async function loadRecommendations(url = "data/recommendations.json") {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      "Could not fetch recommendation data. If you opened this page directly from disk, serve the folder with a local web server instead."
    );
  }
  if (!response.ok) {
    throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${url} does not contain valid JSON.`);
  }
  if (!Array.isArray(payload)) {
    throw new Error(`Expected a JSON array in ${url}.`);
  }
  const valid = [];
  payload.forEach((raw, index) => {
    try {
      valid.push(normalizeRecommendation(raw));
    } catch (error) {
      console.warn(`Skipping recommendation ${index + 1}: ${error.message}`);
    }
  });
  return valid;
}
