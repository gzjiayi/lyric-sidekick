window.electronAPI.onLyricsUpdate((lyricsData) => {
  const lyricEl = document.getElementById("lyric");
  if (lyricsData?.lines && lyricsData.lines.length > 0) {
    const { lines, activeIndex } = lyricsData; // destructure
    lyricEl.textContent = lines[activeIndex]?.text || "";
  } else {
    lyricEl.textContent = "";
  }
});

window.electronAPI.onStatus((status_message) => {
  document.getElementById("status").textContent = status_message || "";
});
