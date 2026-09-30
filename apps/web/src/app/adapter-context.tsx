import { createContext, useContext, type ReactNode } from "react";
import type { BuzonAdapter } from "@/domain/adapter";

const AdapterContext = createContext<BuzonAdapter | null>(null);

export const AdapterProvider = ({ adapter, children }: { adapter: BuzonAdapter; children: ReactNode }) => (
	<AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>
);

export const useAdapter = (): BuzonAdapter => {
	const adapter = useContext(AdapterContext);
	if (!adapter) throw new Error("useAdapter requiere AdapterProvider");
	return adapter;
};
