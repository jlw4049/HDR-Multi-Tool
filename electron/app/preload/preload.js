const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  currentPlatform: () => process.platform,
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, func) =>
      ipcRenderer.on(channel, (event, ...args) => func(...args)),
    once: (channel, func) =>
      ipcRenderer.once(channel, (event, ...args) => func(...args)),
    invoke: (...args) => ipcRenderer.invoke(...args),
  },
});
