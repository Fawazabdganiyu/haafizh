import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowRight,
  ArrowRightLeft,
  Download,
  Filter,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { ItemsList } from "@/components/items/ItemsList";
import { PersonalEntriesTab } from "@/components/personal-entries/PersonalEntriesTab";
import { OrgAttributionBadge } from "@/components/transactions/OrgAttributionBadge";
import { TransactionAmount } from "@/components/transactions/TransactionAmount";
import { TransactionCharts } from "@/components/transactions/TransactionCharts";
import { TransactionSummaryCard } from "@/components/transactions/TransactionSummaryCard";
import { TransactionTypeBadge } from "@/components/transactions/TransactionTypeBadge";
import { TransactionTypeHelp } from "@/components/transactions/TransactionTypeHelp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/ui/page-loader";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useItems } from "@/hooks/useItems";
import { useTransactionFilters } from "@/hooks/useTransactionFilters";
import { useTransactions } from "@/hooks/useTransactions";
import { AssetCategory } from "@/types/__generated__/graphql";
import { authGuard } from "@/utils/auth";

export const Route = createFileRoute("/transactions/")({
  component: TransactionsPage,
  beforeLoad: (ctx) => authGuard({ location: ctx.location }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "funds",
  }),
});

function TransactionsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(tab);
  const {
    search,
    setSearch,
    types,
    setTypes,
    status,
    setStatus,
    currency,
    setCurrency,
    setDateRange,
    page,
    setPage,
    limit,
    setLimit,
    variables,
  } = useTransactionFilters();
  const { transactions, loading, total } = useTransactions(variables.filter);
  const { items, loading: loadingItems, refetch: refetchItems } = useItems();

  const filteredTransactions = transactions;

  const handleExport = () => {
    if (activeTab === "funds") {
      const headers = ["Date", "Type", "Contact", "Description", "Amount", "Status"];
      const csvContent = [
        headers.join(","),
        ...filteredTransactions.map((tx) =>
          [
            format(new Date(tx.date as string), "yyyy-MM-dd"),
            tx.type,
            tx.contact?.name || "Unknown",
            `"${tx.description || ""}"`,
            tx.amount || 0,
            "Completed",
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_export_${format(new Date(), "yyyyMMdd")}.csv`;
      link.click();
    } else {
      const headers = ["Last Updated", "Item Name", "Quantity", "Contact", "Status"];
      const csvContent = [
        headers.join(","),
        ...items.map((item) =>
          [
            format(new Date(item.lastUpdated), "yyyy-MM-dd"),
            `"${item.itemName}"`,
            item.quantity,
            item.contactName || "Unknown",
            item.status,
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `items_export_${format(new Date(), "yyyyMMdd")}.csv`;
      link.click();
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="container mx-auto px-4 py-8 space-y-8 overflow-x-hidden"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex-1 min-w-0 w-full">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            The Wathīqah Ledger
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base truncate">
            Manage your transaction history.
          </p>
        </div>
        <div className="flex gap-3 w-full lg:w-auto shrink-0 relative z-10">
          <Button asChild className="flex-1 h-12 sm:h-10 lg:flex-none lg:w-auto">
            <Link
              to={activeTab === "funds" ? "/transactions/new" : "/items/new"}
              search={{ contactId: undefined }}
            >
              <Plus className="w-4 h-4 mr-2" /> New {activeTab === "funds" ? "Transaction" : "Item"}
            </Link>
          </Button>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b lg:border-none lg:bg-transparent lg:static lg:p-0 flex justify-center">
        <TabsList className="grid w-full max-w-[500px] grid-cols-4 h-12 p-1.5 bg-muted/50 shadow-sm lg:shadow-none">
          <TabsTrigger value="funds" className="flex items-center gap-2 py-2">
            <ArrowRightLeft className="w-4 h-4" />
            Funds
          </TabsTrigger>
          <TabsTrigger value="items" className="flex items-center gap-2 py-2">
            <Package className="w-4 h-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 py-2">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-2 py-2">
            Personal
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="space-y-4">
        <TabsContent value="funds" className="space-y-4">
          {/* Interactive Summary Card */}
          <TransactionSummaryCard onPeriodFilterChange={setDateRange} />

          {/* Transactions Table Card */}
          <Card className="rounded-[32px] border-border/50 overflow-hidden shadow-sm">
            <CardHeader className="p-6 border-b border-border/30 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black tracking-tight uppercase opacity-60">
                  Transaction History
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[10px] font-bold uppercase tracking-wider"
                  onClick={handleExport}
                >
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export
                </Button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description or contact..."
                    className="pl-8 w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                  <Select
                    value={types[0] ?? "ALL"}
                    onValueChange={(v) =>
                      setTypes(v === "ALL" ? [] : [v as (typeof types)[number]])
                    }
                  >
                    <SelectTrigger className="flex-1 sm:w-[150px]">
                      <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Filter Type" />
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
                    <SelectTrigger className="flex-1 sm:w-[150px]">
                      <SlidersHorizontal className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="flex-1 sm:w-[150px]">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-medium">$</span>
                        <SelectValue placeholder="Currency" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Currencies</SelectItem>
                      <SelectItem value="NGN">NGN (₦)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="AED">AED (د.إ)</SelectItem>
                      <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 border-b border-border/30">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12 pl-6">
                        Date
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12">
                        Contact
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
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12">
                        Witnesses
                      </TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-12 text-right">
                        Amount / Item
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-20">
                          <div className="flex justify-center">
                            <BrandLoader size="sm" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-20">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                              <ArrowRightLeft className="w-8 h-8" />
                            </div>
                            <p className="font-bold text-sm">
                              No transactions found matching your criteria.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isCreator = user?.id === tx.createdBy?.id;
                        return (
                          <TableRow
                            key={tx.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors group border-b border-border/30 last:border-0"
                            onClick={() =>
                              navigate({
                                to: "/transactions/$id",
                                params: { id: tx.id },
                              })
                            }
                          >
                            <TableCell className="font-medium text-xs text-muted-foreground/80 pl-6">
                              {format(new Date(tx.date as string), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-medium text-foreground flex items-center gap-1.5">
                                  {isCreator
                                    ? tx.contact?.name || (
                                        <span className="text-muted-foreground italic">
                                          Personal
                                        </span>
                                      )
                                    : tx.createdBy?.name}
                                  {(isCreator
                                    ? tx.contact?.isSupporter
                                    : tx.createdBy?.isSupporter) && (
                                    <SupporterBadge className="h-4 px-1 text-[9px]" />
                                  )}
                                </span>
                                {!isCreator && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                                    <UserCircle className="w-2.5 h-2.5" />
                                    SHARED
                                  </span>
                                )}
                                <OrgAttributionBadge
                                  orgSourceTransaction={tx.orgSourceTransaction}
                                  className="w-fit"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <TransactionTypeBadge type={tx.type} />
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-xs text-muted-foreground/90"
                              title={tx.description || undefined}
                            >
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
                            <TableCell>
                              <div className="flex -space-x-2">
                                {tx.witnesses && tx.witnesses.length > 0 ? (
                                  tx.witnesses
                                    .filter((w) => w !== null)
                                    .map((w) => (
                                      <div
                                        key={w.id}
                                        className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] text-white ${
                                          w.status === "ACKNOWLEDGED"
                                            ? "bg-green-500"
                                            : w.status === "DECLINED"
                                              ? "bg-red-500"
                                              : "bg-yellow-500"
                                        }`}
                                        title={`Status: ${w.status}`}
                                      >
                                        {w.status[0]}
                                      </div>
                                    ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
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
                                />
                              )}
                            </TableCell>
                            <TableCell className="pr-6">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden space-y-3 p-4">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <BrandLoader size="sm" />
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 opacity-20">
                      <ArrowRightLeft className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-sm">
                      No transactions found matching your criteria.
                    </p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isCreator = user?.id === tx.createdBy?.id;
                    return (
                      <Card
                        key={tx.id}
                        className="overflow-hidden hover:border-primary/30 transition-all active:scale-[0.98] border-border/50 cursor-pointer"
                        onClick={() =>
                          navigate({
                            to: "/transactions/$id",
                            params: { id: tx.id },
                          })
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {format(new Date(tx.date as string), "MMM d, yyyy")}
                              </p>
                              <div className="flex flex-col gap-1">
                                <p className="font-semibold text-foreground">
                                  {isCreator
                                    ? tx.contact?.name || <span className="italic">Personal</span>
                                    : tx.createdBy?.name}
                                </p>
                                {!isCreator && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 w-fit">
                                    <UserCircle className="w-2.5 h-2.5" />
                                    SHARED
                                  </span>
                                )}
                                <OrgAttributionBadge
                                  orgSourceTransaction={tx.orgSourceTransaction}
                                  className="w-fit"
                                />
                              </div>
                            </div>
                            <TransactionTypeBadge type={tx.type} />
                          </div>

                          <div className="flex justify-between items-end mt-4">
                            <div className="flex-1 min-w-0 mr-4">
                              {tx.category === AssetCategory.Item ? (
                                <div className="flex items-center gap-1.5 text-sm font-medium">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="truncate">
                                    {tx.quantity}x {tx.itemName}
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground truncate">
                                  {tx.description || "No description"}
                                </p>
                              )}
                            </div>
                            <div className="whitespace-nowrap">
                              {tx.category === AssetCategory.Item ? (
                                <span className="text-muted-foreground font-normal italic text-xs">
                                  Physical Item
                                </span>
                              ) : (
                                <TransactionAmount
                                  type={tx.type}
                                  amount={tx.amount}
                                  currency={tx.currency}
                                />
                              )}
                            </div>
                          </div>

                          {tx.witnesses && tx.witnesses.length > 0 && (
                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Witnesses</span>
                              <div className="flex -space-x-1.5">
                                {tx.witnesses
                                  .filter((w) => w !== null)
                                  .map((w) => (
                                    <div
                                      key={w.id}
                                      className={`w-5 h-5 rounded-full border-2 border-background flex items-center justify-center text-[8px] text-white ${
                                        w.status === "ACKNOWLEDGED"
                                          ? "bg-green-500"
                                          : w.status === "DECLINED"
                                            ? "bg-red-500"
                                            : "bg-yellow-500"
                                      }`}
                                      title={`Status: ${w.status}`}
                                    >
                                      {w.status[0]}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              <Pagination
                total={total}
                page={page}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <ItemsList items={items} isLoading={loadingItems} onRefresh={refetchItems} />
        </TabsContent>

        <TabsContent value="analytics">
          <TransactionCharts />
        </TabsContent>

        <TabsContent value="personal">
          <PersonalEntriesTab />
        </TabsContent>
      </div>
    </Tabs>
  );
}
