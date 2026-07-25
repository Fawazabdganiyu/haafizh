import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { format } from "date-fns";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Form,
  TransactionFormFields,
  type TransactionFormValues,
  transactionFormSchema,
} from "@/components/transactions/TransactionFormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransactions } from "@/hooks/useTransactions";
import { AssetCategory, TransactionType } from "@/types/__generated__/graphql";

export const Route = createFileRoute("/transactions/new")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      contactId: search.contactId as string | undefined,
    };
  },
  component: NewTransactionPage,
});

function NewTransactionPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/transactions/new" });
  const { createTransaction, creating } = useTransactions();

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema) as Resolver<TransactionFormValues>,
    defaultValues: {
      type: TransactionType.LoanGiven,
      contactId: search.contactId,
      date: format(new Date(), "yyyy-MM-dd"),
      category: AssetCategory.Funds,
      amount: 0,
      currency: "NGN",
      description: "",
      itemName: "",
      quantity: 1,
      witnesses: [],
      recordOnPersonalLedger: true,
    },
  });

  async function onSubmit(values: TransactionFormValues) {
    if (!values.contactId) {
      form.setError("contactId", { message: "A contact is required" });
      return;
    }

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

      await createTransaction({
        contactId: values.contactId,
        projectId: values.category === AssetCategory.Funds ? values.projectId : undefined,
        type: values.type,
        category: values.category,
        currency: values.currency,
        date: new Date(values.date).toISOString(),
        description: values.description,
        amount: values.category === AssetCategory.Funds ? values.amount : undefined,
        itemName: values.category === AssetCategory.Item ? values.itemName : undefined,
        quantity: values.category === AssetCategory.Item ? values.quantity : undefined,
        witnessUserIds,
        witnessInvites,
        recordOnPersonalLedger: values.recordOnPersonalLedger,
      });
      toast.success("Transaction created successfully");
      navigate({
        to: "/transactions",
        search: { tab: values.category === AssetCategory.Item ? "items" : "funds" },
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="container mx-auto py-6 sm:py-10 px-4 sm:px-0 max-w-2xl">
      <Card className="border-none sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-0 sm:px-6">
          <CardTitle className="text-xl sm:text-2xl font-bold">Create New Transaction</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <TransactionFormFields form={form} mode="create" />

              <Button
                type="submit"
                className="w-full h-12 sm:h-11 rounded-md text-base font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                isLoading={creating}
              >
                Create Transaction
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
