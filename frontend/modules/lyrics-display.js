const songTitleEl = document.getElementById("song-info");
const lyricsEl = document.getElementById("lyrics");

export function initLyricsDisplay() {
  songTitleEl.innerText = "Now playing: Sample Song 🎵";

  const fakeLyrics = [
    "We're no strangers to love",
    "You know the rules and so do I",
    "A full commitment's what I'm thinking of",
    "You wouldn't get this from any other guy",
  ];

  let index = 0;
  setInterval(() => {
    lyricsEl.textContent = fakeLyrics[index];
    index = (index + 1) % fakeLyrics.length;
  }, 3000);
}
