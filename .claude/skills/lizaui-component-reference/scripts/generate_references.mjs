import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const skillRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(skillRoot, "../../..");
const lizauiRoot = path.join(workspaceRoot, "lizaui");
const srcRoot = path.join(lizauiRoot, "src");
const referencesRoot = path.join(skillRoot, "references");
const requireFromLizaUI = createRequire(path.join(lizauiRoot, "package.json"));
const ts = requireFromLizaUI("typescript");

const printer = ts.createPrinter({
	newLine: ts.NewLineKind.LineFeed,
	removeComments: false,
});

const PUBLIC_HOOK_EXPORTS = new Map([
	["use-modal", "useModalHooks"],
	["use-drawer", "useDrawer"],
	["use-confirmation", "useConfirmationAlert"],
	["use-draggable", "useDraggable"],
]);

const MAIN_EXPORT_OVERRIDES = new Map([
	["autocomplete", "InputAutocompleteForm"],
	["button", "Button"],
	["button-group", "ButtonGroup"],
	["button-v2", "ButtonV2"],
	["calendar", "CalendarPicker"],
	["checkbox", "Checkbox"],
	["chip", "Chip"],
	["data-table", "Table"],
	["divider", "Divider"],
	["drawer", "Drawer"],
	["form-tabs", "FormTabs"],
	["meter", "Meter"],
	["modal", "Modal"],
	["pagination", "Pagination"],
	["phone-input", "PhoneInput"],
	["progress-bar", "ProgressBar"],
	["radio", "Radio"],
	["radio-group", "RadioGroup"],
	["ripple", "Ripple"],
	["select-input", "SelectInput"],
	["slider", "Slider"],
	["switch-group-v2", "SwitchGroup"],
	["table", "Table"],
	["time-input", "TimePickerInput"],
	["toggle-switch", "Switch"],
	["toolbar", "Toolbar"],
	["tooltip", "Tooltip"],
	["travel-calendar", "CalendarTravelForm"],
	["use-modal", "useModalHooks"],
	["use-drawer", "useDrawer"],
	["use-confirmation", "useConfirmationAlert"],
	["use-draggable", "useDraggable"],
]);

