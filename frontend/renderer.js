import { initAuthFlow } from "./modules/spotify-auth.js";
import { initLyricsDisplay } from "./modules/lyrics-display.js";

(async () => {
  const tokens = await initAuthFlow();
  if (tokens) {
    initLyricsDisplay();
  } else {
    console.warn("Not authenticated");
  }
})();
