import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useMemo } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Form,
  type LockableField,
  TransactionFormFields,
  type TransactionFormValues,
  transactionFormSchema,
} from "@/components/transactions/TransactionFormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTransaction } from "@/hooks/useTransaction";
import {
  AssetCategory,
  type TransactionQuery,
  TransactionType,
} from "@/types/__generated__/graphql";

interface EditTransactionDialogProps {
  transaction: NonNullable<TransactionQuery["transaction"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REPAYMENT_TYPES: TransactionType[] = [
  TransactionType.RepaymentMade,
  TransactionType.RepaymentReceived,
];

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: EditTransactionDialogProps) {
  const { updateTransaction, updating } = useTransaction(transaction.id);

  const lockedFields = useMemo<LockableField[]>(() => {
    const locks: LockableField[] = [];
    const isRepayment = REPAYMENT_TYPES.includes(transaction.type as TransactionType);
    const isConverted = !!transaction.parentId;
    if (isRepayment || isConverted) {
      locks.push("type", "contactId", "category");
    }
    if (transaction.projectTransactionId) {
      locks.push("projectId");
    }
    // Create-time only — a mirror can't be retroactively attached via update().
    locks.push("recordOnPersonalLedger");
    return locks;
  }, [transaction.type, transaction.parentId, transaction.projectTransactionId]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema) as Resolver<TransactionFormValues>,
    defaultValues: {
      type: transaction.type as TransactionFormValues["type"],
      contactId: transaction.contact?.id ?? undefined,
      projectId: transaction.projectTransaction?.projectId ?? undefined,
      amount: transaction.amount ?? 0,
      itemName: transaction.itemName ?? "",
      quantity: transaction.quantity ?? 1,
      date: format(new Date(transaction.date), "yyyy-MM-dd"),
      description: transaction.description ?? "",
      category: transaction.category,
      currency: transaction.currency ?? "NGN",
      witnesses: [],
    },
  });

  async function onSubmit(values: TransactionFormValues) {
    try {
      const witnessUserIds = values.witnesses
        .filter((w) => w.userId)
        .map((w) => w.userId as string);
      const witnessInvites = values.witnesses
        .map((w) => w.invite)
        .filter((invite): invite is NonNullable<typeof invite> => !!invite)
        .map((invite) => ({
          ...invite,
          email: invite.email.trim().toLowerCase(),
        }));

      await updateTransaction({
        id: transaction.id,
        category: values.category,
        type: values.type,
        amount: values.category === AssetCategory.Funds ? values.amount : undefined,
        itemName: values.category === AssetCategory.Item ? values.itemName : undefined,
        quantity: values.category === AssetCategory.Item ? values.quantity : undefined,
        date: new Date(values.date).toISOString(),
        description: values.description,
        contactId: values.contactId || undefined,
        projectId:
          values.category === AssetCategory.Funds ? values.projectId || undefined : undefined,
        currency: values.currency,
        witnessUserIds,
        witnessInvites,
      });
      toast.success("Transaction updated successfully");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TransactionFormFields
              form={form}
              mode="edit"
              lockedFields={lockedFields}
              initialAmount={transaction.amount ?? 0}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
