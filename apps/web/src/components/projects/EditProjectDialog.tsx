import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAmountInput } from "@/hooks/useAmountInput";
import { formatCurrency } from "@/lib/utils/formatters";
import type { UpdateProjectInput } from "@/types/__generated__/graphql";

interface EditProjectDialogProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    budget?: number | null;
    currency: string;
    status: string;
  };
  onUpdate: (input: UpdateProjectInput) => Promise<unknown>;
  updating: boolean;
  trigger?: ReactNode;
}

export function EditProjectDialog({
  project,
  onUpdate,
  updating,
  trigger,
}: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [budget, setBudget] = useState(project.budget?.toString() ?? "");
  const [currency, setCurrency] = useState(project.currency);
  const [status, setStatus] = useState(project.status);

  const {
    amountDisplay: budgetDisplay,
    handleAmountChange: handleBudgetChange,
    handleBlur,
    reset: resetBudget,
  } = useAmountInput({
    currencyCode: currency,
    initialValue: project.budget ?? 0,
    onChange: (val) => setBudget(val > 0 ? val.toString() : ""),
  });

  // Re-sync local state when project prop changes (e.g. after a save + refetch).
  // Also resets the budget input's "user has edited" flag on close, so a
  // cleared-then-cancelled edit doesn't leave the field blank next time the
  // dialog opens for the same (or a different) project.
  useEffect(() => {
    if (open) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setBudget(project.budget?.toString() ?? "");
    setCurrency(project.currency);
    setStatus(project.status);
    resetBudget();
  }, [project, open, resetBudget]);

  const nameId = useId();
  const descriptionId = useId();
  const budgetId = useId();
  const currencyId = useId();
  const statusId = useId();

  const handleCurrencyChange = (v: string) => {
    setCurrency(v);
    resetBudget();
    setBudget("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    try {
      await onUpdate({
        id: project.id,
        name: name.trim(),
        description: description.trim() || undefined,
        budget: budget ? Number.parseFloat(budget) : undefined,
        currency,
        status: status as UpdateProjectInput["status"],
      });
      toast.success("Project updated");
      setOpen(false);
    } catch {
      toast.error("Failed to update project");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Edit Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor={nameId}>
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kitchen Renovation"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={budgetId}>Budget</Label>
              <Input
                id={budgetId}
                type="text"
                inputMode="decimal"
                placeholder={formatCurrency(0, currency, 0)}
                value={budgetDisplay}
                onChange={handleBudgetChange}
                onBlur={() => handleBlur(Number.parseFloat(budget) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={currencyId}>Currency</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger id={currencyId}>
                  <SelectValue />
                </SelectTrigger>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={statusId}>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id={statusId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={updating}>
              {updating ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
