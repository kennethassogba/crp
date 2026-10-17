import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [
    react(),
    cloudflare({ experimental: { newConfig: true }, inspectorPort: false }),
  ],
  server: { port: 5185, strictPort: true },
});
