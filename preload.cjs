const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // renderer -> main communication
  openExternal: (url) => ipcRenderer.send("open-external", url),

  // main → renderer communication
  // Defining a function the renderer can call: window.electronAPI.onLyricsUpdate(callback)
  // When the renderer calls it, it starts listening on the "lyrics:update" channel
  // Whenever main sends data on that channel, the renderers callback will execute with the payload
  onLyricsUpdate: (callback) =>
    ipcRenderer.on("lyrics:update", (_event, payload) => callback(payload)),

  // main → renderer communication
  onStatus: (callback) => {
    ipcRenderer.on("overlay:status", (_event, status_message) =>
      callback(status_message)
    );
  },
});
