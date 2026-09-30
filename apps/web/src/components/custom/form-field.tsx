import { useEffect, useId, type ReactNode } from "react";
import { useField, useFormikContext } from "formik";
import { Input, LabelError } from "lizaui/ui";

/**
 * Campo Formik sobre `Input` de lizaui. Envoltorio propio porque el `Input` de lizaui no
 * asocia el texto de error al control: aquí se enlaza con `aria-describedby`.
 */
export const TextField = ({
	name,
	label,
	type = "text",
	hint,
	required = false,
	autoComplete,
	disabled,
	placeholder,
	endContent,
	inputMode,
	maxLength,
}: {
	name: string;
	label: string;
	type?: "text" | "email" | "password";
	hint?: ReactNode;
	required?: boolean;
	autoComplete?: string;
	disabled?: boolean;
	placeholder?: string;
	endContent?: ReactNode;
	inputMode?: "text" | "numeric" | "email";
	maxLength?: number;
}) => {
	const [field, meta] = useField<string>(name);
	const { submitCount } = useFormikContext();
	const id = useId();
	const invalid = Boolean(meta.error) && (meta.touched || submitCount > 0);
	const describedBy = [hint ? `${id}-hint` : null, invalid ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
	return (
		<div className="flex flex-col gap-1">
			<Input
				{...field}
				value={field.value ?? ""}
				id={id}
				type={type}
				label={label}
				required={required}
				autoComplete={autoComplete ?? "off"}
				disabled={disabled}
				placeholder={placeholder}
				endContent={endContent}
				inputMode={inputMode}
				maxLength={maxLength}
				error={meta.error}
				touched={invalid}
				isErrorText={false}
				aria-describedby={describedBy}
				aria-required={required || undefined}
				className="bg-paper dark:bg-paper"
			/>
			{hint && (
				<p id={`${id}-hint`} className="text-xs text-muted-ink">
					{hint}
				</p>
			)}
			{invalid && <LabelError id={`${id}-error`} text={meta.error!} />}
		</div>
	);
};

/** Tras un envío inválido, lleva el foco al primer campo con error. */
export const FocusFirstError = () => {
	const { submitCount, errors, isValid } = useFormikContext<Record<string, unknown>>();
	useEffect(() => {
		if (submitCount === 0 || isValid) return;
		const first = Object.keys(errors)[0];
		if (!first) return;
		const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"], [data-field="${CSS.escape(first)}"]`);
		el?.focus();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- solo al enviar
	}, [submitCount]);
	return null;
};

/** Error de un grupo (checkboxes, días…) asociado por id. */
export const GroupError = ({ id, message }: { id: string; message: string | undefined }) =>
	message ? (
		<p id={id} role="alert" className="text-xs text-danger">
			{message}
		</p>
	) : null;
