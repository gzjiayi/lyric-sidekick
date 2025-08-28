import { startSpotifyLogin } from "./modules/spotify-auth.js";
import { initLyricsDisplay } from "./modules/lyrics-display.js";

document
  .getElementById("login-btn")
  ?.addEventListener("click", startSpotifyLogin);

initLyricsDisplay();
