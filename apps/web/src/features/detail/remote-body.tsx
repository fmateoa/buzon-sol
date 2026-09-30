import { useLayoutEffect, useRef } from "react";
import { sanitizeRemoteHtml } from "@/lib/sanitize";

const SHADOW_STYLES = `
:host { all: initial; display: block; }
.body { font-family: "Public Sans", ui-sans-serif, system-ui, sans-serif; font-size: 16px; line-height: 1.65; color: var(--bz-ink, #16191D); max-width: 72ch; overflow-wrap: anywhere; }
p { margin: 0 0 0.9em; }
table { border-collapse: collapse; margin: 0.5em 0 1em; }
td, th { border: 1px solid var(--bz-line, #D9DDE2); padding: 4px 8px; text-align: left; }
a { color: var(--bz-brand, #1D4F7C); text-decoration: underline; }
`;

/**
 * Cuerpo remoto saneado y aislado en Shadow DOM: los estilos de la app no lo alteran y
 * sus estilos (ya eliminados) no podrían alterar la app. Se vuelve a sanear en cliente.
 * Solo los colores entran al Shadow DOM, como variables `--bz-*` (heredan aunque `:host` use
 * `all: initial`): así el cuerpo sigue el tema claro u oscuro sin estilos del remitente.
 */
export const RemoteBody = ({ html }: { html: string }) => {
	const hostRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
		root.innerHTML = `<style>${SHADOW_STYLES}</style><div class="body">${sanitizeRemoteHtml(html)}</div>`;
	}, [html]);

	return <div ref={hostRef} data-testid="remote-body" className="rounded-md" />;
};
