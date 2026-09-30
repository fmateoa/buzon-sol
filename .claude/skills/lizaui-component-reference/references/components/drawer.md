# Drawer

- tipo: componente
- import recomendado: `lizaui/drawer`
- export principal sugerido: `Drawer`

## Resumen

Esta referencia documenta la superficie pública de `drawer` a partir del código fuente real de `lizaui`.

## Exportaciones públicas

- `Drawer`
- `DrawerBody`
- `DrawerBodyType`
- `DrawerContent`
- `DrawerContentType`
- `DrawerFooter`
- `DrawerFooterType`
- `DrawerHeader`
- `DrawerHeaderType`
- `DrawerMotionProps`
- `DrawerType`
- `PlacementDrawerType`
- `SizeDrawerInterface`

## Props y tipos clave

### `SizeDrawerInterface`

- firma: `export type SizeDrawerInterface = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";`
- hereda o referencia: `"xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `PlacementDrawerType`

- firma: `export type PlacementDrawerType = "left" | "right" | "top" | "bottom";`
- hereda o referencia: `"left" | "right" | "top" | "bottom"`
- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.

### `DrawerMotionProps`

- firma: `export interface DrawerMotionProps { variants?: Variants; initial?: string; animate?: string; exit?: string; transition?: any; }`
- propiedades detectadas:
  - `variants?`: `Variants`
  - `initial?`: `string`
  - `animate?`: `string`
  - `exit?`: `string`
  - `transition?`: `any`

### `DrawerType`

- firma: `export interface DrawerType { drawerId?: string; children: ReactNode; isOpen: boolean; defaultOpen?: boolean; size?: SizeDrawerInterface; radius?: "none" | "sm" | "md" | "lg"; placement?: PlacementDrawerType; isDismissable?: boolean; isKeyboardDismissDisabled?: boolean; shouldBlockScroll?: boolean; hideCloseButton?: boolean; closeButton?: ReactNode; backdrop?: "transparent" | "opaque" | "blur"; motionProps?: DrawerMotionProps; portalContainer?: HTMLElement; disableAnimation?: boolean; classNames?: Partial<{ wrapper: string; base: string; backdrop: string; header: string; body: string; footer: string; closeButton: string; }>; style?: CSSProperties; onOpenChange?: (isOpen: boolean) => void; onClose?: () => void; }`
- propiedades detectadas:
  - `drawerId?`: `string`
  - `children`: `ReactNode`
  - `isOpen`: `boolean`
  - `defaultOpen?`: `boolean`
  - `size?`: `SizeDrawerInterface`
  - `radius?`: `"none" | "sm" | "md" | "lg"`
  - `placement?`: `PlacementDrawerType`
  - `isDismissable?`: `boolean`
  - `isKeyboardDismissDisabled?`: `boolean`
  - `shouldBlockScroll?`: `boolean`
  - `hideCloseButton?`: `boolean`
  - `closeButton?`: `ReactNode`
  - `backdrop?`: `"transparent" | "opaque" | "blur"`
  - `motionProps?`: `DrawerMotionProps`
  - `portalContainer?`: `HTMLElement`
  - `disableAnimation?`: `boolean`
  - `classNames?`: `Partial<{ wrapper: string; base: string; backdrop: string; header: string; body: string; footer: string; closeButton: string; }>`
  - `style?`: `CSSProperties`
  - `onOpenChange?`: `(isOpen: boolean) => void`
  - `onClose?`: `() => void`

### `DrawerContentType`

- firma: `export interface DrawerContentType { children: ReactNode; className?: string; style?: CSSProperties; }`
- propiedades detectadas:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `style?`: `CSSProperties`

### `DrawerHeaderType`

- firma: `export interface DrawerHeaderType { children?: ReactNode; className?: string; style?: CSSProperties; }`
- propiedades detectadas:
  - `children?`: `ReactNode`
  - `className?`: `string`
  - `style?`: `CSSProperties`

### `DrawerBodyType`

- firma: `export interface DrawerBodyType { children: ReactNode; className?: string; style?: CSSProperties; }`
- propiedades detectadas:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `style?`: `CSSProperties`

### `DrawerFooterType`

- firma: `export interface DrawerFooterType { children: ReactNode; className?: string; style?: CSSProperties; }`
- propiedades detectadas:
  - `children`: `ReactNode`
  - `className?`: `string`
  - `style?`: `CSSProperties`

## Variantes detectadas

### `backdropVariants`
- fuente: `lizaui/src/components/drawer/drawer.tsx`
- `backdrop`: `transparent`, `opaque`, `blur`; default: `opaque`

### `sizeVariants`
- fuente: `lizaui/src/components/drawer/drawer.tsx`
- `size`: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `full`; default: `md`

### `sizeHorizontalVariants`
- fuente: `lizaui/src/components/drawer/drawer.tsx`
- `size`: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `full`; default: `md`

### `radiusVariants`
- fuente: `lizaui/src/components/drawer/drawer.tsx`
- `radius`: `none`, `sm`, `md`, `lg`; default: `lg`

### `placementVariants`
- fuente: `lizaui/src/components/drawer/drawer.tsx`
- `placement`: `left`, `right`, `top`, `bottom`; default: `right`
## Demos y variaciones reales

### `lizaui/src/demo/drawer-demo.tsx`
- demos/componentes locales: `DrawerDemo`
- componentes usados: `Drawer`, `DrawerBody`, `DrawerContent`, `DrawerFooter`, `DrawerHeader`, `PlacementDrawerType`, `SizeDrawerInterface`
- props vistas en demos: `Drawer.isOpen=isBasicOpen`, `Drawer.onClose=true`, `Drawer.isOpen=isSizeOpen`, `Drawer.size=selectedSize`, `Drawer.onClose=true`, `Drawer.isOpen=isPlacementOpen`, `Drawer.placement=selectedPlacement`, `Drawer.onClose=true`, `Drawer.isOpen=isNonDismissibleOpen`, `Drawer.isDismissable=false`, `Drawer.isKeyboardDismissDisabled=true`, `Drawer.onClose=true`, `Drawer.isOpen=isBackdropOpen`, `Drawer.backdrop=backdropType`, `Drawer.onClose=true`, `Drawer.isOpen=isDrawer`, `Drawer.onClose=closeDrawer`, `Drawer.placement=right`
## Dependencias detectadas

- familias principales: `Framer Motion`
- imports externos observados: `class-variance-authority`, `framer-motion`, `react`, `react-dom`
## Recomendaciones de uso

- La base técnica detectada es Framer Motion.
- Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.
## Ejemplo de uso

```tsx
import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from "lizaui/drawer";

export function ExampleDrawer() {
	return (
		<Drawer isOpen onClose={() => {}} placement="right">
			<DrawerContent>
				<DrawerHeader>Título</DrawerHeader>
				<DrawerBody>Contenido</DrawerBody>
				<DrawerFooter>Acciones</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
```

## Archivos fuente

- `lizaui/src/components/drawer/drawer.tsx`
- `lizaui/src/components/drawer/drawer.type.ts`
- `lizaui/src/components/drawer/index.ts`
- `lizaui/src/lib/utils.ts`
