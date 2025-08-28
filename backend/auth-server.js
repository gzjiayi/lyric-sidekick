const express = require("express");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const SPOTIFY_API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const REDIRECT_URI =
  process.env.REDIRECT_URI || "http://127.0.0.1:8888/callback";
const CLIENT_ID = process.env.CLIENT_ID;

const app = express();
const PORT = 8888;

app.use(cookieParser());
app.use(express.json());

const authStore = new Map(); // state -> { code_verifier, tokens: null | {access_token, ...} }

function getAccessTokenOrThrow() {
  const t = app.locals.tokens;
  if (!t?.access_token) {
    throw new Error("No access token. User must log in first.");
  }
  return t.access_token;
}

app.get("/", (req, res) => {
  res.send("Auth server running...");
});

// store code verifier with associated state
// this function runs when the Electron frontend sends a POST request to the route
app.post("/store-code-verifier", (req, res) => {
  const { state, code_verifier } = req.body;
  if (!state || !code_verifier) {
    return res.status(400).send("Missing state or code_verifier");
  }

  authStore.set(state, { code_verifier, tokens: null });
  res.sendStatus(200);
});

// runs when Spotify redirects back to our Express server using an HTTP GET after user logs in
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  // look up the original code_verifier
  const entry = authStore.get(state);
  const code_verifier = entry?.code_verifier;
  if (!code || !state || !code_verifier) {
    return res.status(400).send("Missing code, state, or code verifier");
  }

  // exchange the authorization code for an access token
  try {
    // exchange code for tokens
    // make a request to Spotify API, wait for response, and store it in tokenRes
    const tokenRes = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: code_verifier,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, token_type, scope, expires_in, refresh_token } =
      tokenRes.data;

    entry.tokens = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000 - 60_000,
      scope,
      token_type,
    };
    authStore.set(state, { tokens: entry.tokens });

    app.locals.tokens = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000 - 60_000,
      scope,
      token_type,
    };

    res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Success</title>
        </head>
        <body>
          <script>
            // Try to close the tab (may be blocked if not user-initiated)
            window.close();
            // Fallback: replace with about:blank so at least it's empty
            setTimeout(() => { window.location.replace('about:blank'); }, 500);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Token exchange failed");
  }
});

app.get("/tokens", (req, res) => {
  const tokens = app.locals.tokens;
  if (!tokens) {
    // send 404 not found error
    return res.status(404).json({ error: "Tokens not found" });
  }
  res.json(app.locals.tokens);
});

app.get("/auth-status", (req, res) => {
  const entry = authStore.get(req.query.state);
  res.json({ authenticated: !!(entry && entry.tokens) });
});

async function getCurrentlyPlaying() {
  try {
    const accessToken = getAccessTokenOrThrow();
    const response = await axios.get(
      `${SPOTIFY_API}/me/player/currently-playing`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 200) return response.data;
    if (response.status === 204) return null; // return null if nothing is playing
    return null; // edge case
  } catch (err) {
    console.error("Error: ", err.response?.status, err.message);
    return null;
  }
}

app.get("/api/now-playing", async (req, res) => {
  try {
    const data = await getCurrentlyPlaying();

    if (data) {
      return res.status(200).json(data);
    } else {
      // nothing playing
      return res.status(204).send();
    }
  } catch (err) {
    console.error("Route error:", err.message);
    const isAuth = err.message?.includes("No access token");
    return res
      .status(isAuth ? 401 : 500)
      .json({ error: isAuth ? "Not logged in" : "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server listening at http://127.0.0.1:${PORT}`);
});
