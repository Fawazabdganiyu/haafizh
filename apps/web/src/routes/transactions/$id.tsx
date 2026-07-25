import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Edit2,
  FileText,
  Gift,
  Package,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { HistoryViewer } from "@/components/history/HistoryViewer";
import { AddWitnessDialog } from "@/components/transactions/AddWitnessDialog";
import { ConvertGiftDialog } from "@/components/transactions/ConvertGiftDialog";
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog";
import { OrgAttributionBadge } from "@/components/transactions/OrgAttributionBadge";
import { RecordRemitDialog } from "@/components/transactions/RecordRemitDialog";
import { RecordReturnDialog } from "@/components/transactions/RecordReturnDialog";
import { TransactionAmount } from "@/components/transactions/TransactionAmount";
import { TransactionWitnessList } from "@/components/transactions/TransactionWitnessList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { SupporterBadge } from "@/components/ui/supporter-badge";
import { useTransaction } from "@/hooks/useTransaction";
import { useTransactions } from "@/hooks/useTransactions";
import { useRemoveWitness, useResendWitnessInvitation } from "@/hooks/useWitnesses";
import { formatCurrency } from "@/lib/utils/formatters";
import { AssetCategory, TransactionType, type Witness } from "@/types/__generated__/graphql";
import { authGuard } from "@/utils/auth";

export const Route = createFileRoute("/transactions/$id")({
  component: TransactionDetailPage,
  beforeLoad: (ctx) => authGuard({ location: ctx.location }),
});

function TransactionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [isAddWitnessOpen, setIsAddWitnessOpen] = useState(false);
  const [isConvertGiftOpen, setIsConvertGiftOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRecordReturnOpen, setIsRecordReturnOpen] = useState(false);
  const [isRecordRemitOpen, setIsRecordRemitOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [removingWitnessId, setRemovingWitnessId] = useState<string | null>(null);

  const { transaction, loading, error, refetch } = useTransaction(id);
  const { removeTransaction, removing } = useTransactions();

  const { resend } = useResendWitnessInvitation(() => {
    toast.success("Invitation resent successfully");
    setResendingId(null);
  });

  const { remove: removeWitness } = useRemoveWitness(() => {
    toast.success("Witness removed successfully");
    setRemovingWitnessId(null);
    refetch();
  });

  const handleResendWitness = async (witnessId: string) => {
    setResendingId(witnessId);
    try {
      await resend(witnessId);
    } catch (_err) {
      toast.error("Failed to resend invitation");
      setResendingId(null);
    }
  };

  const handleRemoveWitness = async (witnessId: string) => {
    setRemovingWitnessId(witnessId);
    try {
      await removeWitness(witnessId);
    } catch (_err) {
      toast.error("Failed to remove witness");
      setRemovingWitnessId(null);
    }
  };

  const handleRemove = async () => {
    try {
      await removeTransaction(id);
      toast.success("Transaction removed successfully");
      setIsRemoveDialogOpen(false);
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Failed to remove transaction");
      console.error(err);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold text-red-600">Error loading transaction</h2>
        <p className="text-neutral-600">{error?.message || "Transaction not found"}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  const currentTransaction = transaction;
  const allChildren = (currentTransaction.conversions ?? []).filter(
    (c): c is NonNullable<typeof c> => c !== null && c.status !== "CANCELLED",
  );
  const giftConversions = allChildren.filter(
    (c) => c.type === TransactionType.GiftGiven || c.type === TransactionType.GiftReceived,
  );
  const repayments = allChildren.filter(
    (c) => c.type === TransactionType.RepaymentMade || c.type === TransactionType.RepaymentReceived,
  );
  const remittances = allChildren.filter((c) => c.type === TransactionType.Remitted);
  const witnesses = currentTransaction.witnesses ?? [];
  const history = currentTransaction.history ?? [];

  // A personal-ledger mirror's children are only ever created automatically
  // alongside the org-side child (see TransactionsService.maybeCreatePersonalMirror)
  // — recording one directly here would desync it from the org ledger.
  const isPersonalMirror = !!currentTransaction.orgSourceTransactionId;

  const canConvertToGift =
    !isPersonalMirror &&
    currentTransaction.category === AssetCategory.Funds &&
    (currentTransaction.type === TransactionType.LoanGiven ||
      currentTransaction.type === TransactionType.LoanReceived);

  const canRecordReturn =
    !isPersonalMirror &&
    currentTransaction.category === AssetCategory.Funds &&
    (currentTransaction.type === TransactionType.LoanGiven ||
      currentTransaction.type === TransactionType.LoanReceived) &&
    !!currentTransaction.contact;

  const canRecordRemit =
    !isPersonalMirror &&
    currentTransaction.category === AssetCategory.Funds &&
    currentTransaction.type === TransactionType.Escrowed &&
    !!currentTransaction.contact;

  const totalGifted = giftConversions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalRepaid = repayments.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalRemitted = remittances.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalSettled = totalGifted + totalRepaid + totalRemitted;

  const remainingAmount = Math.max(0, (currentTransaction.amount || 0) - totalSettled);

  return (
    <div className="container mx-auto max-w-3xl p-4 py-8">
      <div className="mb-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center text-sm text-neutral-500 hover:text-emerald-600 transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="flex flex-col gap-3">
          {/* Row 1: title (wraps) + amount (pinned right) */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white leading-tight">
                <span className="capitalize">
                  {currentTransaction.type.toLowerCase().replace(/_/g, " ")}
                </span>{" "}
                {"—"}{" "}
                <span className="inline-flex items-center gap-2 flex-wrap">
                  {currentTransaction.contact?.name || "Personal"}
                  {currentTransaction.contact?.isSupporter && (
                    <SupporterBadge className="h-5 px-1.5" />
                  )}
                  {currentTransaction.status === "COMPLETED" && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      {currentTransaction.type === TransactionType.LoanGiven ||
                      currentTransaction.type === TransactionType.LoanReceived ||
                      currentTransaction.type === TransactionType.Escrowed
                        ? "Settled"
                        : "Completed"}
                    </span>
                  )}
                  {currentTransaction.status === "CANCELLED" && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                      Cancelled
                    </span>
                  )}
                </span>
              </h1>
              <p className="text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-2 text-sm">
                <CalendarDays size={14} />
                {format(new Date(currentTransaction.date as string), "MMMM d, yyyy")}
              </p>
              <OrgAttributionBadge
                orgSourceTransaction={currentTransaction.orgSourceTransaction}
                className="mt-2 w-fit"
              />
            </div>

            {/* Amount — flex-shrink-0 so it never compresses */}
            <div className="text-right flex-shrink-0">
              {currentTransaction.category === AssetCategory.Funds &&
                currentTransaction.amount !== null && (
                  <TransactionAmount
                    type={currentTransaction.type}
                    amount={currentTransaction.amount}
                    currency={currentTransaction.currency}
                    className="text-xl sm:text-2xl"
                  />
                )}
              {totalGifted > 0 && (
                <div className="text-xs sm:text-sm font-medium text-orange-600 dark:text-orange-400 mt-0.5">
                  Gifted: {formatCurrency(totalGifted, currentTransaction.currency)}
                </div>
              )}
              {totalRepaid > 0 && (
                <div className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Repaid: {formatCurrency(totalRepaid, currentTransaction.currency)}
                </div>
              )}
              {totalRemitted > 0 && (
                <div className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Remitted: {formatCurrency(totalRemitted, currentTransaction.currency)}
                </div>
              )}
              {(canConvertToGift || canRecordReturn || canRecordRemit) && totalSettled > 0 && (
                <div className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5">
                  Remaining: {formatCurrency(remainingAmount, currentTransaction.currency)}
                </div>
              )}
              {currentTransaction.category === AssetCategory.Item &&
                currentTransaction.quantity && (
                  <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {currentTransaction.quantity} x {currentTransaction.itemName || "Item"}
                  </div>
                )}
            </div>
          </div>

          {/* Row 2: all actions in one wrapping row */}
          <div className="flex flex-wrap gap-2">
            {canRecordReturn && remainingAmount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                onClick={() => setIsRecordReturnOpen(true)}
              >
                <ArrowRightLeft size={14} />
                Record Return
              </Button>
            )}
            {canRecordRemit && remainingAmount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                onClick={() => setIsRecordRemitOpen(true)}
              >
                <ArrowRightLeft size={14} />
                Record Remittance
              </Button>
            )}
            {canConvertToGift && remainingAmount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950/30"
                onClick={() => setIsConvertGiftOpen(true)}
              >
                <Gift size={14} />
                Convert to Gift
              </Button>
            )}
            {transaction.isMirroredFromProject ? (
              <span className="text-xs text-muted-foreground italic px-1 self-center">
                Synced from project — edit or delete it from the project page instead
              </span>
            ) : transaction.orgSourceTransactionId ? (
              <span className="text-xs text-muted-foreground italic px-1 self-center">
                Recorded on behalf of{" "}
                {transaction.orgSourceTransaction?.organisation?.name ?? "the organisation"} — edit
                or delete it from the organisation's ledger instead
              </span>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setIsEditOpen(true)}
                >
                  <Edit2 size={14} />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setIsRemoveDialogOpen(true)}
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 min-w-0">
        {/* Transaction Details Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
            <FileText size={20} className="text-emerald-600" />
            Details
          </h3>

          <div className="space-y-4">
            {currentTransaction.parentId && (
              <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {currentTransaction.type === TransactionType.RepaymentMade ||
                currentTransaction.type === TransactionType.RepaymentReceived ? (
                  <>
                    This is a repayment linked to{" "}
                    <Link
                      to="/transactions/$id"
                      params={{ id: currentTransaction.parentId }}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      the original loan
                    </Link>
                    .
                  </>
                ) : currentTransaction.type === TransactionType.Remitted ? (
                  <>
                    This is a remittance linked to{" "}
                    <Link
                      to="/transactions/$id"
                      params={{ id: currentTransaction.parentId }}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      the original escrow
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    This transaction is a gift converted from{" "}
                    <Link
                      to="/transactions/$id"
                      params={{ id: currentTransaction.parentId }}
                      className="text-emerald-600 hover:underline font-medium"
                    >
                      another transaction
                    </Link>
                    .
                  </>
                )}
              </div>
            )}

            {currentTransaction.description && (
              <div>
                <span className="block text-sm font-medium text-neutral-500">Description</span>
                <p className="mt-1 text-neutral-900 dark:text-neutral-100">
                  {currentTransaction.description}
                </p>
              </div>
            )}

            {currentTransaction.category === AssetCategory.Item && currentTransaction.itemName && (
              <div>
                <span className="block text-sm font-medium text-neutral-500">Item</span>
                <div className="mt-1 flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
                  <Package size={16} className="text-neutral-400" />
                  {currentTransaction.itemName}
                  {currentTransaction.quantity && (
                    <span className="text-neutral-500">x{currentTransaction.quantity}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gift Conversions */}
        {giftConversions.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
              <Gift size={20} className="text-orange-600" />
              Gift Conversions
            </h3>
            <div className="space-y-3">
              {giftConversions.map((conversion) => (
                <div
                  key={conversion.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(conversion.date as string), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-neutral-500">Gifted back</p>
                  </div>
                  <div className="font-semibold text-orange-600">
                    {formatCurrency(
                      conversion.amount || 0,
                      conversion.currency || currentTransaction.currency,
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Repayments */}
        {repayments.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
              <ArrowRightLeft size={20} className="text-emerald-600" />
              Repayments
            </h3>
            <div className="space-y-3">
              {repayments.map((repayment) => (
                <Link
                  key={repayment.id}
                  to="/transactions/$id"
                  params={{ id: repayment.id }}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(repayment.date as string), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-neutral-500 capitalize">
                      {repayment.type.toLowerCase().replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    {formatCurrency(
                      repayment.amount || 0,
                      repayment.currency || currentTransaction.currency,
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Remittances */}
        {remittances.length > 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-white">
              <ArrowRightLeft size={20} className="text-emerald-600" />
              Remittances
            </h3>
            <div className="space-y-3">
              {remittances.map((remittance) => (
                <Link
                  key={remittance.id}
                  to="/transactions/$id"
                  params={{ id: remittance.id }}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(remittance.date as string), "MMM d, yyyy")}
                    </p>
                    <p className="text-xs text-neutral-500">Remitted</p>
                  </div>
                  <div className="font-semibold text-emerald-600">
                    {formatCurrency(
                      remittance.amount || 0,
                      remittance.currency || currentTransaction.currency,
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Witnesses Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <UserPlus size={20} className="text-emerald-600" />
              Witnesses
            </h3>
            <Button variant="outline" size="sm" onClick={() => setIsAddWitnessOpen(true)}>
              Add Witness
            </Button>
          </div>
          <TransactionWitnessList
            witnesses={witnesses.filter((w): w is NonNullable<typeof w> => w !== null) as Witness[]}
            onResend={handleResendWitness}
            onRemove={handleRemoveWitness}
            isResendingId={resendingId}
            isRemovingId={removingWitnessId}
          />
        </div>

        <EditTransactionDialog
          transaction={currentTransaction}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
        />

        {canRecordReturn && currentTransaction.contact && remainingAmount > 0 && (
          <RecordReturnDialog
            open={isRecordReturnOpen}
            onOpenChange={setIsRecordReturnOpen}
            transaction={{
              id: currentTransaction.id,
              type: currentTransaction.type,
              amount: currentTransaction.amount,
              currency: currentTransaction.currency,
              contactId: currentTransaction.contact.id,
              contactName: currentTransaction.contact.name,
              remainingAmount,
            }}
            onSuccess={refetch}
          />
        )}

        {canRecordRemit && currentTransaction.contact && remainingAmount > 0 && (
          <RecordRemitDialog
            open={isRecordRemitOpen}
            onOpenChange={setIsRecordRemitOpen}
            transaction={{
              id: currentTransaction.id,
              amount: currentTransaction.amount,
              currency: currentTransaction.currency,
              contactId: currentTransaction.contact.id,
              contactName: currentTransaction.contact.name,
              remainingAmount,
            }}
            onSuccess={refetch}
          />
        )}

        <AddWitnessDialog
          isOpen={isAddWitnessOpen}
          onClose={() => setIsAddWitnessOpen(false)}
          transactionId={id}
        />

        <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the transaction if it has no witnesses. If it has
                witnesses, it will be marked as CANCELLED and preserved in the audit log.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                disabled={removing}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {removing ? "Removing..." : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ConvertGiftDialog
          isOpen={isConvertGiftOpen}
          onClose={() => setIsConvertGiftOpen(false)}
          transaction={{
            id: currentTransaction.id,
            amount: remainingAmount,
            currency: currentTransaction.currency,
            type: currentTransaction.type,
            contactId: currentTransaction.contact?.id,
            description: currentTransaction.description,
          }}
          onSuccess={() => refetch()}
        />

        {/* History Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <HistoryViewer
            history={history
              .filter((h): h is NonNullable<typeof h> => h !== null)
              .map((h) => ({
                id: h.id,
                changeType: h.changeType,
                createdAt: String(h.createdAt),
                user: {
                  id: h.user?.id ?? "unknown",
                  name: h.user?.name ?? "Unknown",
                  email: h.user?.email ?? "unknown@example.com",
                },
                previousState: (h.previousState ?? null) as Record<string, unknown> | null,
                newState: (h.newState ?? null) as Record<string, unknown> | null,
              }))}
          />
        </div>
      </div>
    </div>
  );
}
