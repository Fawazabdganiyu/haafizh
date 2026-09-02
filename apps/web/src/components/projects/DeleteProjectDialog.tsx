import { useLazyQuery } from "@apollo/client/react";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { GET_PROJECT_LINKED_CONTACTS } from "@/lib/apollo/queries/projects";
import type {
  GetProjectLinkedContactsQuery,
  GetProjectLinkedContactsQueryVariables,
} from "@/types/__generated__/graphql";

interface DeleteProjectDialogProps {
  projectId: string;
  projectName: string;
  onDelete: () => Promise<unknown>;
  onDeleted?: () => void;
  deleting?: boolean;
  trigger?: ReactNode;
}

export function DeleteProjectDialog({
  projectId,
  projectName,
  onDelete,
  onDeleted,
  deleting,
  trigger,
}: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);

  // Fetched fresh on open (not derived from the paginated transactions list)
  // so the linked-contact warning is accurate even when a project has more
  // transactions than the currently loaded page.
  const [fetchLinkedContacts, { data, loading: loadingContacts }] = useLazyQuery<
    GetProjectLinkedContactsQuery,
    GetProjectLinkedContactsQueryVariables
  >(GET_PROJECT_LINKED_CONTACTS, { fetchPolicy: "network-only" });

  const linkedContacts = data?.project?.linkedContacts ?? [];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) fetchLinkedContacts({ variables: { id: projectId } });
  };

  const handleConfirm = async () => {
    try {
      await onDelete();
      toast.success(`"${projectName}" deleted`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8 text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 active:bg-rose-100"
            aria-label="Delete project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{projectName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This permanently deletes the project and all of its transactions. This cannot be
                undone. Transactions with witnesses or repayment history will block this action.
              </p>
              {!loadingContacts && linkedContacts.length > 0 && (
                <p className="text-amber-700 dark:text-amber-500">
                  This will also remove the linked entries from{" "}
                  {linkedContacts.length === 1
                    ? `${linkedContacts[0].name}'s`
                    : `${linkedContacts.length} contacts':`}{" "}
                  ledger{linkedContacts.length > 1 ? "s" : ""}
                  {linkedContacts.length > 1 &&
                    ` (${linkedContacts.map((c) => c.name).join(", ")})`}
                  .
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
