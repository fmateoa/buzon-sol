import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
	cleanup();
	window.localStorage.clear();
	window.sessionStorage.clear();
});

// Ancho de escritorio por defecto (1280 px); las pruebas móviles lo cambian.
Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });

// matchMedia mínimo: evalúa (min-width: Npx) / (max-width: Npx) contra innerWidth. Cualquier otra
// consulta (p. ej. prefers-color-scheme: dark) no coincide: el «sistema» de las pruebas usa tema claro.
window.matchMedia = (query: string) => {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = Boolean(min || max) && (!min || window.innerWidth >= Number(min[1])) && (!max || window.innerWidth <= Number(max[1]));
	return {
		matches,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	} as MediaQueryList;
};

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// Radix usa APIs de puntero y scroll que jsdom no implementa.
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.setPointerCapture ??= () => {};
window.scrollTo = () => {};
