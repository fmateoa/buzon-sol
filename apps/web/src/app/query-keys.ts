import type { AccountId, ItemId, MailBox } from "@/domain/types";

/**
 * Claves de caché. Todo dato de una cuenta cuelga de ["account", accountId]: una respuesta
 * tardía de la cuenta A solo puede escribir en la caché de A, nunca en la vista de B.
 * Los IDs son opacos (sin RUC ni tokens).
 */
export const qk = {
	session: ["session"] as const,
	account: (accountId: AccountId) => ["account", accountId] as const,
	summary: (accountId: AccountId) => ["account", accountId, "summary"] as const,
	mail: (accountId: AccountId, box: MailBox, request: unknown) => ["account", accountId, "mail", box, request] as const,
	mailBase: (accountId: AccountId) => ["account", accountId, "mail"] as const,
	folders: (accountId: AccountId, box: MailBox) => ["account", accountId, "folders", box] as const,
	tags: (accountId: AccountId) => ["account", accountId, "tags"] as const,
	item: (accountId: AccountId, itemId: ItemId) => ["account", accountId, "item", itemId] as const,
	activity: (accountId: AccountId) => ["account", accountId, "activity"] as const,
	schedule: (accountId: AccountId) => ["account", accountId, "schedule"] as const,
	admin: {
		all: ["admin"] as const,
		accounts: (request: unknown) => ["admin", "accounts", request] as const,
		account: (accountId: AccountId) => ["admin", "account", accountId] as const,
		accountUsers: (accountId: AccountId) => ["admin", "account", accountId, "users"] as const,
		runs: ["admin", "runs"] as const,
		users: (request: unknown) => ["admin", "users", request] as const,
		roles: (request: unknown) => ["admin", "roles", request] as const,
		accountOptions: ["admin", "account-options"] as const,
		audit: (request: unknown) => ["admin", "audit", request] as const,
	},
};
