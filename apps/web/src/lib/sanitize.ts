import DOMPurify from "dompurify";

/**
 * Sanea HTML remoto de SUNAT: sin scripts, estilos, eventos, formularios ni recursos
 * externos. Los enlaces se abren fuera de la app con `noopener`.
 */
export const sanitizeRemoteHtml = (html: string): string => {
	const clean = DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "span", "div", "a", "blockquote", "hr"],
		ALLOWED_ATTR: ["href", "colspan", "rowspan"],
		ALLOW_DATA_ATTR: false,
		FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input", "img", "link", "meta"],
		RETURN_TRUSTED_TYPE: false,
	});
	const template = document.createElement("template");
	template.innerHTML = clean;
	template.content.querySelectorAll("a").forEach((a) => {
		const href = a.getAttribute("href") ?? "";
		if (!/^https:\/\//i.test(href)) a.removeAttribute("href");
		a.setAttribute("target", "_blank");
		a.setAttribute("rel", "noopener noreferrer nofollow");
	});
	return template.innerHTML;
};
