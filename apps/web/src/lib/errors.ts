import { AppError, type AppErrorCode } from "@/domain/adapter";

export interface ErrorCopy {
	title: string;
	body: string;
}

const COPY: Record<AppErrorCode, ErrorCopy> = {
	unauthenticated: { title: "Su sesión terminó", body: "Vuelva a ingresar con su cuenta de buzon-sol." },
	forbidden: { title: "No tiene permiso para esta acción", body: "Su rol no la incluye. Consulte con el administrador." },
	not_found: { title: "No se encontró el elemento", body: "Puede que ya no exista o que no tenga acceso. Vuelva al listado." },
	needs_credential: { title: "Esta cuenta no tiene credencial", body: "Un administrador debe agregar la Clave SOL para consultar SUNAT." },
	invalid_credential: { title: "Consulta en pausa", body: "SUNAT rechazó la credencial de esta cuenta y se avisó a los administradores. Puede ver el inventario guardado." },
	paused: { title: "Consulta en pausa", body: "Las acciones con SUNAT no están disponibles mientras la consulta esté en pausa." },
	remote_session_expired: { title: "La sesión con SUNAT venció", body: "Se intentará iniciar una sesión nueva. Su avance está guardado." },
	remote_unavailable: { title: "SUNAT no respondió", body: "Puede ser una interrupción temporal del servicio. Su avance está guardado." },
	schema_changed: { title: "SUNAT cambió la respuesta", body: "buzon-sol no reconoció el formato recibido. Se avisó a los administradores." },
	incomplete_inventory: { title: "Inventario parcial", body: "Los filtros solo incluyen lo ya inventariado." },
	conflict_running: { title: "Ya hay una consulta en curso", body: "Espere a que termine la consulta actual de esta cuenta." },
	validation: { title: "Revise los datos", body: "Algunos campos no son válidos." },
};

export const errorCopy = (error: unknown): ErrorCopy => {
	if (error instanceof AppError) return COPY[error.code];
	return { title: "Ocurrió un error inesperado", body: "Inténtelo de nuevo. Si continúa, avise al administrador." };
};

export const isAppError = (error: unknown, code?: AppErrorCode): error is AppError =>
	error instanceof AppError && (code === undefined || error.code === code);