function pascalCase(value) {
	return value
		.split(/[-_/]/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function humanizeSlug(slug) {
	return slug
		.split(/[-_/]/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function toPosix(filePath) {
	return filePath.split(path.sep).join("/");
}

async function ensureDir(target) {
	await fs.mkdir(target, { recursive: true });
}

async function exists(target) {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
}

async function readText(target) {
	return fs.readFile(target, "utf8");
}

function createSourceFile(filePath, content) {
	return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function isNodeExported(node) {
	return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function printNode(node, sourceFile) {
	return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile).trim();
}

function normalizeWhitespace(value) {
	return value.replace(/\s+/g, " ").trim();
}

function keyName(name, sourceFile) {
	if (!name) return null;
	if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
	if (name.kind === ts.SyntaxKind.TrueKeyword) return "true";
	if (name.kind === ts.SyntaxKind.FalseKeyword) return "false";
	return normalizeWhitespace(name.getText(sourceFile));
}

function buildFunctionSignature(node, sourceFile) {
	const typeParameters = node.typeParameters?.length ? `<${node.typeParameters.map((param) => printNode(param, sourceFile)).join(", ")}>` : "";
	const parameters = node.parameters.map((param) => printNode(param, sourceFile)).join(", ");
	const returnType = node.type ? normalizeWhitespace(printNode(node.type, sourceFile)) : "unknown";
	return `export function ${node.name?.text ?? "anonymous"}${typeParameters}(${parameters}): ${returnType}`;
}

function stripExtensions(specifier) {
	return specifier.replace(/\.(tsx?|jsx?)$/, "");
}

async function resolveModule(fromFile, specifier) {
	if (!specifier) return null;

	if (specifier.startsWith("@/")) {
		const absoluteBase = path.join(srcRoot, specifier.slice(2));
		return resolveFileCandidates(absoluteBase);
	}

	if (specifier.startsWith(".")) {
		const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
		return resolveFileCandidates(absoluteBase);
	}

	return null;
}

async function resolveFileCandidates(basePath) {
	const candidates = [
		`${basePath}.ts`,
		`${basePath}.tsx`,
		`${basePath}.js`,
		`${basePath}.jsx`,
		path.join(basePath, "index.ts"),
		path.join(basePath, "index.tsx"),
	];

	for (const candidate of candidates) {
		if (await exists(candidate)) return candidate;
	}

	return null;
}

function getObjectMembersFromTypeNode(typeNode, sourceFile) {
	const members = [];
	const heritage = [];

	if (!typeNode) return { members, heritage };

	if (ts.isTypeLiteralNode(typeNode)) {
		for (const member of typeNode.members) {
			const record = getMemberRecord(member, sourceFile);
			if (record) members.push(record);
		}
		return { members, heritage };
	}

	if (ts.isIntersectionTypeNode(typeNode)) {
		for (const node of typeNode.types) {
			if (ts.isTypeLiteralNode(node)) {
				for (const member of node.members) {
					const record = getMemberRecord(member, sourceFile);
					if (record) members.push(record);
				}
			} else {
				heritage.push(normalizeWhitespace(printNode(node, sourceFile)));
			}
		}
		return { members, heritage };
	}

	if (ts.isTypeReferenceNode(typeNode)) {
		heritage.push(normalizeWhitespace(printNode(typeNode, sourceFile)));
		return { members, heritage };
	}

	heritage.push(normalizeWhitespace(printNode(typeNode, sourceFile)));
	return { members, heritage };
}

function getMemberRecord(member, sourceFile) {
	if (
		ts.isPropertySignature(member) ||
		ts.isPropertyDeclaration(member) ||
		ts.isParameter(member) ||
		ts.isMethodSignature(member) ||
		ts.isMethodDeclaration(member)
	) {
		const name = member.name ? normalizeWhitespace(member.name.getText(sourceFile)) : "(anonymous)";
		const typeText = member.type ? normalizeWhitespace(printNode(member.type, sourceFile)) : "unknown";
		const optional = Boolean(member.questionToken);
		return { name, typeText, optional };
	}

	return null;
}

function extractDeclarations(sourceFile) {
	const exportedValues = [];
	const exportedTypes = [];
	const exportedFunctions = [];
	const allTypes = [];
	const reexports = [];

	for (const statement of sourceFile.statements) {
		if (ts.isExportDeclaration(statement)) {
			const specifier = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null;
			if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
				for (const element of statement.exportClause.elements) {
					const exportedName = element.name.text;
					const importedName = element.propertyName?.text ?? exportedName;
					exportedValues.push(exportedName);
					reexports.push({
						name: exportedName,
						importedName,
						from: specifier,
						isTypeOnly: Boolean(statement.isTypeOnly || element.isTypeOnly),
					});
				}
			} else if (specifier) {
				reexports.push({
					name: "*",
					from: specifier,
					isTypeOnly: Boolean(statement.isTypeOnly),
				});
			}
			continue;
		}

		if (ts.isInterfaceDeclaration(statement)) {
			const record = {
				name: statement.name.text,
				kind: "interface",
				signature: normalizeWhitespace(printNode(statement, sourceFile)),
				members: statement.members.map((member) => getMemberRecord(member, sourceFile)).filter(Boolean),
				heritage: (statement.heritageClauses ?? [])
					.flatMap((clause) => clause.types.map((node) => normalizeWhitespace(printNode(node, sourceFile)))),
				filePath: sourceFile.fileName,
				isExported: isNodeExported(statement),
			};
			allTypes.push(record);
			if (record.isExported) exportedTypes.push(record);
			continue;
		}

		if (ts.isTypeAliasDeclaration(statement)) {
			const { members, heritage } = getObjectMembersFromTypeNode(statement.type, sourceFile);
			const record = {
				name: statement.name.text,
				kind: "type",
				signature: normalizeWhitespace(printNode(statement, sourceFile)),
				members,
				heritage,
				filePath: sourceFile.fileName,
				isExported: isNodeExported(statement),
			};
			allTypes.push(record);
			if (record.isExported) exportedTypes.push(record);
			continue;
		}

		if (ts.isFunctionDeclaration(statement) && isNodeExported(statement) && statement.name) {
			exportedValues.push(statement.name.text);
			exportedFunctions.push({
				name: statement.name.text,
				signature: buildFunctionSignature(statement, sourceFile),
				filePath: sourceFile.fileName,
			});
			continue;
		}

		if (ts.isVariableStatement(statement) && isNodeExported(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) {
					exportedValues.push(declaration.name.text);
				}
			}
			continue;
		}

		if ((ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && isNodeExported(statement) && statement.name) {
			exportedValues.push(statement.name.text);
		}
	}

	return {
		exportedValues: [...new Set(exportedValues)],
		exportedTypes,
		exportedFunctions,
		allTypes,
		reexports,
	};
}

function getExternalDependencies(sourceFile) {
	const deps = new Set();

	for (const statement of sourceFile.statements) {
		if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		const value = statement.moduleSpecifier.text;
		if (!value.startsWith(".") && !value.startsWith("@/") && !value.endsWith(".css")) deps.add(value);
	}

	return [...deps].sort();
}

async function collectFiles(seedFiles, rootLimit) {
	const queue = [...seedFiles];
	const visited = new Set();
	const results = [];
	const includeRoots = [rootLimit, path.join(srcRoot, "types"), path.join(srcRoot, "theme"), path.join(srcRoot, "lib")];

	const canInclude = (filePath) => includeRoots.some((root) => filePath.startsWith(root));

	while (queue.length) {
		const current = queue.shift();
		if (!current || visited.has(current)) continue;
		visited.add(current);

		if (!(await exists(current))) continue;
		if (!canInclude(current)) continue;
		if (!/\.(ts|tsx|js|jsx)$/.test(current)) continue;
		if (current.endsWith(".css") || current.endsWith(".scss")) continue;

		results.push(current);

		const content = await readText(current);
		const sourceFile = createSourceFile(current, content);

		for (const statement of sourceFile.statements) {
			if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
			const nextFile = await resolveModule(current, statement.moduleSpecifier.text);
			if (nextFile && !visited.has(nextFile) && canInclude(nextFile)) {
				queue.push(nextFile);
			}
		}

		const { reexports } = extractDeclarations(sourceFile);
		for (const reexport of reexports) {
			const nextFile = await resolveModule(current, reexport.from);
			if (nextFile && !visited.has(nextFile) && canInclude(nextFile)) {
				queue.push(nextFile);
			}
		}
	}

	return results.sort();
}

function classifyDependencies(dependencies) {
	const labels = [];
	const joinValue = dependencies.join(" ");

	if (dependencies.some((dep) => dep.startsWith("react-aria-components")) || joinValue.includes("@react-aria/")) labels.push("React Aria");
	if (dependencies.some((dep) => dep.startsWith("@radix-ui/"))) labels.push("Radix UI");
	if (dependencies.includes("@floating-ui/react")) labels.push("Floating UI");
	if (dependencies.includes("framer-motion") || dependencies.includes("motion")) labels.push("Framer Motion");
	if (dependencies.includes("cmdk")) labels.push("cmdk");
	if (dependencies.includes("react-select")) labels.push("react-select");
	if (dependencies.includes("react-phone-number-input")) labels.push("react-phone-number-input");
	if (dependencies.includes("react-time-picker")) labels.push("react-time-picker");
	if (dependencies.includes("react-calendar") || dependencies.includes("react-date-picker") || dependencies.includes("@wojtekmaj/react-daterange-picker")) labels.push("Calendars");
	if (dependencies.includes("react-multi-date-picker")) labels.push("react-multi-date-picker");
	if (dependencies.includes("react-resizable-panels")) labels.push("react-resizable-panels");
	if (dependencies.includes("input-otp")) labels.push("input-otp");

	if (!labels.length) labels.push("Custom React");
	return [...new Set(labels)];
}

function getKindLabel(kind) {
	if (kind === "component") return "componente";
	if (kind === "ui") return "familia UI";
	return "hook";
}

function findObjectProperty(objectLiteral, propertyName, sourceFile) {
	return objectLiteral.properties.find((property) => {
		if (!ts.isPropertyAssignment(property)) return false;
		return keyName(property.name, sourceFile) === propertyName;
	});
}

function objectKeys(objectLiteral, sourceFile) {
	return objectLiteral.properties
		.map((property) => {
			if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return null;
			return keyName(property.name, sourceFile);
		})
		.filter(Boolean);
}

function initializerPreview(node, sourceFile) {
	if (!node) return null;
	if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
	if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
	if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
	return normalizeWhitespace(node.getText(sourceFile));
}

function extractVariantsFromSource(sourceFile) {
	const variants = [];

	function visit(node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
			const callee = node.initializer.expression.getText(sourceFile);
			if (callee === "tv" || callee === "cva" || callee.endsWith(".tv") || callee.endsWith(".cva")) {
				const config = node.initializer.arguments.find((argument) => ts.isObjectLiteralExpression(argument));
				if (config && ts.isObjectLiteralExpression(config)) {
					const variantsProp = findObjectProperty(config, "variants", sourceFile);
					const defaultsProp = findObjectProperty(config, "defaultVariants", sourceFile);
					const defaults = new Map();

					if (defaultsProp && ts.isObjectLiteralExpression(defaultsProp.initializer)) {
						for (const property of defaultsProp.initializer.properties) {
							if (!ts.isPropertyAssignment(property)) continue;
							const name = keyName(property.name, sourceFile);
							if (name) defaults.set(name, initializerPreview(property.initializer, sourceFile));
						}
					}

					if (variantsProp && ts.isObjectLiteralExpression(variantsProp.initializer)) {
						const groups = [];
						for (const property of variantsProp.initializer.properties) {
							if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
							const name = keyName(property.name, sourceFile);
							if (!name) continue;
							groups.push({
								name,
								options: objectKeys(property.initializer, sourceFile),
								defaultValue: defaults.get(name) ?? null,
							});
						}

						if (groups.length) {
							variants.push({
								name: node.name.text,
								filePath: sourceFile.fileName,
								groups,
							});
						}
					}
				}
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return variants;
}

function extractDemoMetadata(filePath, content, publicExports) {
	const sourceFile = createSourceFile(filePath, content);
	const demos = [];

	for (const statement of sourceFile.statements) {
		if (ts.isFunctionDeclaration(statement) && statement.name && /Demo$|Example/.test(statement.name.text)) {
			demos.push(statement.name.text);
		}

		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && /Demo$|Example/.test(declaration.name.text)) {
					demos.push(declaration.name.text);
				}
			}
		}
	}

	const sectionTitles = [...content.matchAll(/title=["']([^"']+)["']/g)].map((match) => match[1]);
	const jsxTags = [...content.matchAll(/<([A-Z][A-Za-z0-9.]*)\b/g)].map((match) => match[1].split(".")[0]);
	const usedComponents = [...new Set(jsxTags.filter((tag) => publicExports.includes(tag)))].sort((a, b) => a.localeCompare(b));
	const propExamples = [];

	for (const exportName of usedComponents) {
		const tagPattern = new RegExp(`<${exportName}\\b([^>]*)`, "g");
		for (const match of content.matchAll(tagPattern)) {
			const attrs = match[1] ?? "";
			for (const attr of attrs.matchAll(/\s([A-Za-z_$][\w$-]*)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g)) {
				const propName = attr[1];
				if (["className", "children", "key"].includes(propName)) continue;
				propExamples.push({
					component: exportName,
					prop: propName,
					value: attr[2] ?? attr[3] ?? attr[4] ?? "true",
				});
			}
		}
	}

	return {
		filePath,
		demos: [...new Set(demos)].sort((a, b) => a.localeCompare(b)),
		sectionTitles: [...new Set(sectionTitles)],
		usedComponents,
		propExamples: propExamples.slice(0, 40),
	};
}

async function listSourceFiles(rootDir) {
	const entries = await fs.readdir(rootDir, { withFileTypes: true });
	const results = [];

	for (const entry of entries) {
		const absolute = path.join(rootDir, entry.name);
		if (entry.isDirectory()) {
			results.push(...(await listSourceFiles(absolute)));
		} else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
			results.push(absolute);
		}
	}

	return results.sort();
}

function stemWithoutExtension(filePath) {
	return path.basename(filePath).replace(/\.(tsx?|jsx?)$/, "");
}

function matchesDemoSlug(filePath, targetSlug, allSlugs) {
	const stem = stemWithoutExtension(filePath);

	if (stem === `${targetSlug}-demo` || stem === `${targetSlug}.demo` || stem === targetSlug) return true;
	if (stem.startsWith(`${targetSlug}.`)) return true;

	if (stem.startsWith(`${targetSlug}-`)) {
		const suffix = stem.slice(targetSlug.length + 1);
		const firstTwoParts = suffix.split("-").slice(0, 2);
		const possibleLongerSlug = `${targetSlug}-${firstTwoParts.join("-")}`;
		if (allSlugs.has(possibleLongerSlug) && possibleLongerSlug !== targetSlug) return false;
		return true;
	}

	const aliases = new Map([
		["alert-dialog", ["alert-demo"]],
		["badge", ["badge-demo"]],
		["data-table", ["data-table-demo", "table-multi-sort-demo", "table-resize-demo"]],
		["radio-group", ["radio-group-demo"]],
		["select", ["select-demo"]],
		["tabs", ["tabs-demo"]],
	]);

	return aliases.get(targetSlug)?.includes(stem) ?? false;
}

function buildUsageNotes(target, dependencies, publicExports) {
	const name = target.slug;
	const depText = classifyDependencies(dependencies).join(", ");
	const notes = [];

	if (target.kind === "hook") {
		notes.push("Usa este hook desde el entrypoint raíz del paquete para mantener imports estables.");
		notes.push("El retorno del hook es la fuente principal de estado y acciones; normalmente se consume junto con un componente visual.");
		if (name === "use-modal") notes.push("Encaja bien con `Modal` y con modales controlados por lógica local del componente.");
		if (name === "use-drawer") notes.push("Sirve para drawers/sheets con payload dinámico y apertura imperativa.");
		if (name === "use-confirmation") notes.push("Es especialmente útil junto a `AlertConfirmation` para flujos destructivos o confirmaciones asíncronas.");
		if (name === "use-draggable") notes.push("Está orientado a hacer draggable un `ref` DOM, especialmente overlays, modales o paneles flotantes.");
		return notes;
	}

	if (target.kind === "component" && name === "select-input") {
		notes.push("Lee también `references/select-input-and-autocomplete.md`: contiene el contrato controlado por IDs, selección simple/múltiple, clearing, Select all, formularios, SSR, portales y estrategias de carga async.");
		notes.push("`SelectInput` y `Autocomplete` exponen una API curada sobre `react-select`; no aceptan automáticamente todas sus props externas.");
		notes.push("Importa los componentes desde `lizaui/select-input` y los tipos públicos (`SelectOption`, `SelectProps`, `AutoCompleteProps`, `OnchangeSelectProps`, `SelectInputRef`) desde `lizaui`.");
		return notes;
	}

	if (target.kind === "component" && name === "autocomplete") {
		notes.push("Este entrypoint es el autocomplete legado `InputAutocompleteForm`, no el `Autocomplete` async basado en `react-select`.");
		notes.push("Para búsquedas async nuevas y valores controlados por ID, usa `Autocomplete` desde `lizaui/select-input` y consulta `references/select-input-and-autocomplete.md`.");
		return notes;
	}

	notes.push(`La base técnica detectada es ${depText}.`);
	notes.push("Cuando el tipo principal extiende props de un primitive externo, además de las props listadas aquí acepta la API base de ese primitive.");

	if (publicExports.some((value) => value.endsWith("Trigger")) && publicExports.some((value) => value.endsWith("Content"))) {
		notes.push("La API sigue un patrón compound component: compón la raíz y sus slots en vez de intentar resolver todo con una sola prop.");
	}

	if (publicExports.some((value) => value === "Root" || value.endsWith("Root"))) {
		notes.push("Si necesitas máximo control visual, usa la variante `Root` y los subcomponentes exportados en lugar del atajo principal.");
	}

	return notes;
}

function buildImportBlock(target, mainExport) {
	if (target.kind === "ui") {
		return `import { ${mainExport} } from "lizaui/ui";`;
	}

	if (target.kind === "hook") {
		return `import { ${mainExport} } from "lizaui";`;
	}

	return `import { ${mainExport} } from "lizaui/${target.slug}";`;
}

function getMainExport(target, publicExports) {
	const override = MAIN_EXPORT_OVERRIDES.get(target.slug);
	if (override && publicExports.includes(override)) return override;

	if (target.kind === "hook") {
		return publicExports.find((value) => /^use[A-Z]/.test(value)) ?? override ?? publicExports[0] ?? pascalCase(target.slug);
	}

	const valueExports = publicExports.filter((value) => {
		if (/(Props|Type|Interface|Variants|Return|Descriptor|Direction|Map)$/.test(value)) return false;
		if (/^[A-Z0-9_]+$/.test(value)) return false;
		if (/Variants$/.test(value) || /variants$/.test(value)) return false;
		return true;
	});
	return valueExports.find((value) => /^[A-Z]/.test(value)) ?? override ?? publicExports[0] ?? pascalCase(target.slug);
}

function buildExample(target, publicExports, extractedTypes) {
	const mainExport = getMainExport(target, publicExports);
	const importLine = buildImportBlock(target, mainExport);

	if (target.kind === "hook") {
		if (target.slug === "use-modal") {
			return [
				importLine,
				'import { Modal, ModalBody, ModalHeader } from "lizaui/modal";',
				"",
				"export function ExampleModalHook() {",
				"\tconst modal = useModalHooks<{ id: number }>();",
				"",
				"\treturn (",
				"\t\t<>",
				'\t\t\t<button onClick={() => modal.showModal({ id: 7 })}>Abrir</button>',
				'\t\t\t<Modal isShow={modal.isOpen} isVisible={modal.isVisibleModal} modalId={modal.modalId} size="lg" onClickOutside={modal.closeModal}>',
				'\t\t\t\t<ModalHeader title="Detalle" onClick={modal.closeModal} />',
				"\t\t\t\t<ModalBody>Payload: {modal.paramBody?.id}</ModalBody>",
				"\t\t\t</Modal>",
				"\t\t</>",
				"\t);",
				"}",
			].join("\n");
		}

		if (target.slug === "use-confirmation") {
			return [
				importLine,
				"",
				"export function ExampleConfirmation() {",
				"\tconst { alert, showAlert, hideAlert } = useConfirmationAlert();",
				"",
				"\treturn (",
				"\t\t<>",
				'\t\t\t<button onClick={() => showAlert({ title: "Eliminar", description: "Esta acción no se puede deshacer." })}>Confirmar</button>',
				'\t\t\t{alert.isOpen && <div role="alertdialog">{alert.title}<button onClick={hideAlert}>Cerrar</button></div>}',
				"\t\t</>",
				"\t);",
				"}",
			].join("\n");
		}

		if (target.slug === "use-draggable") {
			return [
				importLine,
				'import { useRef } from "react";',
				"",
				"export function ExampleDraggable() {",
				"\tconst ref = useRef<HTMLDivElement | null>(null);",
				"\tuseDraggable({ targetRef: ref, canOverflow: false });",
				"",
				'\treturn <div ref={ref} className="fixed top-4 left-4 cursor-move">Arrástrame</div>;',
				"}",
			].join("\n");
		}

		return [
			importLine,
			"",
			"export function ExampleHook() {",
			`\tconst state = ${mainExport}();`,
			'\treturn <pre>{JSON.stringify(state, null, 2)}</pre>;',
			"}",
		].join("\n");
	}

	if (target.kind === "ui") {
		const exportSet = new Set(publicExports);

		if (exportSet.has("Select") && exportSet.has("SelectTrigger") && exportSet.has("SelectContent")) {
			return [
				'import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "lizaui/ui";',
				"",
				"export function ExampleSelect() {",
				"\treturn (",
				'\t\t<Select defaultValue="mx">',
				'\t\t\t<SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>',
				"\t\t\t<SelectContent>",
				'\t\t\t\t<SelectItem value="mx">México</SelectItem>',
				'\t\t\t\t<SelectItem value="co">Colombia</SelectItem>',
				"\t\t\t</SelectContent>",
				"\t\t</Select>",
				"\t);",
				"}",
			].join("\n");
		}

		if (exportSet.has("Tabs") && exportSet.has("TabsList") && exportSet.has("TabsTrigger")) {
			return [
				'import { Tabs, TabsList, TabsTrigger, TabsContent } from "lizaui/ui";',
				"",
				"export function ExampleTabs() {",
				"\treturn (",
				'\t\t<Tabs defaultValue="general">',
				"\t\t\t<TabsList>",
				'\t\t\t\t<TabsTrigger value="general">General</TabsTrigger>',
				'\t\t\t\t<TabsTrigger value="advanced">Avanzado</TabsTrigger>',
				"\t\t\t</TabsList>",
				'\t\t\t<TabsContent value="general">Contenido principal</TabsContent>',
				'\t\t\t<TabsContent value="advanced">Opciones avanzadas</TabsContent>',
				"\t\t</Tabs>",
				"\t);",
				"}",
			].join("\n");
		}

		return [
			importLine,
			"",
			`export function Example${mainExport.replace(/[^A-Za-z0-9]/g, "")}() {`,
			'\treturn <' + mainExport + ' />;',
			"}",
		].join("\n");
	}

	const exportSet = new Set(publicExports);

	if (exportSet.has("Slider") && exportSet.has("SliderThumb")) {
		return [
			'import { Slider, SliderOutput, SliderTrack, SliderFill, SliderThumb } from "lizaui/slider";',
			"",
			"export function ExampleSlider() {",
			"\treturn (",
			'\t\t<Slider defaultValue={35} minValue={0} maxValue={100}>',
			"\t\t\t<SliderOutput />",
			"\t\t\t<SliderTrack>",
			"\t\t\t\t<SliderFill />",
			"\t\t\t\t<SliderThumb />",
			"\t\t\t</SliderTrack>",
			"\t\t</Slider>",
			"\t);",
			"}",
		].join("\n");
	}

	if (exportSet.has("Table") && exportSet.has("TableHeader") && exportSet.has("TableBody")) {
		return [
			'import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "lizaui/data-table";',
			"",
			"const rows = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Luis' }];",
			"",
			"export function ExampleDataTable() {",
			"\treturn (",
			"\t\t<Table aria-label=\"Usuarios\">",
			"\t\t\t<TableHeader>",
			'\t\t\t\t<TableColumn id="name" isRowHeader>Nombre</TableColumn>',
			"\t\t\t</TableHeader>",
			"\t\t\t<TableBody items={rows}>",
			'\t\t\t\t{(item) => <TableRow>{<TableCell>{item.name}</TableCell>}</TableRow>}',
			"\t\t\t</TableBody>",
			"\t\t</Table>",
			"\t);",
			"}",
		].join("\n");
	}

	if (exportSet.has("Drawer") && exportSet.has("DrawerContent")) {
		return [
			'import { Drawer, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from "lizaui/drawer";',
			"",
			"export function ExampleDrawer() {",
			"\treturn (",
			'\t\t<Drawer isOpen onClose={() => {}} placement="right">',
			"\t\t\t<DrawerContent>",
			"\t\t\t\t<DrawerHeader>Título</DrawerHeader>",
			"\t\t\t\t<DrawerBody>Contenido</DrawerBody>",
			"\t\t\t\t<DrawerFooter>Acciones</DrawerFooter>",
			"\t\t\t</DrawerContent>",
			"\t\t</Drawer>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "button-v2") {
		return [
			'import { ButtonV2 } from "lizaui/button-v2";',
			"",
			"export function ExampleButtonV2() {",
			'\treturn <ButtonV2 variant="primary" size="md" onPress={() => {}}>Guardar</ButtonV2>;',
			"}",
		].join("\n");
	}

	if (target.slug === "button-group") {
		return [
			'import { ButtonGroup } from "lizaui/button-group";',
			'import { ButtonV2 } from "lizaui/button-v2";',
			"",
			"export function ExampleButtonGroup() {",
			"\treturn (",
			'\t\t<ButtonGroup variant="secondary" size="md">',
			"\t\t\t<ButtonV2>Anterior</ButtonV2>",
			"\t\t\t<ButtonV2>Siguiente</ButtonV2>",
			"\t\t</ButtonGroup>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "meter") {
		return [
			'import { Meter, MeterOutput, MeterTrack, MeterFill } from "lizaui/meter";',
			"",
			"export function ExampleMeter() {",
			"\treturn (",
			'\t\t<Meter value={65} minValue={0} maxValue={100} color="primary">',
			"\t\t\t<MeterOutput />",
			"\t\t\t<MeterTrack><MeterFill /></MeterTrack>",
			"\t\t</Meter>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "progress-bar") {
		return [
			'import { ProgressBar, ProgressBarOutput, ProgressBarTrack, ProgressBarFill } from "lizaui/progress-bar";',
			"",
			"export function ExampleProgressBar() {",
			"\treturn (",
			'\t\t<ProgressBar value={45} color="success">',
			"\t\t\t<ProgressBarOutput />",
			"\t\t\t<ProgressBarTrack><ProgressBarFill /></ProgressBarTrack>",
			"\t\t</ProgressBar>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "radio-group") {
		return [
			'import { RadioGroup } from "lizaui/radio-group";',
			'import { Radio, RadioControl, RadioIndicator, RadioContent } from "lizaui/radio";',
			"",
			"export function ExampleRadioGroup() {",
			"\treturn (",
			'\t\t<RadioGroup defaultValue="bus" aria-label="Transporte">',
			'\t\t\t<Radio value="bus"><RadioControl><RadioIndicator /></RadioControl><RadioContent>Bus</RadioContent></Radio>',
			'\t\t\t<Radio value="van"><RadioControl><RadioIndicator /></RadioControl><RadioContent>Van</RadioContent></Radio>',
			"\t\t</RadioGroup>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "radio") {
		return [
			'import { Radio, RadioControl, RadioIndicator, RadioContent } from "lizaui/radio";',
			"",
			"export function ExampleRadio() {",
			"\treturn (",
			'\t\t<Radio value="agency">',
			"\t\t\t<RadioControl><RadioIndicator /></RadioControl>",
			"\t\t\t<RadioContent>Agencia</RadioContent>",
			"\t\t</Radio>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "toolbar") {
		return [
			'import { Toolbar } from "lizaui/toolbar";',
			'import { ButtonV2 } from "lizaui/button-v2";',
			"",
			"export function ExampleToolbar() {",
			"\treturn (",
			'\t\t<Toolbar aria-label="Acciones" orientation="horizontal">',
			"\t\t\t<ButtonV2>Nuevo</ButtonV2>",
			"\t\t\t<ButtonV2 variant=\"secondary\">Editar</ButtonV2>",
			"\t\t</Toolbar>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "button") {
		return [
			'import { Button } from "lizaui/button";',
			"",
			"export function ExampleButton() {",
			'\treturn <Button color="primary" variant="solid">Guardar</Button>;',
			"}",
		].join("\n");
	}

	if (target.slug === "checkbox") {
		return [
			'import { Checkbox } from "lizaui/checkbox";',
			"",
			"export function ExampleCheckbox() {",
			'\treturn <Checkbox isSelected defaultSelected>Recibir novedades</Checkbox>;',
			"}",
		].join("\n");
	}

	if (target.slug === "select-input") {
		return [
			'import { SelectInput } from "lizaui/select-input";',
			'import { useState } from "react";',
			"",
			"const options = [",
			'\t{ id: 0, name: "All" },',
			'\t{ id: 1, name: "Active" },',
			'\t{ id: 2, name: "Inactive" },',
			"] as const;",
			"",
			"export function ExampleSelectInput() {",
			"\tconst [statusId, setStatusId] = useState<number | null>(null);",
			"",
			"\treturn (",
			"\t\t<SelectInput",
			"\t\t\tisMulti={false}",
			"\t\t\tdata={options}",
			"\t\t\tlabel=\"Status\"",
			"\t\t\tname=\"statusId\"",
			"\t\t\tplaceholder=\"Select a status\"",
			"\t\t\tselectAllMode=\"off\"",
			"\t\t\tvalue={statusId}",
			'\t\t\tonChange={({ action, item }) => setStatusId(action === "clear" ? null : item.id)}',
			"\t\t/>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "phone-input") {
		return [
			'import { PhoneInput } from "lizaui/phone-input";',
			"",
			"export function ExamplePhoneInput() {",
			'\treturn <PhoneInput defaultCountry="MX" placeholder="Número de teléfono" />;',
			"}",
		].join("\n");
	}

	if (target.slug === "modal") {
		return [
			'import { useDraggable, useModalHooks } from "lizaui";',
			'import { Button } from "lizaui/button";',
			'import { Modal, ModalBody, ModalFooter, ModalHeader } from "lizaui/modal";',
			'import { useRef, type RefObject } from "react";',
			"",
			"export function ExampleModal() {",
			"\tconst modal = useModalHooks<{ id: number }>();",
			"\tconst targetRef = useRef<HTMLDivElement>(null);",
			"\tconst { moveProps } = useDraggable({ targetRef: targetRef as RefObject<HTMLElement>, canOverflow: true, isDisabled: !modal.isOpen });",
			"",
			"\treturn (",
			"\t\t<>",
			'\t\t\t<Button onClick={() => modal.showModal({ id: 7 })}>Abrir</Button>',
			"\t\t\t<Modal",
			"\t\t\t\tref={targetRef}",
			'\t\t\t\tbackdrop="blur"',
			"\t\t\t\tisShow={modal.isOpen}",
			"\t\t\t\tisVisible={modal.isVisibleModal}",
			"\t\t\t\tmodalId={modal.modalId}",
			'\t\t\t\tplacement="top"',
			'\t\t\t\tsize="3xl"',
			"\t\t\t\tonClickOutside={modal.closeModal}",
			"\t\t\t>",
			'\t\t\t\t<ModalHeader {...moveProps} title="Editar registro" onClick={modal.closeModal} />',
			"\t\t\t\t{modal.isOpen && <ModalBody>Contenido del registro {modal.paramBody?.id}</ModalBody>}",
			"\t\t\t\t<ModalFooter>",
			'\t\t\t\t\t<Button variant="light" onClick={modal.closeModal}>Cancelar</Button>',
			'\t\t\t\t\t<Button color="primary">Guardar</Button>',
			"\t\t\t\t</ModalFooter>",
			"\t\t\t</Modal>",
			"\t\t</>",
			"\t);",
			"}",
		].join("\n");
	}

	if (target.slug === "tooltip") {
		return [
			'import { Tooltip } from "lizaui/tooltip";',
			"",
			"export function ExampleTooltip() {",
			'\treturn <Tooltip content="Más información"><button>Hover</button></Tooltip>;',
			"}",
		].join("\n");
	}

	const propNames = [...new Set(extractedTypes.flatMap((type) => type.members.map((member) => member.name)))];
	const propEntries = [];

	if (propNames.includes("label")) propEntries.push('label="Ejemplo"');
	if (propNames.includes("placeholder")) propEntries.push('placeholder="Escribe aquí"');
	if (propNames.includes("description")) propEntries.push('description="Descripción corta"');
	if (propNames.includes("title")) propEntries.push('title="Título"');
	if (propNames.includes("content")) propEntries.push('content="Contenido"');
	if (propNames.includes("variant")) propEntries.push('variant="solid"');
	if (propNames.includes("color")) propEntries.push('color="primary"');
	if (propNames.includes("value") && propNames.includes("onChange")) {
		propEntries.push('value={false}');
		propEntries.push("onChange={() => {}}");
	}
	if (propNames.includes("defaultValue")) propEntries.push('defaultValue="general"');
	if (propNames.includes("isOpen")) propEntries.push("isOpen={false}");

	const propsInline = propEntries.length ? ` ${propEntries.join(" ")}` : "";
	const exampleName = `Example${mainExport.replace(/[^A-Za-z0-9]/g, "")}`;
	const jsxLine = `<${mainExport}${propsInline} />`;

	return [
		importLine,
		"",
		`export function ${exampleName}() {`,
		`\treturn ${jsxLine};`,
		"}",
	].join("\n");
}

function renderTypeSection(types) {
	if (!types.length) {
		return "## Props y tipos clave\n\n- No se detectaron interfaces o type aliases exportados localmente; revisa los primitives base del archivo fuente si necesitas el detalle completo.\n";
	}

	const blocks = ["## Props y tipos clave", ""];

	for (const type of types) {
		blocks.push(`### \`${type.name}\``);
		blocks.push("");
		blocks.push(`- firma: \`${type.signature}\``);
		if (type.heritage.length) {
			blocks.push(`- hereda o referencia: ${type.heritage.map((item) => `\`${item}\``).join(", ")}`);
		}
		if (type.members.length) {
			blocks.push("- propiedades detectadas:");
			for (const member of type.members) {
				blocks.push(`  - \`${member.name}${member.optional ? "?" : ""}\`: \`${member.typeText}\``);
			}
		} else {
			blocks.push("- propiedades detectadas: este tipo es alias o wrapper de otros tipos; revisa la firma y los archivos fuente.");
		}
		blocks.push("");
	}

	return `${blocks.join("\n")}\n`;
}

function renderFunctionSection(functions) {
	if (!functions.length) return "";

	const lines = ["## Funciones exportadas", ""];
	for (const item of functions) {
		lines.push(`- \`${item.name}\`: \`${item.signature}\``);
	}
	lines.push("");
	return `${lines.join("\n")}\n`;
}

function renderVariantsSection(variants) {
	if (!variants.length) return "";

	const lines = ["## Variantes detectadas", ""];
	for (const variant of variants) {
		lines.push(`### \`${variant.name}\``);
		lines.push(`- fuente: \`${toPosix(path.relative(workspaceRoot, variant.filePath))}\``);
		for (const group of variant.groups) {
			const options = group.options.length ? group.options.map((item) => `\`${item}\``).join(", ") : "sin opciones detectadas";
			const defaultText = group.defaultValue ? `; default: \`${group.defaultValue}\`` : "";
			lines.push(`- \`${group.name}\`: ${options}${defaultText}`);
		}
		lines.push("");
	}

	return `${lines.join("\n")}\n`;
}

function renderDemosSection(demos) {
	if (!demos.length) return "";

	const lines = ["## Demos y variaciones reales", ""];
	for (const demo of demos) {
		lines.push(`### \`${toPosix(path.relative(workspaceRoot, demo.filePath))}\``);
		if (demo.demos.length) lines.push(`- demos/componentes locales: ${demo.demos.map((item) => `\`${item}\``).join(", ")}`);
		if (demo.sectionTitles.length) lines.push(`- variaciones visibles: ${demo.sectionTitles.map((item) => `\`${item}\``).join(", ")}`);
		if (demo.usedComponents.length) lines.push(`- componentes usados: ${demo.usedComponents.map((item) => `\`${item}\``).join(", ")}`);
		if (demo.propExamples.length) {
			const examples = demo.propExamples
				.map((item) => `\`${item.component}.${item.prop}=${item.value}\``)
				.slice(0, 18)
				.join(", ");
			lines.push(`- props vistas en demos: ${examples}`);
		}
		lines.push("");
	}

	return `${lines.join("\n")}\n`;
}

function renderDependenciesSection(dependencies) {
	const labels = classifyDependencies(dependencies);
	return [
		"## Dependencias detectadas",
		"",
		`- familias principales: ${labels.map((item) => `\`${item}\``).join(", ")}`,
		`- imports externos observados: ${dependencies.length ? dependencies.map((item) => `\`${item}\``).join(", ") : "ninguno"}`,
		"",
	].join("\n");
}

function renderUsageSection(target, dependencies, publicExports) {
	const notes = buildUsageNotes(target, dependencies, publicExports);
	const lines = ["## Recomendaciones de uso", ""];
	for (const note of notes) lines.push(`- ${note}`);
	lines.push("");
	return `${lines.join("\n")}\n`;
}

function renderExportsSection(publicExports) {
	const lines = ["## Exportaciones públicas", ""];
	for (const item of publicExports) lines.push(`- \`${item}\``);
	lines.push("");
	return `${lines.join("\n")}\n`;
}

function renderFilesSection(files) {
	const lines = ["## Archivos fuente", ""];
	for (const file of files) {
		lines.push(`- \`${toPosix(path.relative(workspaceRoot, file))}\``);
	}
	lines.push("");
	return `${lines.join("\n")}\n`;
}

async function getPublicComponentTargets() {
	const packageJson = JSON.parse(await readText(path.join(lizauiRoot, "package.json")));
	const exportsMap = packageJson.exports ?? {};
	const targets = [];

	for (const key of Object.keys(exportsMap)) {
		if (key === "." || key === "./ui") continue;
		const slug = key.replace(/^\.\//, "");
		targets.push({
			kind: "component",
			slug,
			title: humanizeSlug(slug),
			entryFile: path.join(srcRoot, "components", slug, "index.ts"),
		});
	}

	return targets.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function getUiTargets() {
	const barrelPath = path.join(srcRoot, "components", "ui", "index.ts");
	const barrelContent = await readText(barrelPath);
	const barrelSource = createSourceFile(barrelPath, barrelContent);
	const targets = [];

	for (const statement of barrelSource.statements) {
		if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
		const specifier = stripExtensions(statement.moduleSpecifier.text).replace(/^\.\//, "");
		targets.push({
			kind: "ui",
			slug: specifier,
			title: humanizeSlug(specifier),
			entryFile: path.join(srcRoot, "components", "ui", `${specifier}.tsx`),
		});
	}

	return targets.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function getHookTargets() {
	const targets = [];
	for (const [slug] of PUBLIC_HOOK_EXPORTS) {
		targets.push({
			kind: "hook",
			slug,
			title: humanizeSlug(slug),
			entryFile: path.join(srcRoot, "hooks", `${slug}.ts`),
		});
	}
	return targets.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function extractDocPayload(target, demoFiles, allSlugs) {
	const rootLimit =
		target.kind === "ui"
			? path.join(srcRoot, "components", "ui")
			: target.kind === "hook"
				? path.join(srcRoot, "hooks")
				: path.join(srcRoot, "components", target.slug);

	const files = await collectFiles([target.entryFile], rootLimit);
	const sourcePayloads = [];

	for (const file of files) {
		const content = await readText(file);
		const sourceFile = createSourceFile(file, content);
		sourcePayloads.push({
			filePath: file,
			content,
			isPrimary: file.startsWith(rootLimit),
			sourceFile,
			...extractDeclarations(sourceFile),
			dependencies: getExternalDependencies(sourceFile),
			variants: extractVariantsFromSource(sourceFile),
		});
	}

	let publicExports = [];

	if (target.kind === "component") {
		const entry = sourcePayloads.find((item) => item.filePath === target.entryFile);
		for (const reexport of entry?.reexports ?? []) {
			if (reexport.name === "*") {
				const resolved = await resolveModule(target.entryFile, reexport.from);
				const source = sourcePayloads.find((item) => item.filePath === resolved);
				if (source) {
					publicExports.push(...source.exportedValues, ...source.exportedTypes.map((type) => type.name));
				}
			} else {
				publicExports.push(reexport.name);
			}
		}

		for (const value of entry?.exportedValues ?? []) {
			publicExports.push(value);
		}
	}

	if (target.kind === "ui" || target.kind === "hook") {
		for (const payload of sourcePayloads) {
			publicExports.push(...payload.exportedValues, ...payload.exportedTypes.map((type) => type.name));
		}
	}

	if (target.kind === "hook") {
		publicExports = publicExports.filter((item) => item === PUBLIC_HOOK_EXPORTS.get(target.slug) || /Props|Type|Interface|Return|Map/.test(item));
	}

	publicExports = [...new Set(publicExports)].sort((a, b) => a.localeCompare(b));

	const referencedNames = new Set(publicExports);
	for (const payload of sourcePayloads.filter((item) => item.isPrimary)) {
		for (const reexport of payload.reexports) {
			if (reexport.importedName) referencedNames.add(reexport.importedName);
		}
	}

	for (const payload of sourcePayloads.filter((item) => item.isPrimary)) {
		for (const match of payload.content.match(/\b[A-Z][A-Za-z0-9_]*\b/g) ?? []) {
			referencedNames.add(match);
		}
	}

	const extractedTypes = sourcePayloads
		.flatMap((item) =>
			item.allTypes.filter((type) => {
				if (item.isPrimary) return type.isExported || referencedNames.has(type.name);
				return referencedNames.has(type.name);
			}),
		);

	const extractedFunctions = sourcePayloads.flatMap((item) => item.exportedFunctions.filter(() => item.isPrimary));
	const dependencies = [...new Set(sourcePayloads.filter((item) => item.isPrimary).flatMap((item) => item.dependencies))].sort();
	const variants = sourcePayloads.flatMap((item) => item.variants);
	const demos = [];

	if (target.kind !== "hook") {
		for (const file of demoFiles.filter((demoFile) => matchesDemoSlug(demoFile, target.slug, allSlugs))) {
			demos.push(extractDemoMetadata(file, await readText(file), publicExports));
		}
	}

	return {
		target,
		files,
		publicExports,
		extractedTypes,
		extractedFunctions,
		dependencies,
		variants,
		demos,
	};
}

function buildDoc(payload) {
	const { target, files, publicExports, extractedTypes, extractedFunctions, dependencies, variants, demos } = payload;
	const mainExport = getMainExport(target, publicExports);
	const importPath = target.kind === "ui" ? "lizaui/ui" : target.kind === "hook" ? "lizaui" : `lizaui/${target.slug}`;
	const title = target.kind === "hook" ? mainExport : `${target.title}`;

	return [
		`# ${title}`,
		"",
		`- tipo: ${getKindLabel(target.kind)}`,
		`- import recomendado: \`${importPath}\``,
		`- export principal sugerido: \`${mainExport}\``,
		"",
		"## Resumen",
		"",
		`Esta referencia documenta la superficie pública de ${target.kind === "hook" ? `\`${mainExport}\`` : `\`${target.slug}\``} a partir del código fuente real de \`lizaui\`.`,
		"",
		renderExportsSection(publicExports).trimEnd(),
		"",
		renderTypeSection(extractedTypes).trimEnd(),
		renderFunctionSection(extractedFunctions).trimEnd(),
		renderVariantsSection(variants).trimEnd(),
		renderDemosSection(demos).trimEnd(),
		renderDependenciesSection(dependencies).trimEnd(),
		renderUsageSection(target, dependencies, publicExports).trimEnd(),
		"## Ejemplo de uso",
		"",
		"```tsx",
		buildExample(target, publicExports, extractedTypes),
		"```",
		"",
		renderFilesSection(files).trimEnd(),
	].join("\n");
}

async function writeDoc(payload) {
	const folderName = payload.target.kind === "component" ? "components" : payload.target.kind === "ui" ? "ui" : "hooks";
	const outputDir = path.join(referencesRoot, folderName);
	await ensureDir(outputDir);
	const outputPath = path.join(outputDir, `${payload.target.slug}.md`);
	await fs.writeFile(outputPath, `${buildDoc(payload)}\n`, "utf8");
	return outputPath;
}

async function writeOverview(allPayloads) {
	const componentPayloads = allPayloads.filter((item) => item.target.kind === "component");
	const uiPayloads = allPayloads.filter((item) => item.target.kind === "ui");
	const hookPayloads = allPayloads.filter((item) => item.target.kind === "hook");

	const lines = [
		"# LizaUI Reference Overview",
		"",
		"## Alcance",
		"",
		"- este skill cubre los entrypoints públicos de `lizaui/*`, `lizaui/ui` y los hooks públicos del entrypoint raíz `lizaui`",
		"- las referencias se generan desde el código fuente real para mantener imports, tipos y nombres alineados",
		"- cuando un componente hereda props de Radix, React Aria o HTML, la referencia lista primero las props locales detectables y deja explícita la herencia",
		"- cada referencia puede incluir variantes de `tailwind-variants`/`cva`, demos reales de `src/demo` y props observadas en esos demos",
		"",
		"## Conteo detectado",
		"",
		`- componentes públicos: ${componentPayloads.length}`,
		`- familias UI: ${uiPayloads.length}`,
		`- hooks públicos: ${hookPayloads.length}`,
		"",
		"## Cómo usar estas referencias",
		"",
		"1. Identifica el entrypoint público que vas a usar.",
		"2. Lee primero el archivo correspondiente en `references/components`, `references/ui` o `references/hooks`.",
		"3. Para props locales y tipos, revisa `Props y tipos clave`; para valores permitidos de estilos usa `Variantes detectadas`.",
		"4. Para patrones de uso reales, revisa `Demos y variaciones reales`, que apunta a `lizaui/src/demo` cuando existe.",
		"5. Si necesitas el detalle exacto de props heredadas, consulta también los archivos fuente listados al final de cada referencia.",
		"6. Si la librería cambió, vuelve a generar estas referencias con `node .agents/skills/lizaui-component-reference/scripts/generate_references.mjs`.",
		"",
		"## Guías especializadas",
		"",
		"- `SelectInput` y `Autocomplete` async: `references/select-input-and-autocomplete.md`",
		"",
		"## Índice de componentes",
		"",
	];

	for (const payload of componentPayloads) {
		lines.push(`- \`${payload.target.slug}\`: \`references/components/${payload.target.slug}.md\``);
	}

	lines.push("", "## Índice de UI", "");
	for (const payload of uiPayloads) {
		lines.push(`- \`${payload.target.slug}\`: \`references/ui/${payload.target.slug}.md\``);
	}

	lines.push("", "## Índice de hooks", "");
	for (const payload of hookPayloads) {
		lines.push(`- \`${payload.target.slug}\`: \`references/hooks/${payload.target.slug}.md\``);
	}

	lines.push("");

	await fs.writeFile(path.join(referencesRoot, "overview.md"), `${lines.join("\n")}\n`, "utf8");
}

async function writeInventory(allPayloads) {
	const inventory = allPayloads.map((payload) => ({
		kind: payload.target.kind,
		slug: payload.target.slug,
		title: payload.target.title,
		publicExports: payload.publicExports,
		dependencies: payload.dependencies,
		variants: payload.variants.map((variant) => ({
			name: variant.name,
			file: toPosix(path.relative(workspaceRoot, variant.filePath)),
			groups: variant.groups,
		})),
		demos: payload.demos.map((demo) => ({
			file: toPosix(path.relative(workspaceRoot, demo.filePath)),
			sections: demo.sectionTitles,
			usedComponents: demo.usedComponents,
		})),
		files: payload.files.map((file) => toPosix(path.relative(workspaceRoot, file))),
	}));

	await fs.writeFile(path.join(referencesRoot, "_inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
}

async function main() {
	await ensureDir(referencesRoot);

	const targets = [
		...(await getPublicComponentTargets()),
		...(await getUiTargets()),
		...(await getHookTargets()),
	];
	const demoDir = path.join(srcRoot, "demo");
	const demoFiles = (await exists(demoDir)) ? await listSourceFiles(demoDir) : [];
	const allSlugs = new Set(targets.map((target) => target.slug));

	const payloads = [];
	for (const target of targets) {
		if (!(await exists(target.entryFile))) {
			throw new Error(`No se encontró el archivo de entrada esperado: ${target.entryFile}`);
		}
		const payload = await extractDocPayload(target, demoFiles, allSlugs);
		payloads.push(payload);
		await writeDoc(payload);
	}

	await writeOverview(payloads);
	await writeInventory(payloads);

	console.log(`Referencias generadas: ${payloads.length}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
