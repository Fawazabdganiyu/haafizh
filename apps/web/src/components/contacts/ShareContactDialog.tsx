import { useMutation, useQuery } from "@apollo/client/react";
import { Search, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/ui/page-loader";
import { GET_CONTACTS, GET_SHAREABLE_CONTACTS } from "@/lib/apollo/queries/contacts";
import { PROMOTE_CONTACT_TO_ORG_MUTATION } from "@/lib/apollo/queries/organisations";

interface ShareContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the new org-scoped copy once sharing succeeds. */
  onSuccess: (contact: { id: string; name: string }) => void;
}

/**
 * "From my contacts" — lets an org member pick one of their own personal
 * contacts to share into the active org, instead of recreating it from
 * scratch. Wraps `promoteContactToOrg`, which creates a linked org-scoped
 * copy (see organisations.service.ts) rather than moving the original.
 */
export function ShareContactDialog({ isOpen, onClose, onSuccess }: ShareContactDialogProps) {
  const [search, setSearch] = useState("");

  const { data, loading } = useQuery(GET_SHAREABLE_CONTACTS, {
    variables: { filter: { search: search || undefined } },
    skip: !isOpen,
    fetchPolicy: "cache-and-network",
  });

  const [promoteContact, { loading: sharing }] = useMutation(PROMOTE_CONTACT_TO_ORG_MUTATION, {
    refetchQueries: [{ query: GET_CONTACTS }, { query: GET_SHAREABLE_CONTACTS }],
  });

  const [sharingId, setSharingId] = useState<string | null>(null);

  const contacts = data?.shareableContacts.items ?? [];

  const handleShare = async (contactId: string) => {
    setSharingId(contactId);
    try {
      const result = await promoteContact({ variables: { contactId } });
      const shared = result.data?.promoteContactToOrg;
      if (shared) {
        onSuccess({ id: shared.id, name: `${shared.firstName} ${shared.lastName}`.trim() });
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSharingId(null);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share a Personal Contact</DialogTitle>
          <DialogDescription>
            Pick a contact from your personal list to use for this organisation transaction. Other
            members will see it as a normal org contact — your personal ledger stays private.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your contacts..."
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <BrandLoader size="sm" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search
                ? "No matching contacts."
                : "All your personal contacts are already shared into this organisation, or you have none yet."}
            </p>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.email || contact.phoneNumber || "No contact info"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  disabled={sharing}
                  isLoading={sharingId === contact.id}
                  onClick={() => handleShare(contact.id)}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
