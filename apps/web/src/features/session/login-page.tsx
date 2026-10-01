import { useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Formik, Form, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "lizaui/button";
import { Input } from "lizaui/ui";
import { Notice } from "@/components/custom/notice";
import { useLogin, useSession } from "./use-session";

interface LoginValues {
	email: string;
	password: string;
}

const schema = Yup.object({
	email: Yup.string().trim().email("Ingrese un correo válido.").required("Ingrese su correo de trabajo."),
	password: Yup.string().required("Ingrese su contraseña de buzon-sol."),
});

/** D1 · Inicio de sesión de la app. Nunca pide Clave SOL. */
export const LoginPage = () => {
	const session = useSession();
	const login = useLogin();
	const navigate = useNavigate();
	const location = useLocation();
	const emailRef = useRef<HTMLInputElement>(null);
	const from = (location.state as { from?: string } | null)?.from ?? "/";

	if (session.data) return <Navigate to={from} replace />;

	const submit = async (values: LoginValues, helpers: FormikHelpers<LoginValues>) => {
		try {
			await login.mutateAsync({ email: values.email.trim(), password: values.password });
			navigate(from, { replace: true });
		} catch {
			// Mensaje único: no revela si el correo existe.
			helpers.setFieldValue("password", "", false);
			emailRef.current?.focus();
		}
	};

	return (
		<main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
			<div className="w-full max-w-[400px]">
				<div className="mb-6 flex items-center gap-2.5">
					<span aria-hidden="true" className="size-[26px] rounded-[6px] bg-brand-fill" />
					<span className="text-lg font-bold tracking-tight text-ink">buzon-sol</span>
				</div>
				<div className="rounded-xl border border-line bg-paper p-6 shadow-small">
					<h1 className="text-xl font-bold text-ink">Ingresar</h1>
					<p className="mt-1 text-sm text-muted-ink">Use su cuenta de buzon-sol asignada por el administrador.</p>
					<Formik<LoginValues> initialValues={{ email: "", password: "" }} validationSchema={schema} onSubmit={submit}>
						{({ values, errors, touched, handleChange, handleBlur, isSubmitting, submitCount }) => (
							<Form noValidate className="mt-5 flex flex-col gap-4" aria-describedby={login.isError ? "login-error" : undefined}>
								{login.isError && (
									<div id="login-error">
										<Notice tone="error" role="alert" title="No se pudo ingresar">
											Correo o contraseña incorrectos, o su usuario no está activo. Si olvidó su contraseña, contacte al administrador.
										</Notice>
									</div>
								)}
								<Input
									ref={emailRef}
									id="email"
									name="email"
									type="email"
									label="Correo de trabajo"
									autoComplete="username"
									required
									value={values.email}
									onChange={handleChange}
									onBlur={handleBlur}
									error={errors.email}
									touched={touched.email || submitCount > 0}
									autoFocus
									className="bg-paper dark:bg-paper"
								/>
								<Input
									id="password"
									name="password"
									type="password"
									label="Contraseña de buzon-sol"
									autoComplete="current-password"
									required
									value={values.password}
									onChange={handleChange}
									onBlur={handleBlur}
									error={errors.password}
									touched={touched.password || submitCount > 0}
									className="bg-paper dark:bg-paper"
								/>
								<Button type="submit" color="primary" size="lg" className="w-full" isLoading={isSubmitting} disabled={isSubmitting}>
									Ingresar
								</Button>
							</Form>
						)}
					</Formik>
					<p className="mt-4 text-sm text-muted-ink">¿Olvidó su contraseña de buzon-sol? Contacte al administrador.</p>
				</div>
				<PrototypeUsers />
			</div>
		</main>
	);
};

/** Ayuda del prototipo local: correos ficticios de fixtures. Desaparece al conectar backend. */
const PrototypeUsers = () => {
	if (import.meta.env.VITE_DATA_SOURCE === "backend") return null;
	return (
		<details className="mt-4 rounded-lg border border-dashed border-line-strong bg-paper/60 p-3 text-xs text-muted-ink">
			<summary className="cursor-pointer font-semibold text-ink-2">Prototipo con datos ficticios</summary>
			<p className="mt-2">Usuarios de prueba (contraseña de prueba en <code className="mono">src/adapters/local/fixtures.ts</code>):</p>
			<ul className="mono mt-1 list-inside list-disc">
				<li>admin@empresa-demo.test · Administrador</li>
				<li>usuario1@empresa-demo.test · Supervisor</li>
				<li>usuario2@empresa-demo.test · Analista (2 cuentas)</li>
				<li>usuario6@empresa-demo.test · Solo consulta</li>
			</ul>
		</details>
	);
};
