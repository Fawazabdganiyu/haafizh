import { Plus, Share2 } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { ShareContactDialog } from "@/components/contacts/ShareContactDialog";
import { IntentPicker } from "@/components/transactions/IntentPicker";
import { TransactionTypeHelp } from "@/components/transactions/TransactionTypeHelp";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLoader } from "@/components/ui/page-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type SelectedWitness, WitnessSelector } from "@/components/witnesses/WitnessSelector";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useAuth } from "@/hooks/use-auth";
import { useAmountInput } from "@/hooks/useAmountInput";
import { useContacts } from "@/hooks/useContacts";
import { useProjects } from "@/hooks/useProjects";
import { formatCurrency } from "@/lib/utils/formatters";
import { AssetCategory, TransactionType } from "@/types/__generated__/graphql";

/* -------------------------------------------------------------------------- */
/*  Single source-of-truth schema                                             */
/* -------------------------------------------------------------------------- */

/**
 * Full schema covering BOTH create and edit. Repayment types are accepted at
 * the type level so existing repayments can round-trip through the edit form;
 * the create page filters the dropdown to hide them, and the backend guards
 * against creating a repayment without a parent.
 */
export const transactionFormSchema = z
  .object({
    contactId: z.string().optional(),
    projectId: z.string().optional(),
    type: z.enum([
      TransactionType.LoanGiven,
      TransactionType.LoanReceived,
      TransactionType.RepaymentMade,
      TransactionType.RepaymentReceived,
      TransactionType.GiftGiven,
      TransactionType.GiftReceived,
      TransactionType.AdvancePaid,
      TransactionType.AdvanceReceived,
      TransactionType.DepositPaid,
      TransactionType.DepositReceived,
      TransactionType.Escrowed,
      TransactionType.Remitted,
    ]),
    amount: z.coerce.number().min(0, "Amount must be positive").optional(),
    itemName: z.string().optional(),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1").optional(),
    date: z.string().min(1, "Date is required"),
    description: z.string().optional(),
    category: z.enum([AssetCategory.Funds, AssetCategory.Item]).default(AssetCategory.Funds),
    currency: z.string().min(1, "Currency is required").default("NGN"),
    /**
     * Org-mode only: also record this on the caller's personal ledger when
     * the selected contact is a shared copy of one of their own personal
     * contacts. No-op server-side otherwise, so defaulting true is safe.
     */
    recordOnPersonalLedger: z.boolean().default(true),
    witnesses: z
      .array(
        z.object({
          userId: z.string().optional(),
          invite: z
            .object({
              name: z.string().min(2, "Name is required"),
              email: z.email({ message: "Invalid email" }),
              phoneNumber: z.string().optional().nullable(),
            })
            .optional(),
          displayName: z.string(),
        }),
      )
      .default([]),
  })
  .refine(
    (data) => {
      if (data.category === AssetCategory.Funds) return (data.amount ?? 0) > 0;
      return true;
    },
    { message: "Amount must be positive for funds", path: ["amount"] },
  )
  .refine(
    (data) => {
      if (data.category === AssetCategory.Item) {
        return !!data.itemName && (data.quantity ?? 0) >= 1;
      }
      return true;
    },
    {
      message: "Item name and quantity are required for physical items",
      path: ["itemName"],
    },
  );

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

/* -------------------------------------------------------------------------- */
/*  Type catalog                                                              */
/* -------------------------------------------------------------------------- */

interface TypeOption {
  value: TransactionType;
  label: string;
  /** When true, hidden from the create flow (must be created via a parent action). */
  childOnly?: boolean;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: TransactionType.LoanGiven, label: "Loan Given" },
  { value: TransactionType.LoanReceived, label: "Loan Received" },
  { value: TransactionType.RepaymentMade, label: "Repayment Made", childOnly: true },
  { value: TransactionType.RepaymentReceived, label: "Repayment Received", childOnly: true },
  { value: TransactionType.GiftGiven, label: "Gift Given" },
  { value: TransactionType.GiftReceived, label: "Gift Received" },
  { value: TransactionType.AdvancePaid, label: "Advance Paid" },
  { value: TransactionType.AdvanceReceived, label: "Advance Received" },
  { value: TransactionType.DepositPaid, label: "Deposit Paid" },
  { value: TransactionType.DepositReceived, label: "Deposit Received" },
  { value: TransactionType.Escrowed, label: "Escrowed" },
  { value: TransactionType.Remitted, label: "Remitted" },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export type FormMode = "create" | "edit";
