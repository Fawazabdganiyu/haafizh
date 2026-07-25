import { Link } from "@tanstack/react-router";
import { MoreVertical, Wallet } from "lucide-react";
import { BalanceIndicator } from "@/components/ui/balance-indicator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupporterBadge } from "@/components/ui/supporter-badge";
import { cn } from "@/lib/utils";

export interface ContactSummary {
  id: string;
  name?: string | null;
  balance: number;
  email?: string | null;
  phoneNumber?: string | null;
  isOnPlatform?: boolean;
  isSupporter?: boolean;
  hasPendingInvitation?: boolean;
  lentCount?: number;
  borrowedCount?: number;
  /** Set only when this org contact is a shared copy of a personal contact. */
  sourceContactId?: string | null;
  sharedBy?: { firstName?: string | null; lastName?: string | null } | null;
}

interface ContactCardProps<T extends ContactSummary = ContactSummary> {
  contact: T;
  onEdit?: (contact: T) => void;
  onDelete?: (contact: T) => void;
  onInvite?: (id: string) => void;
  className?: string;
  showActions?: boolean;
  compact?: boolean;
}

export function ContactCard<T extends ContactSummary>({
  contact,
  onEdit,
  onDelete,
  onInvite,
  className,
  showActions = true,
}: ContactCardProps<T>) {
  const initial = (contact.name ?? "?").charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "group relative bg-card border border-border/50 rounded-[20px] p-4 transition-all duration-500",
        "hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 hover:border-primary/30 active:scale-[0.98]",
        className,
      )}
    >
      {/* Top row: avatar + name/info + menu */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center text-primary-foreground font-black text-lg shadow-lg shadow-primary/20 group-hover:scale-105 group-hover:-rotate-3 transition-all duration-500">
            {initial}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-card border border-border/50 shadow-sm">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full ring-2 ring-card",
                contact.balance >= 0 ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
          </div>
        </div>

        {/* Name + contact info */}
        <div className="flex-1 min-w-0">
          <Link to="/contacts/$contactId" params={{ contactId: contact.id }} className="block">
            <h3 className="font-bold text-foreground truncate text-[15px] leading-tight hover:text-primary transition-colors flex items-center gap-1.5">
              {contact.name ?? "Unnamed"}
              {contact.isSupporter && <SupporterBadge className="h-4 px-1 text-[9px]" />}
            </h3>
          </Link>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5 opacity-70">
            {contact.email || contact.phoneNumber || "No contact info"}
          </p>
          {contact.sourceContactId && contact.sharedBy && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 opacity-60 italic">
              Shared by {contact.sharedBy.firstName} {contact.sharedBy.lastName}
            </p>
          )}
        </div>

        {/* Three-dot menu */}
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl shrink-0 transition-all active:bg-muted"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 p-1.5 rounded-2xl border-border/40 shadow-2xl backdrop-blur-xl bg-background/95"
            >
              <DropdownMenuItem
                asChild
                className="rounded-xl py-2.5 cursor-pointer focus:bg-primary/5 px-4"
              >
                <Link
                  to="/contacts/$contactId"
                  params={{ contactId: contact.id }}
                  className="flex items-center w-full"
                >
                  <span className="font-bold text-sm">View Profile</span>
                </Link>
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem
                  onClick={() => onEdit(contact)}
                  className="rounded-xl py-2.5 cursor-pointer focus:bg-primary/5 px-4"
                >
                  <span className="font-bold text-sm">Edit Contact</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <div className="h-px bg-border/50 my-1 mx-2" />
                  <DropdownMenuItem
                    onClick={() => onDelete(contact)}
                    className="rounded-xl py-2.5 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50 px-4"
                  >
                    <span className="font-bold text-sm">Delete Contact</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Bottom row: Standing label + amount, and invite/platform badge */}
      <div className="flex items-end justify-between mt-3 pt-3 border-t border-border/30">
        <div>
          <p className="text-[10px] text-muted-foreground font-bold mb-1 flex items-center gap-1 uppercase tracking-wider opacity-60">
            <Wallet className="w-3 h-3" />
            Standing
          </p>
          <BalanceIndicator
            amount={contact.balance}
            currency="NGN"
            className="text-lg font-black py-0 px-0 h-auto shadow-none border-none bg-transparent dark:bg-transparent w-fit"
          />
        </div>

        <div className="flex items-center gap-2">
          {contact.isOnPlatform ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">On Platform</span>
            </div>
          ) : contact.hasPendingInvitation ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/5 border border-amber-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-amber-600">Invited</span>
              </div>
              {onInvite && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onInvite(contact.id)}
                  className="h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all"
                >
                  Resend
                </Button>
              )}
            </div>
          ) : onInvite && contact.email ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInvite(contact.id)}
              className="h-8 rounded-xl text-[11px] font-bold px-4 border-border/60 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              Invite
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
