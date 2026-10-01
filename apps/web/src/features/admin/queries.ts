import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { AccountFilters, AccountInput, AccountSortColumn, AppError, AuditSortColumn, CommandResult, RoleFilters, RoleInput, RoleSortColumn, UserFilters, UserInput, UserSortColumn } from "@/domain/adapter";
import type { AccountId, AuditFilters, ListRequest, MailboxSettings, RoleId, ScheduleConfig, SettingValues, UserId } from "@/domain/types";

const unwrap = async <T>(promise: Promise<CommandResult<T>>): Promise<T> => {
	const result = await promise;
	if (!result.ok) throw result.error;
	return result.data;
};

/** Cualquier cambio administrativo puede alterar cuentas visibles/permisos de sesiones abiertas. */
const useInvalidateAdmin = () => {
	const client = useQueryClient();
	return () => {
		void client.invalidateQueries({ queryKey: qk.admin.all });
		void client.invalidateQueries({ queryKey: qk.session });
		void client.invalidateQueries({ queryKey: ["account"] });
	};
};

const useAdminMutation = <TVars, TData>(fn: (vars: TVars) => Promise<CommandResult<TData>>) => {
	const invalidate = useInvalidateAdmin();
	return useMutation<TData, AppError, TVars>({ mutationFn: (vars) => unwrap(fn(vars)), onSuccess: invalidate });
};

// ─── Cuentas ────────────────────────────────────────────────────────────────

export const useAdminAccounts = (request: ListRequest<AccountFilters, AccountSortColumn>) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.accounts(request), queryFn: () => adapter.listAdminAccounts(request), placeholderData: keepPreviousData });
};

export const useAdminAccount = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.account(accountId), queryFn: () => adapter.getAdminAccount(accountId) });
};

export const useCreateAccount = () => {
	const adapter = useAdapter();
	return useAdminMutation((input: AccountInput) => adapter.createAccount(input));
};

export const useUpdateAccount = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useAdminMutation((input: Omit<AccountInput, "ruc">) => adapter.updateAccount(accountId, input));
};

export const useReplaceCredential = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useAdminMutation((password: string) => adapter.replaceCredential(accountId, password));
};

export const useTestConnection = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useAdminMutation(() => adapter.testConnection(accountId));
};

export const useSetAccountActive = () => {
	const adapter = useAdapter();
	return useAdminMutation(({ accountId, active }: { accountId: AccountId; active: boolean }) => adapter.setAccountActive(accountId, active));
};

export const useSchedule = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.schedule(accountId), queryFn: () => adapter.getSchedule(accountId) });
};

export const useSaveSchedule = () => {
	const adapter = useAdapter();
	return useAdminMutation((config: Omit<ScheduleConfig, "nextRuns" | "pauseReason">) => adapter.saveSchedule(config));
};

export const useMailboxSettings = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.mailboxSettings(accountId), queryFn: () => adapter.getMailboxSettings(accountId) });
};

export const useSaveMailboxSettings = () => {
	const adapter = useAdapter();
	return useAdminMutation((settings: MailboxSettings) => adapter.saveMailboxSettings(settings));
};

/** Un inventario por cada cuenta activa permitida; devuelve el resultado de cada una. */
export const useStartAllInventories = () => {
	const adapter = useAdapter();
	return useAdminMutation(() => adapter.startAllInventories());
};

export const useAccountUsers = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.accountUsers(accountId), queryFn: () => adapter.listAccountUsers(accountId) });
};

export const useScheduledRuns = () => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.runs, queryFn: () => adapter.listScheduledRuns(), refetchInterval: 5000 });
};

// ─── Usuarios y roles ───────────────────────────────────────────────────────

export const useUsers = (request: ListRequest<UserFilters, UserSortColumn>) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.users(request), queryFn: () => adapter.listUsers(request), placeholderData: keepPreviousData });
};

export const useCreateUser = () => {
	const adapter = useAdapter();
	return useAdminMutation((input: UserInput) => adapter.createUser(input));
};

export const useUpdateUser = () => {
	const adapter = useAdapter();
	return useAdminMutation(({ userId, input }: { userId: UserId; input: UserInput }) => adapter.updateUser(userId, input));
};

export const useSetUserStatus = () => {
	const adapter = useAdapter();
	return useAdminMutation(({ userId, status }: { userId: UserId; status: "active" | "disabled" }) => adapter.setUserStatus(userId, status));
};

export const useRoles = (request?: ListRequest<RoleFilters, RoleSortColumn>) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.roles(request ?? "all"), queryFn: () => adapter.listRoles(request), placeholderData: keepPreviousData });
};

export const useCreateRole = () => {
	const adapter = useAdapter();
	return useAdminMutation((input: RoleInput) => adapter.createRole(input));
};

export const useUpdateRole = () => {
	const adapter = useAdapter();
	return useAdminMutation(({ roleId, input }: { roleId: RoleId; input: RoleInput }) => adapter.updateRole(roleId, input));
};

export const useAccountOptions = () => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.accountOptions, queryFn: () => adapter.listAdminAccountOptions() });
};

// ─── Auditoría ──────────────────────────────────────────────────────────────

export const useAudit = (request: ListRequest<AuditFilters, AuditSortColumn>) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.audit(request), queryFn: () => adapter.listAudit(request), placeholderData: keepPreviousData });
};

export const useExportAudit = () => {
	const adapter = useAdapter();
	return useMutation<string, AppError, AuditFilters>({ mutationFn: (filters) => unwrap(adapter.exportAuditCsv(filters)) });
};

// ─── Configuraciones ────────────────────────────────────────────────────────

export const useSettings = () => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.admin.settings, queryFn: () => adapter.listSettings() });
};

export const useSaveSettings = () => {
	const adapter = useAdapter();
	return useAdminMutation((values: Partial<SettingValues>) => adapter.saveSettings(values));
};