export type LockableField =
  | "type"
  | "contactId"
  | "category"
  | "projectId"
  | "recordOnPersonalLedger";

interface TransactionFormFieldsProps {
  form: UseFormReturn<TransactionFormValues>;
  mode: FormMode;
  /** Fields the user is not allowed to change in the current context. */
  lockedFields?: LockableField[];
  /** Initial amount used to seed the formatted display in edit mode. */
  initialAmount?: number;
}

/**
 * Renders every field of a transaction (category, contact, type, currency,
 * amount/item, date, description, witnesses). Owns no form state — caller
 * passes a `useForm` instance built against `transactionFormSchema`.
 *
 * - In `mode="create"` the type dropdown hides child-only types (repayments).
 * - `lockedFields` disables a field; useful when editing a repayment or a
 *   gift-converted transaction whose type/contact must not change.
 */
export function TransactionFormFields({
  form,
  mode,
  lockedFields = [],
  initialAmount,
}: TransactionFormFieldsProps) {
  const { contacts, loading: loadingContacts } = useContacts();
  const { projects, loading: loadingProjects } = useProjects();
  const { isOrgMode } = useActiveOrg();
  const { user } = useAuth();
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isShareContactDialogOpen, setIsShareContactDialogOpen] = useState(false);
  const [newlyCreatedContact, setNewlyCreatedContact] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const category = form.watch("category");
  const currencyCode = form.watch("currency");

  const { amountDisplay, handleAmountChange, handleBlur } = useAmountInput({
    initialValue: initialAmount,
    currencyCode,
    onChange: (value) =>
      form.setValue("amount", value, { shouldValidate: false, shouldDirty: true }),
  });

  const isLocked = (field: LockableField) => lockedFields.includes(field);

  const visibleTypeOptions = TYPE_OPTIONS.filter((opt) => mode === "edit" || !opt.childOnly);

  const selectedContactId = form.watch("contactId");
  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  // Create-time only — recordOnPersonalLedger can't be retroactively attached
  // to an existing transaction via update(), so there's nothing meaningful
  // to show once the transaction already exists. Also only for the member
  // who actually shared the contact in — the backend silently no-ops the
  // mirror for anyone else (it can't write onto a personal ledger it
  // doesn't own), so showing a checked, promise-labelled toggle to another
  // member would be a lie the UI tells on the backend's behalf.
  const showPersonalLedgerToggle =
    mode === "create" &&
    isOrgMode &&
    !isLocked("recordOnPersonalLedger") &&
    !!selectedContact?.sourceContactId &&
    selectedContact?.sharedBy?.id === user?.id;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLocked("category")}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={AssetCategory.Funds}>Funds (Money)</SelectItem>
                  <SelectItem value={AssetCategory.Item}>Physical Item</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactId"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-1">
                <FormLabel>Contact</FormLabel>
                {!isLocked("contactId") && (
                  <div className="flex items-center gap-1">
                    {isOrgMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setIsShareContactDialogOpen(true)}
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        From My Contacts
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => setIsContactDialogOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Contact
                    </Button>
                  </div>
                )}
              </div>
              <Select
                onValueChange={(value) => {
                  field.onChange(value === "none" ? undefined : value);
                }}
                value={field.value ?? "none"}
                disabled={isLocked("contactId")}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {mode === "edit" && <SelectItem value="none">No Contact</SelectItem>}
                  {loadingContacts && !newlyCreatedContact ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center justify-center gap-2">
                        <BrandLoader size="sm" />
                      </div>
                    </SelectItem>
                  ) : (
                    <>
                      {newlyCreatedContact &&
                        !contacts.some((c) => c.id === newlyCreatedContact.id) && (
                          <SelectItem key={newlyCreatedContact.id} value={newlyCreatedContact.id}>
                            {newlyCreatedContact.name}
                          </SelectItem>
                        )}
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {showPersonalLedgerToggle && (
        <FormField
          control={form.control}
          name="recordOnPersonalLedger"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-xl border border-border/50 p-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <Label className="font-medium">
                  Also record on my personal ledger (I'm personally liable for this)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Writes a matching entry on your own {selectedContact?.name}'s balance, labelled
                  "on behalf of" this organisation.
                </p>
              </div>
            </FormItem>
          )}
        />
      )}

      {category === AssetCategory.Funds && (
        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link to Project (Optional)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                value={field.value ?? "none"}
                disabled={isLocked("projectId")}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {loadingProjects ? (
                    <SelectItem value="loading" disabled>
                      <div className="flex items-center justify-center gap-2">
                        <BrandLoader size="sm" />
                      </div>
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              Type
              <TransactionTypeHelp />
            </FormLabel>
            {mode === "create" && !isLocked("type") ? (
              <FormControl>
                <IntentPicker value={field.value} onChange={field.onChange} />
              </FormControl>
            ) : (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isLocked("type")}
              >
                <FormControl>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {visibleTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {category === AssetCategory.Funds ? (
          <div className="flex items-start gap-4 sm:gap-6 sm:col-span-2">
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="w-24 sm:w-32 shrink-0">
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full px-2 sm:px-3 h-11 sm:h-10">
                        <SelectValue placeholder="NGN" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NGN">NGN (₦)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="AED">AED (د.إ)</SelectItem>
                      <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={() => (
                <FormItem className="flex-1 min-w-0">
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={formatCurrency(0, currencyCode, 0)}
                      value={amountDisplay}
                      onChange={handleAmountChange}
                      onBlur={() => handleBlur(form.getValues("amount") || 0)}
                      className="w-full h-10 px-3 text-sm font-medium"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : (
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="1"
                    placeholder="1"
                    {...field}
                    className="h-10 text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {category === AssetCategory.Item && (
        <FormField
          control={form.control}
          name="itemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Hammer, Laptop, Book"
                  {...field}
                  className="h-10 text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <DatePicker {...field} className="h-10 text-sm" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Add some details about this transaction..."
                className="resize-none min-h-[100px] sm:min-h-[120px] rounded-xl sm:rounded-lg border-muted-foreground/20 focus:border-primary/50 transition-colors"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <FormLabel className="text-base font-bold">Witnesses (Optional)</FormLabel>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
          Add people to witness this transaction. They will receive an invitation to acknowledge it.
        </p>
        <WitnessSelector
          selectedWitnesses={(form.watch("witnesses") ?? []) as SelectedWitness[]}
          onChange={(witnesses) => form.setValue("witnesses", witnesses, { shouldDirty: true })}
          className="mt-2"
        />
      </div>

      <ContactFormDialog
        isOpen={isContactDialogOpen}
        onClose={() => setIsContactDialogOpen(false)}
        onSuccess={(newContact) => {
          setNewlyCreatedContact(newContact);
          setTimeout(() => {
            form.setValue("contactId", newContact.id, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }, 0);
        }}
      />

      <ShareContactDialog
        isOpen={isShareContactDialogOpen}
        onClose={() => setIsShareContactDialogOpen(false)}
        onSuccess={(sharedContact) => {
          setNewlyCreatedContact(sharedContact);
          form.setValue("recordOnPersonalLedger", true, { shouldDirty: true });
          setTimeout(() => {
            form.setValue("contactId", sharedContact.id, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }, 0);
        }}
      />
    </>
  );
}

/**
 * Re-export `Form` so callers can wrap fields without importing from
 * `@/components/ui/form` separately.
 */
export { Form };
