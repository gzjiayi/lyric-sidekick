const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // main → renderer communication
  // Defining a function the renderer can call: window.electronAPI.onLyricsUpdate(callback)
  // When the renderer calls it, it starts listening on the "lyrics:update" channel
  // Whenever main sends data on that channel, the renderers callback will execute with the payload
  onLyricsUpdate: (callback) =>
    ipcRenderer.on("lyrics:update", (_event, payload) => callback(payload)),

  // main → renderer communication
  onStatusUpdate: (callback) => {
    ipcRenderer.on("status:update", (_event, status_message) =>
      callback(status_message)
    );
  },

  // renderer -> main communication
  // when closeOverlay is invoked by renderer, an ipc msg will be sent to main on the "overlay:close" channel
  closeOverlay: () => ipcRenderer.send("overlay:close"),
});
