import { useEffect, useId, useRef, type ReactNode } from "react";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "lizaui/modal";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "lizaui/drawer";
import { useIsMobile } from "@/hooks/use-media-query";

interface ResponsiveDialogProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
	/** Evita cerrar con Escape/clic fuera mientras hay una operación en curso. */
	dismissDisabled?: boolean;
	/** En móvil se presenta como hoja inferior (diseño M2). */
	sheetOnMobile?: boolean;
}

/**
 * Diálogo basado en lizaui: `Modal` en escritorio/tablet y `Drawer` inferior en móvil.
 * `Modal` no mueve el foco por sí mismo: se enfoca el cuerpo al abrir y se devuelve el
 * foco al elemento que lo abrió al cerrar.
 */
export const ResponsiveDialog = ({ open, onClose, title, children, footer, size = "md", dismissDisabled = false, sheetOnMobile = true }: ResponsiveDialogProps) => {
	const isMobile = useIsMobile();
	const bodyRef = useRef<HTMLDivElement>(null);
	const returnFocus = useRef<HTMLElement | null>(null);
	const id = useId();
	const close = () => {
		if (!dismissDisabled) onClose();
	};

	useEffect(() => {
		if (!open) return;
		returnFocus.current = document.activeElement as HTMLElement | null;
		const timer = setTimeout(() => bodyRef.current?.focus(), 30);
		return () => {
			clearTimeout(timer);
			returnFocus.current?.focus?.();
		};
	}, [open]);

	if (isMobile && sheetOnMobile) {
		return (
			<Drawer isOpen={open} onClose={close} placement="bottom" size="lg" isDismissable={!dismissDisabled} isKeyboardDismissDisabled={dismissDisabled} closeButtonLabel="Cerrar">
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle className="pr-8 text-lg font-semibold text-ink">{title}</DrawerTitle>
					</DrawerHeader>
					<DrawerBody>
						<div ref={bodyRef} tabIndex={-1} className="outline-none">
							{children}
						</div>
					</DrawerBody>
					{footer && <DrawerFooter className="flex flex-col-reverse gap-2">{footer}</DrawerFooter>}
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Modal modalId={id} isShow={open} isVisible={open} onClickOutside={close} isKeyboardDismissDisabled={dismissDisabled} size={size} placement="center">
			<ModalHeader title={title} onClick={close} disabled={dismissDisabled} className="pr-14 text-ink" />
			{open && (
				<ModalBody>
					<div ref={bodyRef} tabIndex={-1} className="pb-2 outline-none">
						{children}
					</div>
				</ModalBody>
			)}
			{footer && <ModalFooter className="flex flex-wrap justify-end gap-2">{footer}</ModalFooter>}
		</Modal>
	);
};
