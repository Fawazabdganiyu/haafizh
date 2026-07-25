import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  FolderOpen,
  Package,
  UserCircle,
} from "lucide-react";
import { OrgAttributionBadge } from "@/components/transactions/OrgAttributionBadge";
import { TransactionAmount } from "@/components/transactions/TransactionAmount";
import { SupporterBadge } from "@/components/ui/supporter-badge";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getTransactionTheme } from "@/lib/utils/transactionDisplay";
import { AssetCategory } from "@/types/__generated__/graphql";

interface TransactionCardProps {
  transaction: {
    id: string;
    type: string;
    category: AssetCategory;
    amount?: number | null;
    currency: string;
    date: string | number | Date;
    description?: string | null;
    itemName?: string | null;
    quantity?: number | null;
    contact?: {
      id?: string | null;
      name?: string | null;
      isSupporter?: boolean;
    } | null;
    createdBy?: {
      id: string;
      name: string;
      isSupporter?: boolean;
    } | null;
    projectTransaction?: {
      id: string;
      projectId: string;
      project?: { id: string; name: string } | null;
    } | null;
    orgSourceTransaction?: {
      organisation?: { id: string; name: string } | null;
      projectTransaction?: { project?: { id: string; name: string } | null } | null;
    } | null;
  };
  className?: string;
}

export function TransactionCard({ transaction: tx, className }: TransactionCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCreator = user?.id === tx.createdBy?.id;

  const theme = getTransactionTheme(tx.type);
  const isIncoming = theme.isIncoming;

  // Legacy INCOME/EXPENSE transactions that have a contact are project transactions —
  // they live in the ProjectTransaction table, not Transaction, so navigating
  // to /transactions/:id would return a 404.
  const isProjectTransaction = (tx.type === "INCOME" || tx.type === "EXPENSE") && !!tx.contact;

  // Real link (either origin direction) — this row IS a real, independently
  // viewable Transaction, unlike the legacy case above.
  const isFromProject = !!tx.projectTransaction;

  const cardClassName = cn(
    "group relative flex items-center justify-between p-3.5 sm:p-5 lg:p-6 rounded-[20px] sm:rounded-[24px] border border-border/50 bg-card transition-all duration-500",
    !isProjectTransaction &&
      "hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-primary/30",
    className,
  );

  const cardContent = (
    <>
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 flex-1 relative z-10">
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3",
              theme.gradient,
            )}
          >
            {isIncoming ? (
              <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-background border border-border/50 shadow-md">
            <div
              className={cn(
                "w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2.5 lg:h-2.5 rounded-full ring-2 ring-background",
                isIncoming ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex flex-col gap-1 sm:gap-1.5">
            <h3 className="text-sm sm:text-base lg:text-base font-bold leading-tight group-hover:text-primary transition-colors tracking-tight flex items-center gap-1.5 min-w-0">
              <span className="truncate min-w-0">
                {isProjectTransaction
                  ? tx.contact?.name || "Project"
                  : isCreator
                    ? tx.contact?.name || "Self"
                    : tx.createdBy?.name}
              </span>
              {!isProjectTransaction &&
                (isCreator ? tx.contact?.isSupporter : tx.createdBy?.isSupporter) && (
                  <SupporterBadge className="h-4 px-1 text-[9px] shrink-0" />
                )}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {isProjectTransaction && (
                <span className="flex items-center gap-1 text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/30 shrink-0 shadow-sm">
                  <FolderOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  PROJECT
                </span>
              )}
              {!isCreator && !isProjectTransaction && (
                <span className="flex items-center gap-1 text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 shrink-0 shadow-sm">
                  <UserCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  SHARED
                </span>
              )}
              <OrgAttributionBadge orgSourceTransaction={tx.orgSourceTransaction} />
              {isFromProject && tx.projectTransaction?.projectId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectId = tx.projectTransaction?.projectId;
                    if (!projectId) return;
                    navigate({
                      to: "/projects/$projectId",
                      params: { projectId },
                    });
                  }}
                  className="flex items-center gap-1 text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/30 shrink-0 shadow-sm cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/30"
                >
                  <FolderOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {tx.projectTransaction?.project?.name ?? "PROJECT"}
                </button>
              )}
              <span
                className={cn(
                  "text-[8px] sm:text-[10px] lg:text-[11px] px-2 py-0.5 rounded-full font-bold capitalize tracking-tight border shadow-sm transition-colors shrink-0",
                  theme.bgClass,
                  theme.textClass,
                  theme.borderClass,
                )}
              >
                {tx.type.toLowerCase().replace(/_/g, " ")}
              </span>

              <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[11px] lg:text-xs text-muted-foreground font-medium opacity-70 ml-0.5">
                <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-60" />
                <span className="shrink-0">{format(new Date(tx.date as string), "MMM d")}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[11px] lg:text-xs text-muted-foreground font-medium opacity-60">
              {tx.category === AssetCategory.Item ? (
                <span className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 text-primary/80 truncate">
                  <Package className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5 shrink-0" />
                  <span className="truncate">
                    {tx.quantity}x {tx.itemName}
                  </span>
                </span>
              ) : (
                <span className="truncate">{tx.description || "No description"}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 flex items-center gap-2 sm:gap-3 lg:gap-5 relative z-10 ml-4 sm:ml-5 lg:ml-6">
        <div className="flex flex-col items-end">
          {tx.category === AssetCategory.Item ? (
            <div className="text-sm sm:text-base lg:text-lg font-black tracking-tighter">
              <span className="text-[8px] sm:text-[10px] lg:text-[11px] font-bold opacity-60">
                Item
              </span>
            </div>
          ) : (
            <TransactionAmount
              type={tx.type}
              amount={tx.amount ?? 0}
              currency={tx.currency}
              className="text-sm sm:text-base lg:text-lg font-black tracking-tighter"
            />
          )}
          <div className="text-[8px] sm:text-[10px] lg:text-[11px] font-bold capitalize tracking-tight opacity-40 mt-0.5">
            {tx.category.toLowerCase()}
          </div>
        </div>
      </div>

      {/* Background Glow */}
      <div
        className={cn(
          "absolute -right-20 -bottom-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-700",
          theme.bgClass,
        )}
      ></div>
    </>
  );

  if (isProjectTransaction) {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: tx.contact?.id ?? "" }}
        className={cn(
          cardClassName,
          "hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-primary/30",
        )}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <Link to="/transactions/$id" params={{ id: tx.id }} className={cardClassName}>
      {cardContent}
    </Link>
  );
}
