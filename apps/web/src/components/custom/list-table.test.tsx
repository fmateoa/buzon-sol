import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { withoutHiddenCells, type ColumnDef } from "./list-table";

const COLUMNS: ColumnDef[] = [
	{ id: "a", header: "A" },
	{ id: "b", header: "B" },
	{ id: "c", header: "C" },
];

const texts = (hidden: string[]) => {
	const cells = (
		<>
			<td>a</td>
			{null}
			<td>c</td>
			<td>acciones</td>
		</>
	);
	const { container } = render(<table><tbody><tr>{withoutHiddenCells(cells, COLUMNS, hidden)}</tr></tbody></table>);
	return [...container.querySelectorAll("td")].map((td) => td.textContent);
};

describe("withoutHiddenCells", () => {
	it("sin columnas ocultas deja las celdas como vienen", () => {
		expect(texts([])).toEqual(["a", "c", "acciones"]);
	});

	it("quita la celda de la columna oculta y conserva la de acciones", () => {
		expect(texts(["a"])).toEqual(["c", "acciones"]);
		expect(texts(["c"])).toEqual(["a", "acciones"]);
		expect(texts(["a", "b", "c"])).toEqual(["acciones"]);
	});
});
