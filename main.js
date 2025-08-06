const { app, BrowserWindow } = require("electron");

// Loads the index.html web page into a BrowserWindow instance
const createWindow = () => {
  const win = new BrowserWindow({
    width: 600,
    height: 100,
  });

  win.loadFile("index.html");
  win.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  // On macOS, recreate a window when the app is activated (e.x. clicking the dock icon)
  // and there are no other open windows
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit the application when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
