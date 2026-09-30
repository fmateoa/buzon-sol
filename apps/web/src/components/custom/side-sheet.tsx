import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "lizaui/drawer";
import { Form } from "formik";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

/** Ancho del panel en escritorio/tablet (tamaños de `Drawer`: sm 384 · md 448 · lg 512 · xl 640 px). */
export type SideSheetSize = "sm" | "md" | "lg" | "xl";

interface SideSheetProps {
	open: boolean;
	onClose: () => void;
	title: string;
	/** Subtítulo bajo el título, p. ej. el correo del usuario o el nombre de la cuenta. */
	description?: ReactNode;
	size?: SideSheetSize;
	/** Evita cerrar con Escape, clic fuera o arrastre mientras hay una operación en curso. */
	dismissDisabled?: boolean;
	/** Contenido: `SheetBody` + `SheetFooter`, o un `SheetForm` que los envuelva. */
	children: ReactNode;
}

const SheetContext = createContext(false);

/** `true` dentro de un `SideSheet`: los formularios reutilizables cambian a cuerpo con scroll y pie fijo. */
export const useInSheet = () => useContext(SheetContext);

/**
 * Panel lateral de gestión (diseño A2/A5): `Drawer` de lizaui flotante (`isFloating`) con fondo difuminado
 * (`backdrop="blur"`). En escritorio y tablet entra por la derecha; en móvil sube como hoja inferior (M2).
 *
 * lizaui deja inerte el resto de la página y apila Escape, pero no mueve el foco: se enfoca el panel al abrir
 * y se devuelve el foco al control que lo abrió al cerrar.
 */
export const SideSheet = ({ open, onClose, title, description, size = "md", dismissDisabled = false, children }: SideSheetProps) => {
	const isMobile = useIsMobile();
	const panelRef = useRef<HTMLDivElement>(null);
	const returnFocus = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;
		returnFocus.current = document.activeElement as HTMLElement | null;
		const timer = setTimeout(() => panelRef.current?.focus(), 30);
		return () => {
			clearTimeout(timer);
			returnFocus.current?.focus?.();
		};
	}, [open]);

	return (
		<Drawer
			isOpen={open}
			onClose={onClose}
			isFloating
			backdrop="blur"
			placement={isMobile ? "bottom" : "right"}
			size={isMobile ? "full" : size}
			isDismissable={!dismissDisabled}
			isKeyboardDismissDisabled={dismissDisabled}
			isDragDismissDisabled={dismissDisabled}
			closeButtonLabel="Cerrar panel"
			// En móvil la hoja se ajusta a su contenido (hasta casi toda la pantalla) y el cuerpo hace scroll.
			// Fondo `paper` (blanco en claro): las cajas `surface` del formulario se distinguen también en oscuro.
			classNames={{ base: cn("bg-paper", isMobile && "h-auto [&>div]:min-h-0") }}
		>
			<DrawerContent className="min-h-0">
				<div ref={panelRef} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
					<DrawerHeader className={cn("border-b border-line-soft px-6 py-5 pr-14", isMobile && "pt-7")}>
						<DrawerTitle className="text-xl font-bold tracking-tight text-ink">{title}</DrawerTitle>
						{description && <DrawerDescription className="text-sm text-muted-ink">{description}</DrawerDescription>}
					</DrawerHeader>
					<SheetContext.Provider value={true}>{children}</SheetContext.Provider>
				</div>
			</DrawerContent>
		</Drawer>
	);
};

/** Cuerpo del panel (con scroll). Fuera de un panel es una columna simple. */
export const SheetBody = ({ children, className }: { children: ReactNode; className?: string }) =>
	useInSheet() ? <DrawerBody className={cn("gap-5 px-6 py-5", className)}>{children}</DrawerBody> : <div className={cn("flex flex-col gap-5", className)}>{children}</div>;

/**
 * Pie de acciones. En un panel queda fijo abajo con borde superior; fuera de él, al final del formulario.
 * `start` va a la izquierda (p. ej. «Desactivar cuenta» en A2).
 */
export const SheetFooter = ({ children, start, className }: { children: ReactNode; start?: ReactNode; className?: string }) => {
	const inSheet = useInSheet();
	const content = (
		<>
			{start && <div className="flex flex-wrap items-center gap-2 sm:mr-auto">{start}</div>}
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
		</>
	);
	return inSheet ? (
		<DrawerFooter className={cn("mt-0 flex flex-col-reverse gap-3 border-t border-line-soft px-6 py-4 sm:flex-row sm:items-center sm:justify-end", className)}>{content}</DrawerFooter>
	) : (
		<div className={cn("flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-end", className)}>{content}</div>
	);
};

/** `Form` de Formik que, dentro de un panel, envuelve cuerpo y pie para que el botón de envío siga dentro del formulario. */
export const SheetForm = ({ children, className }: { children: ReactNode; className?: string }) => (
	<Form noValidate className={cn(useInSheet() ? "flex min-h-0 flex-1 flex-col" : "flex flex-col gap-5", className)}>
		{children}
	</Form>
);
