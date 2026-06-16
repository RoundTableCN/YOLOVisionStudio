import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  backendURL: "http://127.0.0.1:8618",
});
