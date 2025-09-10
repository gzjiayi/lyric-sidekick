const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const crypto = require("crypto");
const { fetchLyrics, parseLRC } = require("./lyrics-api.cjs");

const fetch =
  global.fetch ||
  ((...a) => import("node-fetch").then(({ default: f }) => f(...a)));

const BACKEND = "http://127.0.0.1:8888";
const CLIENT_ID = "787d1aaa5ee34bbfa8631bab9355aa2a";
const REDIRECT_URI = `${BACKEND}/callback`;
const SCOPE =
  "user-read-private user-read-email user-read-currently-playing user-read-playback-state";

let currentTrackId = null; // Spotify track's unique id of currently playing song
const lyricsCache = new Map(); // trackId -> [{ timeMs, text }]
const noLyricsCache = new Set(); // trackIds with no lyrics

// ---------- PKCE helpers ----------
// Creates a random string to be used as a code verifier
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (x) => chars[x % chars.length]).join("");
}

// Hash the code verifier using SHA-256 algorithm + base64 url encode
function sha256Base64Url(input) {
  const hash = crypto.createHash("sha256").update(input).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Poll /tokens endpoint until ready
async function pollTokens(maxTries = 60, intervalMs = 1000) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch(`${BACKEND}/tokens`);
      if (res.ok) return await res.json();
      if (res.status === 404) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      console.warn("pollTokens unexpected status", res.status);
      return null;
    } catch (err) {
      console.error("pollTokens error", err);
      return null;
    }
  }
  return null;
}

// Headless Spotify login trigger
async function startSpotifyLoginHeadless() {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = sha256Base64Url(codeVerifier);
  const state = generateRandomString(16);

  // store code _verifier and state on backend
  const res = await fetch(`${BACKEND}/store-code-verifier`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code_verifier: codeVerifier, state }),
  });
  if (!res.ok) throw new Error("Failed to store code_verifier");

  // build Spotify auth URL and open system browser
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    scope: SCOPE,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
    state,
  });
  await shell.openExternal(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );

  // wait for backend to have tokens
  return await pollTokens(60, 1000); // returns token object or null
}

// Loads the index.html web page into a BrowserWindow instance
let overlayWindow;
async function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 550,
    height: 70,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // load html
  await overlayWindow.loadFile(path.join(__dirname, "frontend", "index.html"));
  // win.webContents.openDevTools();

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.show();
  });

  // block in-app new windows; open external links in system browser
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// IPC bridge: renderer -> main to open system browser
ipcMain.on("open-external", (_event, url) => {
  try {
    new URL(url); // basic validation
    shell.openExternal(url); // opens default system browser
  } catch (e) {
    console.error("Invalid URL for open-external:", url);
  }
});

// Send an IPC message from main to renderer via the "lyrics:update" channel,
// passing { lines, activeIndex } as the payload
// overlayWindow?.webContents.send("lyrics:update", { lines, activeIndex });

/**
 * Ensures we have parsed lyrics ready for the given trackId
 * @param {string} trackId          Spotify's unique track id
 * @param {Object} meta             Metadata about the track
 * @param {string} meta.title       Track title
 * @param {string} meta.artists     Comma separated artist names
 * @param {string} [meta.album]     Album name (optional)
 * @param {number} meta.durationMs  Track duration in ms
 * @returns {Promise<void>}
 */
async function ensureLyrics(trackId, meta) {
  if (!trackId) return;

  // already have lyrics (or know it has none)
  if (lyricsCache.has(trackId) || noLyricsCache.has(trackId)) return;

  const syncedLyrics = await fetchLyrics(
    meta.title,
    meta.artists,
    meta.album,
    Math.round(meta.durationMs / 1000) // convert to sec for fetchLyrics
  );

  // if couldn't fetch lyrics, mark this track as having no lyrics
  // and send a status message to renderer to display on the overlay
  if (!syncedLyrics) {
    noLyricsCache.add(trackId);
    lyricsCache.set(trackId, [{ timeMs: 0, text: "" }]); // ensures UI clears
    overlayWindow?.webContents.send("status:update", "No synced lyrics");
    return;
  }

  // parse the lyric lines and store in our cache
  const parsedLyrics = parseLRC(syncedLyrics);
  lyricsCache.set(trackId, parsedLyrics);
  overlayWindow?.webContents.send("status:update", ""); // clear UI
}

