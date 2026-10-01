import { Button } from "lizaui/button";
import { errorCopy, isAppError } from "@/lib/errors";
import { Notice } from "./notice";

export const QueryError = ({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) => {
	const copy = errorCopy(error);
	const retryable = !isAppError(error, "forbidden") && !isAppError(error, "not_found") && !isAppError(error, "pending_integration");
	return (
		<Notice
			tone="error"
			role="alert"
			title={copy.title}
			className={className}
			action={
				onRetry && retryable ? (
					<Button size="sm" variant="bordered" onClick={onRetry}>
						Reintentar
					</Button>
				) : undefined
			}
		>
			{copy.body}
		</Notice>
	);
};
