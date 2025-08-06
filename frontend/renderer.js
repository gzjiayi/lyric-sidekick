const songTitleEl = document.getElementById("song-info");
const lyricsEl = document.getElementById("lyrics");

songTitleEl.innerText = "Now playing: Sample Song 🎵";
lyricsEl.innerText = "Line 1 of the lyrics";

const fakeLyrics = [
  "We're no strangers to love",
  "You know the rules and so do I",
  "A full commitment's what I'm thinking of",
  "You wouldn't get this from any other guy",
];

let index = 0;

setInterval(() => {
  lyricsEl.textContent = fakeLyrics[index];
  index = (index + 1) % fakeLyrics.length; // update index to loop through lyrics
}, 3000); // change lyric every 3 seconds

// Creates a random string to be used as a code verifier for OAuth 2.0 PKCE
const generateRandomString = (length) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

// Hash the code verifier using SHA-256 algorithm
const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
};

// Base64 URL encode the hashed code verifier
const base64encode = (input) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

async () => {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);
  const state = generateRandomString(16);

  // send code_verifier and state to backend
  await fetch("http://localhost:8888/store-code-verifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code_verifier: codeVerifier, state }),
  });

  const clientId = "787d1aaa5ee34bbfa8631bab9355aa2a";
  const redirectUri = "http://127.0.0.1:8888/callback";
  const scope = "user-read-private user-read-email";
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  const params = {
    response_type: "code",
    client_id: clientId,
    scope,
    code_challenge_method: "S256",
    code_challenge: codeChallenge, // hashed version of the code verifier
    redirect_uri: redirectUri,
  };

  authUrl.search = new URLSearchParams(params).toString(); // append the parameters to the authURL
  window.location.href = authUrl.toString(); // redirecting the user to the Spotify login page
};
