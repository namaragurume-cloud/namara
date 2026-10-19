import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base: "./" で相対パスにして、どこに置いても（LIFF のエンドポイント・静的ホスティング）動くようにする
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
