window.electronAPI.onLyricsUpdate((lyricsData) => {
  const lyricEl = document.getElementById("lyric");
  if (lyricsData?.lines && lyricsData.lines.length > 0) {
    const { lines, activeIndex } = lyricsData; // destructure
    if (activeIndex < 0) {
      lyricEl.textContent = "";
    } else {
      lyricEl.textContent = lines[activeIndex]?.text || "";
    }
  } else {
    lyricEl.textContent = "";
  }
});

window.electronAPI.onStatusUpdate((status_message) => {
  document.getElementById("status").textContent = status_message || "";
});
