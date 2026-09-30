import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdapter } from "@/app/adapter-context";
import { qk } from "@/app/query-keys";
import type { AccountActivity, AccountId, MailBox, RunId } from "@/domain/types";

const isRunning = (activity: AccountActivity | undefined) => Boolean(activity?.currentRun);

export const useSummary = (accountId: AccountId, enabled = true) => {
	const adapter = useAdapter();
	return useQuery({
		queryKey: qk.summary(accountId),
		queryFn: () => adapter.getSummary(accountId),
		enabled,
		refetchInterval: (query) => (query.state.data?.connection.running ? 1500 : false),
	});
};

export const useActivity = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({
		queryKey: qk.activity(accountId),
		queryFn: () => adapter.getActivity(accountId),
		refetchInterval: (query) => (isRunning(query.state.data) ? 1000 : false),
	});
};

export const useFolders = (accountId: AccountId, box: MailBox) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.folders(accountId, box), queryFn: () => adapter.listFolders(accountId, box), staleTime: 60_000 });
};

export const useTags = (accountId: AccountId) => {
	const adapter = useAdapter();
	return useQuery({ queryKey: qk.tags(accountId), queryFn: () => adapter.listTags(accountId), staleTime: 60_000 });
};

/** Tras un comando de inventario se invalida todo lo de ESA cuenta y la sesión (estado de conexión). */
const useInvalidateAccount = () => {
	const client = useQueryClient();
	return (accountId: AccountId) => {
		void client.invalidateQueries({ queryKey: qk.account(accountId) });
		void client.invalidateQueries({ queryKey: qk.session });
	};
};

export const useStartInventory = (accountId: AccountId) => {
	const adapter = useAdapter();
	const invalidate = useInvalidateAccount();
	return useMutation({
		mutationFn: async () => {
			const result = await adapter.startInventory(accountId);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSettled: () => invalidate(accountId),
	});
};

export const useResumeRun = (accountId: AccountId) => {
	const adapter = useAdapter();
	const invalidate = useInvalidateAccount();
	return useMutation({
		mutationFn: async (runId: RunId) => {
			const result = await adapter.resumeRun(accountId, runId);
			if (!result.ok) throw result.error;
			return result.data;
		},
		onSettled: () => invalidate(accountId),
	});
};
