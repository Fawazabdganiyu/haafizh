import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import { format } from "date-fns";
import { type Resolver, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Form,
  TransactionFormFields,
  type TransactionFormValues,
  transactionFormSchema,
} from "@/components/transactions/TransactionFormFields";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useAuth } from "@/hooks/use-auth";
import { useContacts } from "@/hooks/useContacts";
import { useProjects } from "@/hooks/useProjects";
import { AssetCategory, TransactionType } from "@/types/__generated__/graphql";

vi.mock("@/hooks/use-active-org", () => ({ useActiveOrg: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useContacts", () => ({ useContacts: vi.fn() }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: vi.fn() }));

// These children pull in Apollo hooks (useLazyQuery, useQuery) that need a
// real ApolloProvider to not throw — stub them out since this test is about
// TransactionFormFields' own org-mode conditionals, not their internals.
vi.mock("@/components/contacts/ContactFormDialog", () => ({
  ContactFormDialog: () => null,
}));
vi.mock("@/components/contacts/ShareContactDialog", () => ({
  ShareContactDialog: () => null,
}));
vi.mock("@/components/witnesses/WitnessSelector", () => ({
  WitnessSelector: () => null,
}));

const SHARED_CONTACT_ID = "shared-contact-1";
const PLAIN_CONTACT_ID = "plain-contact-1";
const SHARED_BY_OTHER_CONTACT_ID = "shared-by-other-1";
const CURRENT_USER_ID = "current-user-1";
const OTHER_MEMBER_ID = "other-member-1";

const mockContacts = [
  {
    id: SHARED_CONTACT_ID,
    name: "Aisha (shared by me)",
    email: null,
    phoneNumber: null,
    balance: 0,
    isOnPlatform: false,
    isSupporter: false,
    hasPendingInvitation: false,
    createdAt: new Date().toISOString(),
    orgId: "org-1",
    sourceContactId: "personal-source-1",
    sharedBy: { id: CURRENT_USER_ID, firstName: "Me", lastName: "Sharer" },
  },
  {
    id: PLAIN_CONTACT_ID,
    name: "Bello (org-native)",
    email: null,
    phoneNumber: null,
    balance: 0,
    isOnPlatform: false,
    isSupporter: false,
    hasPendingInvitation: false,
    createdAt: new Date().toISOString(),
    orgId: "org-1",
    sourceContactId: null,
    sharedBy: null,
  },
  {
    id: SHARED_BY_OTHER_CONTACT_ID,
    name: "Chidi (shared by someone else)",
    email: null,
    phoneNumber: null,
    balance: 0,
    isOnPlatform: false,
    isSupporter: false,
    hasPendingInvitation: false,
    createdAt: new Date().toISOString(),
    orgId: "org-1",
    sourceContactId: "personal-source-2",
    sharedBy: { id: OTHER_MEMBER_ID, firstName: "Other", lastName: "Member" },
  },
];

function Harness({ contactId }: { contactId?: string }) {
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema) as Resolver<TransactionFormValues>,
    defaultValues: {
      type: TransactionType.LoanGiven,
      contactId,
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

  return (
    <Form {...form}>
      <TransactionFormFields form={form} mode="create" />
    </Form>
  );
}

describe("TransactionFormFields — org-mode contact sharing", () => {
  beforeEach(() => {
    vi.mocked(useContacts).mockReturnValue({
      contacts: mockContacts,
      total: mockContacts.length,
      page: 1,
      limit: 25,
      loading: false,
      creating: false,
      updating: false,
      error: undefined,
      createContact: vi.fn(),
      updateContact: vi.fn(),
      deleteContact: vi.fn(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useContacts>);

    vi.mocked(useProjects).mockReturnValue({
      projects: [],
      loading: false,
    } as unknown as ReturnType<typeof useProjects>);

    vi.mocked(useAuth).mockReturnValue({
      user: { id: CURRENT_USER_ID },
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('does NOT render "From My Contacts" in personal mode', () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: null,
      isOrgMode: false,
      switchToOrg: vi.fn(),
    });

    render(<Harness />);

    expect(screen.queryByText("From My Contacts")).not.toBeInTheDocument();
    expect(screen.getByText("New Contact")).toBeInTheDocument();
  });

  it('renders "From My Contacts" in org mode', () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: { id: "org-1", name: "Acme", slug: "acme" } as never,
      isOrgMode: true,
      switchToOrg: vi.fn(),
    });

    render(<Harness />);

    expect(screen.getByText("From My Contacts")).toBeInTheDocument();
  });

  it("does not render the personal-ledger toggle when no contact is selected", () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: { id: "org-1", name: "Acme", slug: "acme" } as never,
      isOrgMode: true,
      switchToOrg: vi.fn(),
    });

    render(<Harness />);

    expect(screen.queryByText(/Also record on my personal ledger/i)).not.toBeInTheDocument();
  });

  it("does not render the personal-ledger toggle for a contact with no personal source", () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: { id: "org-1", name: "Acme", slug: "acme" } as never,
      isOrgMode: true,
      switchToOrg: vi.fn(),
    });

    render(<Harness contactId={PLAIN_CONTACT_ID} />);

    expect(screen.queryByText(/Also record on my personal ledger/i)).not.toBeInTheDocument();
  });

  it("renders the personal-ledger toggle for a contact shared from the caller's personal list", () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: { id: "org-1", name: "Acme", slug: "acme" } as never,
      isOrgMode: true,
      switchToOrg: vi.fn(),
    });

    render(<Harness contactId={SHARED_CONTACT_ID} />);

    expect(screen.getByText(/Also record on my personal ledger/i)).toBeInTheDocument();
  });

  it("does not render the personal-ledger toggle for a contact shared by a different member — the mirror would silently no-op", () => {
    vi.mocked(useActiveOrg).mockReturnValue({
      activeOrg: { id: "org-1", name: "Acme", slug: "acme" } as never,
      isOrgMode: true,
      switchToOrg: vi.fn(),
    });

    render(<Harness contactId={SHARED_BY_OTHER_CONTACT_ID} />);

    expect(screen.queryByText(/Also record on my personal ledger/i)).not.toBeInTheDocument();
  });
});
