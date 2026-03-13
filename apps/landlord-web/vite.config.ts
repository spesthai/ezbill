import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "pwa-icon.svg"],
      manifest: {
        name: "EZBill Landlord",
        short_name: "EZBill",
        description: "Landlord management console for EZBill.",
        theme_color: "#0b3d91",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml" }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,ico,png,txt,woff2}"]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    sourcemap: true
  }
});

