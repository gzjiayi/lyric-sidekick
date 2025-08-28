import { generateRandomString, sha256, base64encode } from "./utils.js";

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
    const scope = "user-read-private user-read-email user-read-playback-state";

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

    // Open Spotify login:
    // - In Electron → use system browser via electronAPI.openExternal
    // - In normal web → fallback to redirecting current window
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(authUrl.toString());
    } else {
      window.location.href = authUrl.toString();
    }

    const ok = await pollAuth(state);
    if (ok) {
      console.log("User successfully authenticated!");
    } else {
      console.warn("Login timed out.");
    }
  } catch (err) {
    console.error("Login failed:", err);
  }
}

export async function pollAuth(state) {
  const url = `http://127.0.0.1:8888/auth-status?state=${encodeURIComponent(
    state
  )}`;
  for (let i = 0; i < 60; i++) {
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text();
      console.warn(`auth-status ${r.status}: ${txt.slice(0, 200)}`);
      await new Promise((res) => setTimeout(res, 1000));
      continue;
    }
    const { authenticated } = await r.json();
    if (authenticated) return true;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return false;
}
