import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { BlockSkeleton } from "@/components/custom/layout-bits";
import { AccountGuard } from "@/features/accounts/account-guard";
import { ActivityPage } from "@/features/activity/activity-page";
import { DetailPage } from "@/features/detail/detail-page";
import { MailboxPage } from "@/features/mailbox/mailbox-page";
import { ProfilePage } from "@/features/profile/profile-page";
import { HomeRedirect, NotFoundPage, RequirePermission, RequireSession } from "@/features/session/guards";
import { LoginPage } from "@/features/session/login-page";
import { MorePage } from "@/features/session/more-page";
import { SummaryPage } from "@/features/summary/summary-page";

// La administración se carga aparte: la mayoría de usuarios no la usa.
const AccountsAdminPage = lazy(() => import("@/features/admin/accounts-page").then((m) => ({ default: m.AccountsAdminPage })));
const AccountAdminDetailPage = lazy(() => import("@/features/admin/account-detail-page").then((m) => ({ default: m.AccountAdminDetailPage })));
const UsersAdminPage = lazy(() => import("@/features/admin/users-page").then((m) => ({ default: m.UsersAdminPage })));
const RolesAdminPage = lazy(() => import("@/features/admin/roles-page").then((m) => ({ default: m.RolesAdminPage })));
const ScheduledRunsPage = lazy(() => import("@/features/admin/scheduled-runs-page").then((m) => ({ default: m.ScheduledRunsPage })));
const AccountSchedulePage = lazy(() => import("@/features/admin/account-schedule-page").then((m) => ({ default: m.AccountSchedulePage })));
const SettingsPage = lazy(() => import("@/features/admin/settings-page").then((m) => ({ default: m.SettingsPage })));
const AuditPage = lazy(() => import("@/features/admin/audit-page").then((m) => ({ default: m.AuditPage })));

const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<BlockSkeleton lines={6} label="Cargando sección" />}>{children}</Suspense>;

export const routes: RouteObject[] = [
	{ path: "/login", element: <LoginPage /> },
	{
		element: <RequireSession />,
		children: [
			{
				element: <AppShell />,
				children: [
					{ index: true, element: <HomeRedirect /> },
					{
						path: "c/:accountId",
						element: <AccountGuard />,
						children: [
							{ index: true, element: <Navigate to="resumen" replace /> },
							{ path: "resumen", element: <SummaryPage /> },
							{ path: "mensajes", element: <MailboxPage box="messages" /> },
							{ path: "mensajes/:itemId", element: <DetailPage box="messages" /> },
							{ path: "notificaciones", element: <MailboxPage box="notifications" /> },
							{ path: "notificaciones/:itemId", element: <DetailPage box="notifications" /> },
							{ path: "actividad", element: <ActivityPage /> },
							{ path: "programador", element: <RequirePermission permission="configure_schedule"><Lazy><AccountSchedulePage /></Lazy></RequirePermission> },
						],
					},
					{ path: "perfil", element: <ProfilePage /> },
					{ path: "mas", element: <MorePage /> },
					{
						path: "admin",
						children: [
							{ index: true, element: <Navigate to="cuentas" replace /> },
							{ path: "cuentas", element: <RequirePermission permission="manage_accounts"><Lazy><AccountsAdminPage /></Lazy></RequirePermission> },
							{ path: "cuentas/:accountId", element: <RequirePermission permission="manage_accounts"><Lazy><AccountAdminDetailPage /></Lazy></RequirePermission> },
							{ path: "usuarios", element: <RequirePermission permission="manage_users_roles"><Lazy><UsersAdminPage /></Lazy></RequirePermission> },
							{ path: "roles", element: <RequirePermission permission="manage_users_roles"><Lazy><RolesAdminPage /></Lazy></RequirePermission> },
							{ path: "actividad", element: <RequirePermission permission="manage_accounts"><Lazy><ScheduledRunsPage /></Lazy></RequirePermission> },
							{ path: "configuraciones", element: <RequirePermission permission="manage_settings"><Lazy><SettingsPage /></Lazy></RequirePermission> },
							{ path: "auditoria", element: <RequirePermission permission="view_audit"><Lazy><AuditPage /></Lazy></RequirePermission> },
						],
					},
					{ path: "*", element: <NotFoundPage /> },
				],
			},
		],
	},
];
