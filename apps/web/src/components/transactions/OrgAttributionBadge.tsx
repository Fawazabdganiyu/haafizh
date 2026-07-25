import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrgAttributionSource {
  organisation?: { id: string; name: string; slug?: string } | null;
  projectTransaction?: {
    project?: { id: string; name: string } | null;
  } | null;
}

interface OrgAttributionBadgeProps {
  /** The org transaction a personal-ledger mirror row reflects, if any. */
  orgSourceTransaction?: OrgAttributionSource | null;
  className?: string;
}

/**
 * Renders "On behalf of <Org> · <Project>" on a personal-ledger mirror row
 * (see TransactionsService.maybeCreatePersonalMirror). Reads
 * `orgSourceTransaction` rather than denormalised org/project columns so
 * re-linking a project on the org side never leaves this badge stale.
 * Styled to match the existing SHARED/PROJECT badge spans it sits beside —
 * see TransactionCard.tsx, routes/transactions/index.tsx, and
 * routes/contacts/$contactId.tsx.
 */
export function OrgAttributionBadge({ orgSourceTransaction, className }: OrgAttributionBadgeProps) {
  if (!orgSourceTransaction?.organisation) return null;

  const orgName = orgSourceTransaction.organisation.name;
  const projectName = orgSourceTransaction.projectTransaction?.project?.name;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/30 shrink-0 shadow-sm",
        className,
      )}
    >
      <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      On behalf of {orgName}
      {projectName ? ` · ${projectName}` : ""}
    </span>
  );
}
