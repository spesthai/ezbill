import { registerSW } from "virtual:pwa-register";

export function registerPwa() {
  if (!import.meta.env.PROD) return;

  registerSW({
    onNeedRefresh() {
      // Keep this minimal for now. In a real app, show an AntD notification
      // prompting the user to refresh to get the new version.
      console.log("[pwa] new content available; refresh to update");
    },
    onOfflineReady() {
      console.log("[pwa] offline ready");
    }
  });
}

