/**
 * Fetches synced lyrics (LRC format text) from LRCLib for a given track
 *
 * @param {string} track          Track title
 * @param {string} artist         Comma separated artist names
 * @param {string} [album]        Album name (optional)
 * @param {number} durationInSec  Track duration in seconds
 *
 * @returns {Promise<string|null>} Raw LRC text if successfully found, otherwise null
 */

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

/**
 * Parses raw LRC (timestamped lyric) text into an array of timestamped lines
 *
 * @param {string} lrcText  Raw LRC text
 *
 * @returns {Array<{ timeMs: number, text: string }>}
 *   Outputs an array of lyric line objects:
 *     - timeMs: absolute time in milliseconds from the start of the track
 *     - text:   lyric line text at that timestamp
 */
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== "string") return [];

  // split into lines
  const lines = lrcText.split(/\r?\n/);
  const metaLineRegex = /^\s*\[(ti|ar|al|by|offset):/i;
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]/g;
  const out = [];

  for (const line of lines) {
    // skip metadata
    if (metaLineRegex.test(line)) continue;

    // get all the timestamps on this line
    const timestamps = [...line.matchAll(timestampRegex)];
    if (timestamps.length === 0) continue;

    // extract the lyric text
    const text = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!text) continue;

    // convert timestamps into time
    for (const m of timestamps) {
      // each const m is an array of matches
      // m[0] = full timestamp match e.x. "[01:20.73]"
      // m[1] = minutes, m[2] = seconds, m[3] = fractional part (or undefined)

      const mm = parseInt(m[1], 10) || 0; // convert minutes to integer
      const ss = parseInt(m[2], 10) || 0; // convert seconds to integer
      const frac = m[3] ? Number(`0.${m[3]}`) : 0; // turn it into decimal
      const timeMs = mm * 60_000 + ss * 1000 + Math.round(frac * 1000); // convert total to ms

      if (Number.isFinite(timeMs)) out.push({ timeMs, text }); // push to output array
    }
  }

  // Sort by time ascending
  // if a.time < b.time -> result is negative -> a comes before b
  // if a.time > b.time -> result is positive -> b comes before a
  // if equal, result is 0 -> keep original order
  out.sort((a, b) => a.timeMs - b.timeMs);
  return out;
}

module.exports = { fetchLyrics, parseLRC };
