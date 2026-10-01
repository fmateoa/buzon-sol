import type { ComponentProps } from "react";
import { TabsList, TabsTrigger } from "lizaui/ui";
import { cn } from "@/lib/cn";

/**
 * Pestañas subrayadas del diseño (A3): `TabsList`/`TabsTrigger` de lizaui (Radix) con otro aspecto.
 * lizaui solo trae la variante de píldora; aquí se reemplazan fondo, borde y sombra por una línea de 3 px.
 */
export const UnderlineTabsList = ({ className, ...props }: ComponentProps<typeof TabsList>) => (
	<TabsList className={cn("h-auto w-auto justify-start gap-6 rounded-none bg-transparent p-0", className)} {...props} />
);

/**
 * La pestaña activa va en negrita, que es más ancha: una copia invisible en negrita fija el ancho
 * de cada pestaña para que al cambiar de una a otra las demás no se muevan.
 */
export const UnderlineTabsTrigger = ({ className, children, ...props }: ComponentProps<typeof TabsTrigger>) => (
	<TabsTrigger
		className={cn(
			"h-auto flex-none rounded-none border-0 border-b-3 border-transparent px-0 pt-1 pb-2 text-[15px] font-normal text-muted-ink shadow-none hover:text-ink",
			"data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:text-ink data-[state=active]:shadow-none",
			// lizaui agrega fondo y borde propios en oscuro: se anulan para mantener solo la línea.
			"dark:text-muted-ink dark:data-[state=active]:border-brand dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-ink",
			className,
		)}
		{...props}
	>
		<span className="inline-grid">
			<span className="col-start-1 row-start-1">{children}</span>
			<span aria-hidden="true" className="invisible col-start-1 row-start-1 font-bold">
				{children}
			</span>
		</span>
	</TabsTrigger>
);
