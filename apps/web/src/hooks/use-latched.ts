import { useState } from "react";

/**
 * Devuelve el último valor no nulo. Sirve para que un panel conserve título y contenido durante su animación
 * de salida, cuando el estado que lo abrió ya volvió a `null`.
 */
export const useLatched = <T>(value: T | null): T | null => {
	const [latched, setLatched] = useState(value);
	if (value !== null && value !== latched) setLatched(value);
	return value ?? latched;
};
