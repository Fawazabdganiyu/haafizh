import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CornerDownRight,
  Download,
  Filter,
  FolderOpen,
  Package,
  Plus,
  ShieldCheck,
  UserCircle,
  UserPlus,
} from "lucide-react";
import { ContactSummaryCards } from "@/components/contacts/ContactSummaryCards";
import { OrgAttributionBadge } from "@/components/transactions/OrgAttributionBadge";
import { TransactionAmount } from "@/components/transactions/TransactionAmount";
import { TransactionTypeBadge } from "@/components/transactions/TransactionTypeBadge";
import { TransactionTypeHelp } from "@/components/transactions/TransactionTypeHelp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLoader, PageLoader } from "@/components/ui/page-loader";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupporterBadge } from "@/components/ui/supporter-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { GET_CONTACT, GET_CONTACTS, INVITE_CONTACT } from "@/lib/apollo/queries/contacts";
import { GET_TRANSACTIONS } from "@/lib/apollo/queries/transactions";
import { groupTransactionActivity } from "@/lib/utils/groupTransactionActivity";
import { AssetCategory, type Transaction } from "@/types/__generated__/graphql";
import { authGuard } from "@/utils/auth";

export const Route = createFileRoute("/contacts/$contactId")({
  component: ContactDetailsPage,
  beforeLoad: (ctx) => {
    // "new" is not a real contact ID — redirect to the contacts list with the
    // add-contact dialog open. This handles direct navigation to /contacts/new
    // before the dedicated new.tsx route file is registered in the route tree.
    if (ctx.params.contactId === "new") {
      throw redirect({ to: "/contacts", search: { new: true } });
    }
    return authGuard({ location: ctx.location });
  },
});

