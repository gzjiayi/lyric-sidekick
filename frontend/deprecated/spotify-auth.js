import {
  generateRandomString,
  sha256,
  base64encode,
} from "./utils.js";

export async function startSpotifyLogin() {
  try {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed); // code_challenge is safe to send publicly
    const state = generateRandomString(16);

    // send code_verifier and state to backend
    const storeRes = await fetch("http://127.0.0.1:8888/store-code-verifier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code_verifier: codeVerifier, state }),
    });
    if (!storeRes.ok) throw new Error("Failed to store code_verifier");

    // build Spotify authorize URL
    const clientId = "787d1aaa5ee34bbfa8631bab9355aa2a";
    const redirectUri = "http://127.0.0.1:8888/callback";
    const scope =
      "user-read-private user-read-email user-read-currently-playing user-read-playback-state ";

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    // request user authorization query params
    // Spotify reads these params
    const params = {
      response_type: "code", // want an auth code
      client_id: clientId,
      scope,
      code_challenge_method: "S256",
      code_challenge: codeChallenge, // hashed version of the code verifier
      redirect_uri: redirectUri, // where spotify will send the user back
      state,
    };
    authUrl.search = new URLSearchParams(params).toString(); // append the parameters to the authURL

    // Open Spotify login on system browser:
    // - In Electron → use system browser via electronAPI.openExternal
    // - In normal web → fallback to redirecting current window
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(authUrl.toString());
    } else {
      window.location.href = authUrl.toString();
    }

    // wait until /tokens returns 200
    const tokens = await pollAuth(60, 1000); // 60 tries, 1s interval
    return tokens || null;
  } catch (err) {
    console.error("startSpotifyLogin failed:", err);
    return null;
  }
}

// Polls the backend /tokens endpoint until tokens are available
// Returns token object on success, or false if times out
export async function pollAuth(maxTries = 60, intervalMs = 1000) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch("http://127.0.0.1:8888/tokens");

      if (res.status === 200) {
        const tokens = await res.json();
        return tokens; // success!
      }

      if (res.status === 404) {
        // wait and retry
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      console.warn(`pollAuth: unexpected status ${res.status}`);
      return false;
    } catch (err) {
      console.error("pollAuth: fetch error", err);
      return false;
    }
  }
  return false; // give up after max tries
}

export async function initAuthFlow() {
  try {
    const res = await fetch("http://127.0.0.1:8888/tokens");
    if (res.ok) {
      const data = await res.json();
      return data; // tokens
    }

    if (res.status === 404) {
      // no tokens yet, trigger the OAuth and wait for tokens
      const tokens = await startSpotifyLogin(); // returns tokens or null
      return tokens;
    }

    console.warn("initAuthFlow: unexpected status", res.status);
    return null;
  } catch (err) {
    console.error("initAuthFlow failed:", err);
    return null;
  }
}
