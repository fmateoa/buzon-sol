import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TagChip, tagColor } from "./status";

it("usa el color por código cuando el catálogo no trae color, también en el chip", () => {
	const tag = { code: "10", name: "VALORES", known: true, color: null };
	expect(tagColor(tag)).toBe("#ce0d0e");
	const { container } = render(<TagChip tag={tag} />);
	expect(container.querySelector("[style]")?.getAttribute("style")).toContain("rgb(206, 13, 14)");
});
