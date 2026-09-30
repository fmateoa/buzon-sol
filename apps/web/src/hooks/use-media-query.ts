import { useSyncExternalStore } from "react";

export const useMediaQuery = (query: string): boolean =>
	useSyncExternalStore(
		(onChange) => {
			if (typeof window === "undefined" || !window.matchMedia) return () => {};
			const media = window.matchMedia(query);
			media.addEventListener("change", onChange);
			return () => media.removeEventListener("change", onChange);
		},
		() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
		() => false,
	);

/** Breakpoints del diseño: móvil < 768, tablet 768–1023, escritorio ≥ 1024. */
export const useIsMobile = () => !useMediaQuery("(min-width: 768px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
