const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

// Loads the index.html web page into a BrowserWindow instance
const createWindow = () => {
  const win = new BrowserWindow({
    width: 600,
    height: 100,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadFile(path.join(__dirname, "frontend", "index.html"));
  win.webContents.openDevTools();

  // Block in-app new windows; open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

// IPC bridge: renderer -> main to open system browser
ipcMain.on("open-external", (_event, url) => {
  try {
    new URL(url); // basic validation
    shell.openExternal(url); // opens default system browser
  } catch (e) {
    console.error("Invalid URL for open-external:", url);
  }
});

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
