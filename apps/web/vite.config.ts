import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	server: {
		port: 5173,
		strictPort: true,
		// Mismo origen que la app: el navegador no necesita CORS para hablar con la API.
		proxy: { "/api": process.env.BUZON_API_URL ?? "http://127.0.0.1:38080" },
	},
});
