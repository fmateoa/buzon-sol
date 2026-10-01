/**
 * Puertas de validación con SUNAT (backend/spec.md §6, plan/02-sunat-integration.md).
 * Mientras una puerta no se supere, la interfaz NO afirma la capacidad asociada.
 * Cambiar estos valores exige evidencia incorporada al contrato SUNAT.
 */
export const SUNAT_GATES = {
	/** G-02: el inicio de sesión no abre automáticamente el primer elemento. */
	passiveLogin: false,
	/** G-03: comportamiento confirmado al leer una Notificación no leída. */
	notificationReadVerified: false,
} as const;

export const INVENTORY_EFFECT_LABEL = SUNAT_GATES.passiveLogin ? "Sin efecto en SUNAT" : "El barrido no abre contenido";

export const INVENTORY_LOGIN_NOTE = SUNAT_GATES.passiveLogin
	? null
	: "Al iniciar sesión, SUNAT podría abrir automáticamente el primer elemento. Si ocurre, queda registrado en la actividad de la cuenta.";
