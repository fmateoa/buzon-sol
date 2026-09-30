import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ACCOUNT_IDS } from "@/adapters/local/fixtures";
import { EMAILS, renderApp } from "@/test/render-app";

const DEMO = ACCOUNT_IDS.demo;
const FIRST_UNREAD = "itm_7f3a2bm00001"; // Aviso: vencimiento próximo… (no leído, sin lecturas previas)

describe("Acceso y navegación (FE-1)", () => {
	it("sin sesión redirige al login, que nunca pide Clave SOL", async () => {
		renderApp(`/c/${DEMO}/resumen`, null);
		expect(await screen.findByRole("heading", { name: "Ingresar" })).toBeInTheDocument();
		expect(screen.getByText(/Aquí no se pide ninguna Clave SOL/)).toBeInTheDocument();
		expect(screen.queryByLabelText(/Clave SOL/)).not.toBeInTheDocument();
	});

	it("el login con error no revela si el correo existe", async () => {
		const user = userEvent.setup();
		renderApp("/login", null);
		await user.type(await screen.findByLabelText(/Correo de trabajo/), "noexiste@empresa-demo.test");
		await user.type(screen.getByLabelText(/Contraseña de buzon-sol/), "incorrecta");
		await user.click(screen.getByRole("button", { name: "Ingresar" }));
		expect(await screen.findByText(/Correo o contraseña incorrectos/)).toBeInTheDocument();
	});

	it("el selector muestra solo las cuentas del rol", async () => {
		const user = userEvent.setup();
		renderApp(`/c/${DEMO}/resumen`, EMAILS.analyst);
		await user.click(await screen.findByRole("button", { name: /Cuenta SUNAT: Contribuyente Demo/ }));
		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((i) => i.textContent)).toEqual([expect.stringContaining("Contribuyente Demo S.A.C."), expect.stringContaining("Servicios Ficticios S.R.L.")]);
		expect(screen.queryByText("Comercial Ejemplo E.I.R.L.")).not.toBeInTheDocument();
	});

	it("una ruta directa a una cuenta ajena muestra «No tiene acceso» sin pedir sus datos", async () => {
		const { adapter } = renderApp(`/c/${ACCOUNT_IDS.comercial}/mensajes`, EMAILS.analyst);
		expect(await screen.findByText("No tiene acceso a esta cuenta")).toBeInTheDocument();
		expect(screen.queryByText(/mensajes en lo inventariado|Total verificado/)).not.toBeInTheDocument();
		expect(adapter.stats.readContentCalls).toBe(0);
	});

	it("las secciones de administración se ocultan sin permiso", async () => {
		renderApp(`/admin/cuentas`, EMAILS.analyst);
		expect(await screen.findByText("No tiene permiso para ver esta sección")).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Cuentas SUNAT/ })).not.toBeInTheDocument();
	});
});

