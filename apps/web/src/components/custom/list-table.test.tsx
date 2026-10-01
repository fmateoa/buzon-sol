import { Fragment, isValidElement } from "react";
import { expect, it } from "vitest";
import { render } from "@testing-library/react";
import { withoutHiddenCells, type ColumnDef } from "./list-table";

const columns: ColumnDef[] = [{ id: "a", header: "A" }, { id: "b", header: "B" }, { id: "c", header: "C" }];

it("oculta la columna elegida y conserva la celda de acciones dentro del fragmento", () => {
	for (const hidden of ["a", "b", "c"]) {
		const cells = <><td>A</td><td>B</td><td>C</td><td>Acciones</td></>;
		const filtered = withoutHiddenCells(cells, columns, [hidden]);
		expect(isValidElement(filtered) && filtered.type).toBe(Fragment);
		const { container } = render(<table><tbody><tr>{filtered}</tr></tbody></table>);
		expect([...container.querySelectorAll("td")].map((cell) => cell.textContent)).toEqual(
			["A", "B", "C"].filter((value) => value.toLowerCase() !== hidden).concat("Acciones"),
		);
	}
});
