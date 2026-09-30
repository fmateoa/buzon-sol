import { useState } from "react";
import { PageHeader } from "@/components/custom/layout-bits";
import { useAccountId, useActiveAccount } from "@/features/accounts/account-guard";
import { ScheduleEditor } from "./schedule-form";

/** Programador de la cuenta activa para roles con `configure_schedule` (p. ej. Supervisor). */
export const AccountSchedulePage = () => {
	const accountId = useAccountId();
	const account = useActiveAccount();
	const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
	return (
		<div className="flex flex-col gap-5">
			<PageHeader
				title={`Programador · ${account.alias}`}
				description="Frecuencia, días, horario de Lima y bandejas de la consulta programada."
				actions={<div ref={setActionsSlot} className="flex flex-wrap gap-2" />}
			/>
			<ScheduleEditor accountId={accountId} actionsSlot={actionsSlot} />
		</div>
	);
};