function ContactDetailsPage() {
  const navigate = useNavigate();
  const { contactId } = Route.useParams();
  const {
    types,
    setTypes,
    status,
    setStatus,
    setDateRange,
    page,
    setPage,
    limit,
    setLimit,
    variables,
  } = useTransactionFilters();

  const {
    data: contactData,
    loading: contactLoading,
    error: contactError,
  } = useQuery(GET_CONTACT, {
    variables: { id: contactId },
  });

  const { data: txData, loading: txLoading } = useQuery(GET_TRANSACTIONS, {
    variables: {
      filter: {
        ...variables.filter,
        contactId,
      },
    },
    fetchPolicy: "cache-and-network",
  });

  const [inviteContact] = useMutation(INVITE_CONTACT, {
    refetchQueries: [{ query: GET_CONTACT, variables: { id: contactId } }, { query: GET_CONTACTS }],
  });

  const handleInvite = async () => {
    try {
      await inviteContact({ variables: { contactId } });
    } catch (err) {
      console.error("Failed to invite contact:", err);
    }
  };

  const { user } = useAuth();

  if (contactLoading) return <PageLoader />;
  if (contactError)
    return <div className="p-8 text-center text-red-500">Error: {contactError.message}</div>;
  if (!contactData?.contact) return <div className="p-8 text-center">Contact not found</div>;

  const contact = contactData.contact;
  const transactions = (txData?.transactions.items as Transaction[]) || [];
  const activityRows = groupTransactionActivity(transactions);
  const summary = txData?.transactions.summary;

  const exportToCSV = (items: Transaction[], contactName: string) => {
    const headers = ["Date", "Type", "Description", "Amount", "Currency", "Category"];
    const csvData = items.map((tx) => [
      format(new Date(tx.date), "yyyy-MM-dd"),
      tx.type,
      tx.description ||
        (tx.category === AssetCategory.Item ? `${tx.quantity}x ${tx.itemName}` : "-"),
      tx.amount,
      tx.currency || "NGN",
      tx.category,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvData.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `transactions_${contactName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-start gap-3 min-w-0">
        {/* Back button */}
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
          <Link to="/contacts" search={{ new: undefined }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>

        {/* Contact info + primary action — all left-aligned */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{contact.name}</h1>
            {contact.isSupporter && <SupporterBadge />}
            {contact.isOnPlatform ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1.5 py-1.5 px-3 shadow-sm animate-in fade-in zoom-in duration-300"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="font-bold text-xs">Platform Member</span>
              </Badge>
            ) : contact.hasPendingInvitation ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1.5 py-1.5 px-3 shadow-sm animate-in fade-in zoom-in duration-300"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="font-bold text-xs">Invitation Sent</span>
              </Badge>
            ) : contact.email ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleInvite}
                className="h-8 px-3 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite
              </Button>
            ) : (
              <Badge
                variant="outline"
                className="bg-muted/50 text-muted-foreground border-border/50 flex items-center gap-1.5 py-1.5 px-3 italic opacity-70 text-xs"
              >
                Add Email to Invite
              </Badge>
            )}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-3 text-sm mt-1">
            {contact.email && <span className="truncate">{contact.email}</span>}
            {contact.phoneNumber && <span>{contact.phoneNumber}</span>}
          </div>
          {contact.sourceContactId && contact.sharedBy && (
            <p className="text-xs text-muted-foreground italic mt-1">
              Shared by {contact.sharedBy.firstName} {contact.sharedBy.lastName}
            </p>
          )}
          {/* Primary action — left-aligned, sits naturally below contact details */}
          <Button asChild size="sm" className="mt-3">
            <Link to="/transactions/new" search={{ contactId: contact.id }}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Transaction
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <ContactSummaryCards
        summary={summary}
        contactBalance={contact.balance}
        loading={txLoading}
        onPeriodFilterChange={setDateRange}
      />

      {/* Transactions Table */}
      <Card className="rounded-[32px] border-border/50 overflow-hidden shadow-sm">
        <CardHeader className="p-6 border-b border-border/30 space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black tracking-tight uppercase opacity-60">
              Transaction History
            </CardTitle>
            {transactions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-wider"
                onClick={() => exportToCSV(transactions, contact.name)}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={types[0] ?? "ALL"}
              onValueChange={(v) => setTypes(v === "ALL" ? [] : [v as (typeof types)[number]])}
            >
              <SelectTrigger className="w-[140px] h-8">
                <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="LOAN_GIVEN">Loan Given</SelectItem>
                <SelectItem value="LOAN_RECEIVED">Loan Received</SelectItem>
                <SelectItem value="REPAYMENT_MADE">Repayment Made</SelectItem>
                <SelectItem value="REPAYMENT_RECEIVED">Repayment Received</SelectItem>
                <SelectItem value="GIFT_GIVEN">Gift Given</SelectItem>
                <SelectItem value="GIFT_RECEIVED">Gift Received</SelectItem>
                <SelectItem value="ADVANCE_PAID">Advance Paid</SelectItem>
                <SelectItem value="ADVANCE_RECEIVED">Advance Received</SelectItem>
                <SelectItem value="DEPOSIT_PAID">Deposit Paid</SelectItem>
                <SelectItem value="DEPOSIT_RECEIVED">Deposit Received</SelectItem>
                <SelectItem value="ESCROWED">Escrowed</SelectItem>
                <SelectItem value="REMITTED">Remitted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txLoading ? (
            <div className="flex justify-center py-20">
              <BrandLoader size="sm" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                <Package className="w-8 h-8" />
              </div>
              <p className="font-bold text-sm">No transactions found with this contact.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-b border-border/30">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12 pl-6">
                        Date
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12">
                        <div className="flex items-center gap-1">
                          Type
                          <TransactionTypeHelp />
                        </div>
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12">
                        Description
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12 text-right">
                        Amount
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityRows.map(({ tx, depth, isOrphan }) => {
                      const isCreator = user?.id === tx.createdBy?.id;
                      const isChild = depth === 1;
                      return (
                        <TableRow
                          key={tx.id}
                          className={`group transition-colors cursor-pointer border-b border-border/30 last:border-0 ${
                            isChild ? "bg-muted/20 hover:bg-muted/40" : "hover:bg-muted/50"
                          }`}
                          onClick={() =>
                            navigate({
                              to: "/transactions/$id",
                              params: { id: tx.id },
                            })
                          }
                        >
                          <TableCell
                            className={`font-medium text-xs text-muted-foreground/80 ${
                              isChild ? "pl-12" : "pl-6"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              {isChild && (
                                <CornerDownRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                              )}
                              {format(new Date(tx.date as string), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <TransactionTypeBadge type={tx.type} />
                              {isOrphan && (
                                <span className="text-[9px] font-bold text-muted-foreground/70 italic">
                                  ↳ for earlier transaction
                                </span>
                              )}
                              {!isCreator && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                                  <UserCircle className="w-2.5 h-2.5" />
                                  SHARED
                                </span>
                              )}
                              {tx.projectTransaction && (
                                <Link
                                  to="/projects/$projectId"
                                  params={{ projectId: tx.projectTransaction.projectId }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/30 w-fit"
                                >
                                  <FolderOpen className="w-2.5 h-2.5" />
                                  {tx.projectTransaction.project?.name ?? "Project"}
                                </Link>
                              )}
                              <OrgAttributionBadge orgSourceTransaction={tx.orgSourceTransaction} />
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground/90">
                            {tx.category === AssetCategory.Item ? (
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {tx.quantity}x {tx.itemName}
                                </span>
                              </div>
                            ) : (
                              tx.description || "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.category === AssetCategory.Item ? (
                              <span className="text-muted-foreground font-normal italic text-xs">
                                Physical Item
                              </span>
                            ) : (
                              <TransactionAmount
                                type={tx.type}
                                amount={tx.amount}
                                currency={tx.currency}
                                className="text-sm"
                              />
                            )}
                          </TableCell>
                          <TableCell className="pr-6">
                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-3 p-4">
                {activityRows.map(({ tx, depth, isOrphan }) => {
                  const isCreator = user?.id === tx.createdBy?.id;
                  const isChild = depth === 1;
                  return (
                    <Card
                      key={tx.id}
                      className={`overflow-hidden hover:border-primary/30 transition-all active:scale-[0.98] ${
                        isChild
                          ? "ml-6 border-l-2 border-l-primary/30 border-border/30 bg-muted/20"
                          : "border-border/50"
                      }`}
                      onClick={() =>
                        navigate({
                          to: "/transactions/$id",
                          params: { id: tx.id },
                        })
                      }
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              {isChild && <CornerDownRight className="h-2.5 w-2.5" />}
                              {format(new Date(tx.date as string), "MMM d, yyyy")}
                            </p>
                            <div className="flex flex-col gap-1">
                              <TransactionTypeBadge type={tx.type} className="w-fit" />
                              {isOrphan && (
                                <span className="text-[9px] font-bold text-muted-foreground/70 italic">
                                  ↳ for earlier transaction
                                </span>
                              )}
                              {!isCreator && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                                  <UserCircle className="w-2 h-2" />
                                  SHARED
                                </span>
                              )}
                              {tx.projectTransaction && (
                                <Link
                                  to="/projects/$projectId"
                                  params={{ projectId: tx.projectTransaction.projectId }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[9px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded border border-violet-100 dark:border-violet-900/30 w-fit"
                                >
                                  <FolderOpen className="w-2 h-2" />
                                  {tx.projectTransaction.project?.name ?? "Project"}
                                </Link>
                              )}
                              <OrgAttributionBadge orgSourceTransaction={tx.orgSourceTransaction} />
                            </div>
                          </div>
                          <div className="text-right">
                            {tx.category === AssetCategory.Item ? (
                              <div className="text-[10px] font-medium text-muted-foreground italic">
                                Physical Item
                              </div>
                            ) : (
                              <TransactionAmount
                                type={tx.type}
                                amount={tx.amount}
                                currency={tx.currency}
                                className="text-sm"
                              />
                            )}
                          </div>
                        </div>
                        {(tx.description || tx.category === AssetCategory.Item) && (
                          <div className="text-xs text-muted-foreground/90 line-clamp-1 border-t border-border/30 pt-2">
                            {tx.category === AssetCategory.Item ? (
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3 w-3" />
                                <span>
                                  {tx.quantity}x {tx.itemName}
                                </span>
                              </div>
                            ) : (
                              tx.description
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
          <Pagination
            total={txData?.transactions.total ?? 0}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