describe("Resumen y bandejas (FE-2)", () => {
	it("separa «Actualizar inventario» de «Leer contenido…» y muestra verificado frente a declarado", async () => {
		renderApp(`/c/${DEMO}/resumen`);
		expect(await screen.findByRole("button", { name: "Actualizar inventario" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Leer contenido…" })).toBeInTheDocument();
		expect(screen.getByText(/Obtiene asunto, fecha, remitente, etiqueta y estado. No abre ningún contenido./)).toBeInTheDocument();
		expect(screen.getAllByText("total verificado").length).toBe(2);
		// Testing Library normaliza el espacio duro a espacio simple.
		expect(screen.getByText(/SUNAT indica 1 000 en su paginación/)).toBeInTheDocument();
	});

	it("un inventario parcial no dice «total verificado» y ofrece reanudar", async () => {
		renderApp(`/c/${ACCOUNT_IDS.servicios}/notificaciones`, EMAILS.supervisor);
		expect(await screen.findByText("Inventario parcial de Notificaciones")).toBeInTheDocument();
		expect(screen.getByText(/en lo inventariado hasta ahora/)).toBeInTheDocument();
		expect(screen.getByText(/Registrados hasta ahora: 150/)).toBeInTheDocument();
		expect(screen.queryByText(/Total verificado/)).not.toBeInTheDocument();
		expect(await screen.findByRole("button", { name: "Reanudar" })).toBeInTheDocument();
	});

	it("una credencial rechazada muestra «Consulta en pausa» y conserva el inventario", async () => {
		renderApp(`/c/${ACCOUNT_IDS.comercial}/mensajes`, EMAILS.supervisor);
		expect(await screen.findByText("Consulta en pausa")).toBeInTheDocument();
		expect(screen.getByText(/SUNAT rechazó la credencial de esta cuenta/)).toBeInTheDocument();
		expect(await screen.findByText(/Registrados hasta ahora: 514/)).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "Actualizar credencial" })).not.toBeInTheDocument();
	});

	it("sin resultados mantiene encabezado y filtros y permite quitarlos", async () => {
		const user = userEvent.setup();
		renderApp(`/c/${DEMO}/mensajes`);
		const search = await screen.findByRole("textbox", { name: /Buscar mensajes por asunto/ });
		await user.type(search, "zzz-no-existe");
		expect(await screen.findByText("No hay mensajes con estos filtros", {}, { timeout: 3000 })).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: /Buscar mensajes por asunto/ })).toBeInTheDocument();
		expect(screen.getByRole("columnheader", { name: /Asunto/ })).toBeInTheDocument();
		await user.click(screen.getAllByRole("button", { name: "Quitar filtros" })[0]!);
		await waitFor(() => expect(screen.queryByText("No hay mensajes con estos filtros")).not.toBeInTheDocument());
	});

	it("el filtro de búsqueda ignora acentos", async () => {
		const user = userEvent.setup();
		renderApp(`/c/${DEMO}/mensajes`);
		await user.type(await screen.findByRole("textbox", { name: /Buscar mensajes por asunto/ }), "resolucion de cobranza n.° 000-000-demo-01");
		const table = await screen.findByRole("table", { name: "Mensajes inventariados" });
		await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2), { timeout: 3000 }); // encabezado + 1 fila
		expect(within(table).getByText("Resolución de Cobranza N.° 000-000-DEMO-01")).toBeInTheDocument();
	});

	it("cambiar de cuenta descarta los filtros de la anterior", async () => {
		const user = userEvent.setup();
		const { router } = renderApp(`/c/${DEMO}/mensajes`, EMAILS.supervisor);
		await user.click(await screen.findByRole("button", { name: "Solo no leídos" }));
		expect(screen.getByRole("button", { name: /Solo no leídos/ })).toHaveAttribute("aria-pressed", "true");
		await router.navigate(`/c/${ACCOUNT_IDS.servicios}/mensajes`);
		await screen.findByText(/3\s328 mensajes/);
		expect(screen.getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: /Solo no leídos/ })).toHaveAttribute("aria-pressed", "false");
	});
});

