export async function getNowPlaying() {
  try {
    const res = await fetch("http://127.0.0.1:8888/api/now-playing");
    if (!res.ok) {
      throw new Error(`res status: ${res.status}`);
    }

    // Nothing playing
    if (res.status === 204) return null;

    // parse the json
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch now playing:", err);
    return null;
  }
}
