export async function fetchLyrics(track, artist, album, durationInSec) {
  try {
    // 1) Try get with all params
    const params = new URLSearchParams({
      track_name: track,
      artist_name: artist,
      album_name: album,
      duration: String(Math.round(durationInSec)),
    });
    let res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.ok) {
      // parse JSON response body into a JS object
      // .json() returns a Promise, so we await it
      const data = await res.json();
      return data.syncedLyrics || null;
    }

    // 2) Fallback: search with api/search
    const searchParams = new URLSearchParams({
      track_name: track,
      artist_name: artist,
    });
    const searchRes = await fetch(
      `https://lrclib.net/api/search?${searchParams}`
    );
    if (!searchRes.ok) return null;
    const resultsList = await searchRes.json();
    if (!Array.isArray(resultsList) || resultsList.length === 0) {
      return null;
    }

    // 3) Choose the best candidate: duration within 2s, and loose artist match
    const dur = Math.round(durationInSec);
    const norm = (s) => s?.toLowerCase().trim() || ""; // normalize string

    const candidate =
      resultsList.find((r) => {
        const within2s = Math.abs((r.duration ?? 0) - dur) <= 2;
        const artistLooseMatch =
          norm(r.artistName).includes(norm(artist)) ||
          norm(artist).includes(norm(r.artistName));
        return within2s && artistLooseMatch;
      }) || resultsList[0];
    if (!candidate?.id) return null;

    // 4) Fetch by absolute id we retrieved using search
    res = await fetch(`https://lrclib.net/api/get/${candidate.id}`);
    if (!res.ok) return null;

    const dataById = await res.json();
    return dataById.syncedLyrics || null;
  } catch (err) {
    console.error("Error fetching lyrics:", err);
    return null;
  }
}
export function parseLRC(lrcText) {
  // turn .lrc text into [{ time, text }]
}
