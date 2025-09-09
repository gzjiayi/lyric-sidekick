const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const crypto = require("crypto");

const fetch =
  global.fetch ||
  ((...a) => import("node-fetch").then(({ default: f }) => f(...a)));

const BACKEND = "http://127.0.0.1:8888";
const CLIENT_ID = "787d1aaa5ee34bbfa8631bab9355aa2a";
const REDIRECT_URI = `${BACKEND}/callback`;
const SCOPE =
  "user-read-private user-read-email user-read-currently-playing user-read-playback-state";

// ---------- PKCE helpers ----------
// Creates a random string to be used as a code verifier
function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const crypto = require("crypto");
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (x) => chars[x % chars.length]).join("");
}

// Hash the code verifier using SHA-256 algorithm + base64 url encode
function sha256Base64Url(input) {
  const crypto = require("crypto");
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
overlayWindow.webContents.send("lyrics:update", { lines, activeIndex });
overlayWindow.webContents.send("overlay:status", "Fetching lyrics…");

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