/**
 * Gets the index of the lyric line that matches the current playback time.
 *
 * Returns -1 if no lyrics or if the progress is before the first lyric line
 * Otherwise, returns the last line whose timestamp <= progressMs
 *
 * @param {Array<{timeMs: number, text: string}>} lines   Parsed lyric lines
 * @param {number} progressMs                             Current playback pos in ms
 * @returns {number}                                      Active lyric index or -1 if nothing should be shown
 */
function getActiveIndex(lines, progressMs) {
  if (lines.length === 0) return -1; // no lyrics

  // if the progressMs is before the first lyric line, return -1 so it doesn't display
  // the first line too early
  if (progressMs < lines[0].timeMs) return -1;

  // find idx of the last lyric line whose timestamp <= progressMs
  let i = 0; // start at first lyric line
  // keep iterating until the next line is AFTER the current progressMs
  while (i + 1 < lines.length && lines[i + 1].timeMs <= progressMs) {
    i++;
  }
  return i;
}

// Keeps overlay synced to Spotify
async function startPlaybackLoop() {
  async function tick() {
    // 1. Check what's playing
    try {
      const res = await fetch(BACKEND + "/api/now-playing");
      if (res.status === 204 || res.status === 404) {
        overlayWindow?.webContents.send(
          "status:update",
          "Waiting for playback"
        );
        overlayWindow?.webContents.send("lyrics:update", {
          lines: [],
          activeIndex: -1,
        }); // send blank lyrics
        return;
      }

      if (res.status === 401) {
        // bad or expired token, ned to reauthenticate user
        overlayWindow?.webContents.send("status:update", "Reconnecting...");
        await startSpotifyLoginHeadless();
        return;
      }

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const item = data.item;
      const trackId = item?.id;
      if (!trackId) {
        // 200 OK but nothing playing yet
        overlayWindow?.webContents.send(
          "status:update",
          "Waiting for playback"
        );
        overlayWindow?.webContents.send("lyrics:update", {
          lines: [],
          activeIndex: -1,
        });
        return;
      }
      const progressMs = data.progress_ms ?? 0;
      const isPlaying = data.is_playing;
      const title = item?.name || "";
      const artists = (item?.artists || []).map((a) => a.name).join(", ");
      const album = item?.album?.name || "";
      const durationMs = item?.duration_ms || 0;

      // 2. Ensure lyrics are ready for current track
      if (trackId && trackId !== currentTrackId) {
        currentTrackId = trackId;
        overlayWindow?.webContents.send("status:update", "Fetching lyrics…");
        await ensureLyrics(trackId, { title, artists, album, durationMs });
      }

      // 3. Compute active lyric line
      const lines = lyricsCache.get(trackId) || [];
      const activeIndex = getActiveIndex(lines, progressMs);

      // 4. Push updates to the renderer
      overlayWindow?.webContents.send("lyrics:update", { lines, activeIndex });

      overlayWindow?.webContents.send(
        "status:update",
        isPlaying ? "" : "Paused"
      );
    } catch (err) {
      console.error("tick error", err);
    }
  }

  tick();
  setInterval(tick, 900); // repeat every 900ms
}

// App init
async function initApp() {
  // check tokens
  let haveTokens = false;
  try {
    const res = await fetch(`${BACKEND}/tokens`);
    haveTokens = res.ok;
  } catch {}

  // if don't have tokens, do headless login
  if (!haveTokens) {
    const tokens = await startSpotifyLoginHeadless();
    haveTokens = tokens ? true : false;
  }

  if (haveTokens) {
    await createOverlayWindow();
    startPlaybackLoop();
  } else {
    console.error("Authorization failed. No tokens. Exiting...");
    app.quit();
  }
}

app.whenReady().then(() => {
  initApp();

  // On macOS, recreate a window when the app is activated (e.x. clicking the dock icon)
  // and there are no other open windows
  // app.on("activate", () => {
  //   if (BrowserWindow.getAllWindows().length === 0) {
  //     createWindow();
  //   }
  // });
});

// Quit the application when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