describe("Lectura y archivos (FE-3)", () => {
	it("abrir la ruta de detalle muestra metadatos sin llamar a readContent", async () => {
		const { adapter } = renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`);
		expect(await screen.findByRole("heading", { name: /Aviso: vencimiento próximo/ })).toBeInTheDocument();
		expect(screen.getByText("El contenido se mostrará después de confirmar.")).toBeInTheDocument();
		expect(screen.getByRole("group", { name: "¿Abrir el contenido?" })).toBeInTheDocument();
		expect(adapter.stats.readContentCalls).toBe(0);
		expect(adapter.stats.remoteDetailCalls).toBe(0);
	});

	it("«Volver sin abrir» no invoca readContent", async () => {
		const user = userEvent.setup();
		const { adapter, router } = renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`);
		await user.click(await screen.findByRole("button", { name: "Volver sin abrir" }));
		expect(router.state.location.pathname).toBe(`/c/${DEMO}/mensajes`);
		expect(adapter.stats.readContentCalls).toBe(0);
	});

	it("confirmar invoca readContent una sola vez y distingue confirmando de leído", async () => {
		const user = userEvent.setup();
		const { adapter } = renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`);
		const open = await screen.findByRole("button", { name: "Abrir contenido" });
		await user.dblClick(open);
		expect(await screen.findByTestId("remote-body")).toBeInTheDocument();
		expect(adapter.stats.readContentCalls).toBe(1);
		expect(adapter.stats.remoteDetailCalls).toBe(1);
		expect(adapter.stats.readIntents).toHaveLength(1);
		expect(screen.getAllByText("Confirmando lectura con SUNAT…").length).toBeGreaterThan(0);
		expect(await screen.findAllByText("Leído en SUNAT", {}, { timeout: 3000 })).not.toHaveLength(0);
	});

	it("«Marcar como revisado» no cambia el estado remoto", async () => {
		const user = userEvent.setup();
		const { adapter } = renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`);
		await user.click(await screen.findByRole("button", { name: "Marcar como revisado" }));
		expect(await screen.findByText("Revisado en buzon-sol")).toBeInTheDocument();
		expect(screen.getAllByText("No leído en SUNAT").length).toBeGreaterThan(0);
		expect(adapter.stats.readContentCalls).toBe(0);
	});

	it("si el usuario desactivó el aviso, abre sin confirmación pero mantiene «Puede marcar como leído»", async () => {
		renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`, EMAILS.analystNoWarning);
		expect(await screen.findByRole("button", { name: "Abrir contenido…" })).toBeInTheDocument();
		expect(screen.getByText("Puede marcar como leído")).toBeInTheDocument();
		expect(screen.queryByRole("group", { name: "¿Abrir el contenido?" })).not.toBeInTheDocument();
	});

	it("«Solo consulta» ve metadatos pero no puede abrir contenido", async () => {
		const { adapter } = renderApp(`/c/${DEMO}/mensajes/${FIRST_UNREAD}`, EMAILS.readonly);
		expect(await screen.findByText(/Su rol permite ver los metadatos, pero no el contenido/)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Abrir contenido/ })).not.toBeInTheDocument();
		expect(adapter.stats.readContentCalls).toBe(0);
	});

	it("una descarga fallida ofrece «Reintentar» y el reintento guarda el archivo", async () => {
		const user = userEvent.setup();
		renderApp(`/c/${DEMO}/notificaciones/itm_7f3a2bn00000`);
		await user.click(await screen.findByRole("button", { name: "Abrir contenido" }));
		await user.click(await screen.findByRole("button", { name: "Descargar anexos-DEMO.zip" }));
		expect(await screen.findByText(/No se pudo descargar el archivo/)).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Reintentar descarga de anexos-DEMO.zip" }));
		await waitFor(() => expect(screen.getAllByText(/Guardado en el espacio de la cuenta/)).toHaveLength(2));
	});
});

describe("Actividad y administración (FE-4)", () => {
	it("la actividad muestra la pausa por credencial y el avance guardado", async () => {
		renderApp(`/c/${ACCOUNT_IDS.comercial}/actividad`, EMAILS.admin);
		expect(await screen.findByText("Consulta en pausa")).toBeInTheDocument();
		expect(await screen.findByText(/Credencial rechazada al pedir la página 23/)).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: "Reanudar desde pág. 23" })[0]).toHaveAttribute("aria-disabled", "true");
	});

	it("la Clave SOL es de solo escritura: el campo empieza vacío y se limpia al guardar", async () => {
		const user = userEvent.setup();
		const secret = "ClaveFicticia-999";
		renderApp(`/admin/cuentas/${ACCOUNT_IDS.comercial}`, EMAILS.admin);
		const field = await screen.findByLabelText("Nueva Clave SOL", {}, { timeout: 3000 });
		expect(field).toHaveValue("");
		expect(field).toHaveAttribute("type", "password");
		await user.type(field, secret);
		await user.click(screen.getByRole("button", { name: "Guardar y reemplazar clave…" }));
		await user.click(await screen.findByRole("button", { name: "Reemplazar" }));
		expect(await screen.findByText(/Clave SOL reemplazada/)).toBeInTheDocument();
		expect(screen.getByLabelText("Nueva Clave SOL")).toHaveValue("");
		expect(document.body.textContent).not.toContain(secret);
	});

	it("el programador valida horario, días y aceptación del efecto remoto", async () => {
		const user = userEvent.setup();
		renderApp(`/admin/cuentas/${ACCOUNT_IDS.inversiones}?tab=programador`, EMAILS.admin);
		await user.click(await screen.findByRole("radio", { name: /Activo/ }, { timeout: 3000 }));
		for (const day of ["lunes", "martes", "miércoles", "jueves", "viernes"]) await user.click(screen.getByRole("button", { name: day }));
		await user.click(screen.getByRole("button", { name: "Guardar" }));
		expect(await screen.findByText("Elija al menos un día.")).toBeInTheDocument();
		expect(screen.getByText(/debe aceptar el posible efecto del inicio de sesión/)).toBeInTheDocument();
	});

	it("un usuario sin permiso de gestión no ve «Dar de alta usuario»", async () => {
		renderApp(`/admin/usuarios`, EMAILS.supervisor);
		expect(await screen.findByText("No tiene permiso para ver esta sección")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Dar de alta usuario" })).not.toBeInTheDocument();
	});

	it("el lote de usuarios confirma con nombres y reporta éxitos y fallos por separado", async () => {
		const user = userEvent.setup();
		renderApp(`/admin/usuarios`, EMAILS.admin);
		const table = await screen.findByRole("table", { name: "Usuarios de buzon-sol" }, { timeout: 3000 });
		await within(table).findByText("usuario3@empresa-demo.test");
		await user.click(within(table).getByRole("checkbox", { name: "Seleccionar fila Usuario Demo Tres" }));
		await user.click(within(table).getByRole("checkbox", { name: "Seleccionar fila Usuario Demo Seis" }));
		await user.click(screen.getByRole("button", { name: "Desactivar" }));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByText("Usuario Demo Tres")).toBeInTheDocument();
		expect(within(dialog).getByText("Usuario Demo Seis")).toBeInTheDocument();
		await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));
		expect(await screen.findByText("2 actualizados")).toBeInTheDocument();
	});
});
