import { useSyncExternalStore } from "react";

/** Preferencia de tema del visor. «system» sigue la configuración del sistema operativo. */
export type ThemePreference = "system" | "light" | "dark";

/** Misma clave que lee el script de `index.html` antes de pintar (evita el destello de tema claro). */
export const THEME_KEY = "buzon-sol:tema";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const CHANGE_EVENT = "buzon-sol:tema";

const isPreference = (value: unknown): value is ThemePreference => value === "system" || value === "light" || value === "dark";

/** Preferencia local del visor (no es estado de servidor ni se audita). */
export const readThemePreference = (): ThemePreference => {
	try {
		const value = window.localStorage.getItem(THEME_KEY);
		return isPreference(value) ? value : "system";
	} catch {
		return "system";
	}
};

const systemPrefersDark = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;

export const resolveTheme = (preference: ThemePreference): "light" | "dark" => (preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference);

/** Aplica el tema a <html>: clase `.dark` (convención de lizaui) y `color-scheme` para controles nativos. */
export const applyTheme = (preference: ThemePreference = readThemePreference()) => {
	const resolved = resolveTheme(preference);
	const root = document.documentElement;
	root.classList.toggle("dark", resolved === "dark");
	root.style.colorScheme = resolved;
};

export const setThemePreference = (preference: ThemePreference) => {
	try {
		if (preference === "system") window.localStorage.removeItem(THEME_KEY);
		else window.localStorage.setItem(THEME_KEY, preference);
	} catch {
		/* sin almacenamiento: el cambio vale solo para esta pestaña */
	}
	applyTheme(preference);
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: preference }));
};

/** Mantiene el tema al día si cambia la preferencia (esta u otra pestaña) o el sistema operativo. */
export const watchTheme = () => {
	const onChange = () => applyTheme();
	const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
	media?.addEventListener("change", onChange);
	const onStorage = (event: StorageEvent) => {
		if (event.key === THEME_KEY) {
			applyTheme();
			window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
		}
	};
	window.addEventListener("storage", onStorage);
	return () => {
		media?.removeEventListener("change", onChange);
		window.removeEventListener("storage", onStorage);
	};
};

const subscribe = (onChange: () => void) => {
	const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
	window.addEventListener(CHANGE_EVENT, onChange);
	media?.addEventListener("change", onChange);
	return () => {
		window.removeEventListener(CHANGE_EVENT, onChange);
		media?.removeEventListener("change", onChange);
	};
};

/** Preferencia elegida y tema resultante, para los controles de tema. */
export const useTheme = () => {
	const preference = useSyncExternalStore(subscribe, readThemePreference, () => "system" as const);
	const resolved = useSyncExternalStore(
		subscribe,
		() => resolveTheme(readThemePreference()),
		() => "light" as const,
	);
	return { preference, resolved, setPreference: setThemePreference };
};
