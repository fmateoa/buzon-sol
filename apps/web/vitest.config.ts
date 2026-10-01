import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			// Las pruebas usan el adaptador local, sin importar lo que diga `.env`.
			env: { VITE_DATA_SOURCE: "local" },
			environment: "jsdom",
			setupFiles: ["./src/test/setup.ts"],
			css: false,
			restoreMocks: true,
		},
	}),
);
