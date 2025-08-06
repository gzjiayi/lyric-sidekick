const express = require("express");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = 8888;

app.use(cookieParser());
app.use(express.json());

const verifierStore = {}; // maps state to code_verifier

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

  verifierStore[state] = code_verifier;
  res.sendStatus(200);
});

// runs when Spotify redirects back to our Express server after user logs in
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  // look up the original code_verifier
  const code_verifier = verifierStore[state];
  if (!code || !state || !code_verifier) {
    return res.status(400).send("Missing code, state, or code verifier");
  }

  delete verifierStore[state]; // clean up after use

  // exchange the authorization code for an access token
  try {
    // make a request to Spotify API, wait for response, and store it in tokenRes
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: "http://127.0.0.1:8888/callback",
        client_id: process.env.CLIENT_ID,
        code_verifier: code_verifier,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = tokenRes.data;
    res.redirect(`http://localhost:3000?access_token=${access_token}`);
  } catch (err) {
    console.error("Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Token exchange failed");
  }
});

app.listen(PORT, () => {
  console.log(`Auth server listening at http://127.0.0.1:${PORT}`);
});
