const overlay = document.getElementById("overlay");
const lyricEl = document.getElementById("lyric");
const statusEl = document.getElementById("status");

// --------- Helpers ----------
// Update overlay visibility and text content based on lyric line
function updateLyric(text) {
  if (text && text.trim()) {
    overlay.style.display = "flex"; // show overlay
    lyricEl.textContent = text;
    statusEl.textContent = ""; // clear status when showing lyric
  } else {
    overlay.style.display = "none"; // hide overlay completely
    lyricEl.textContent = "";
    statusEl.textContent = "";
  }
}

// --------- IPC listeners ----------
// renderer <- main: update lyrics
window.electronAPI.onLyricsUpdate((lyricsData) => {
  if (lyricsData?.lines && lyricsData.lines.length > 0) {
    const { lines, activeIndex } = lyricsData;
    if (activeIndex < 0) {
      lyricEl.textContent = "";
    } else {
      lyricEl.textContent = lines[activeIndex]?.text || "";
    }
  } else {
    lyricEl.textContent = "";
  }
});

// renderer <- main: update status
window.electronAPI.onStatusUpdate((status_message) => {
  document.getElementById("status").textContent = status_message || "";
});

// Example hookup
window.electronAPI.onLyricsUpdate((lyricsData) => {
  const { lines, activeIndex } = lyricsData || {};
  const text = lines?.[activeIndex]?.text || "";
  updateLyric(text);
});

// Hide overlay on startup
window.addEventListener("load", () => updateLyric(""));

// Close button trigger overlay close in main
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("close-btn");
  if (btn)
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.electronAPI.closeOverlay();
    });
});
