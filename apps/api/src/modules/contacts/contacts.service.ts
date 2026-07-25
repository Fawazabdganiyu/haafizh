import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactInput } from './dto/create-contact.input';
import { UpdateContactInput } from './dto/update-contact.input';
import { normalizeEmail, splitName } from '../../common/utils/string.utils';
import { NotificationService } from '../notifications/notification.service';
import { v4 as uuidv4 } from 'uuid';
import {
  AssetCategory,
  Contact,
  InvitationStatus,
  Prisma,
} from '../../generated/prisma/client';
import {
  FilterContactInput,
  ContactBalanceStanding,
} from './dto/filter-contact.input';

/** + = contact owes me, − = I owe contact. GIFT excluded (no ongoing obligation). */
const CONTACT_STANDING_SIGN: Partial<Record<string, 1 | -1>> = {
  LOAN_GIVEN: 1,
  REPAYMENT_MADE: 1,
  ADVANCE_PAID: 1,
  DEPOSIT_PAID: 1,
  REMITTED: 1,
  LOAN_RECEIVED: -1,
  REPAYMENT_RECEIVED: -1,
  ADVANCE_RECEIVED: -1,
  DEPOSIT_RECEIVED: -1,
  ESCROWED: -1,
};

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async create(
    createContactInput: CreateContactInput,
    userId: string,
    orgId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required to create a contact');
    }

    const { name, email: rawEmail, ...rest } = createContactInput;
    const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
    const { firstName, lastName } = splitName(name);

    let linkedUserId: string | undefined;

    if (email) {
      const registeredUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (registeredUser) {
        linkedUserId = registeredUser.id;
      }
    }

    return this.prisma.contact.create({
      data: {
        ...rest,
        email,
        firstName,
        lastName,
        userId,
        linkedUserId,
        orgId: orgId ?? undefined,
      },
    });
  }

  async findAll(
    userId: string,
    orgId: string | null,
    filter?: FilterContactInput,
  ) {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;
    const search = filter?.search;

    const baseWhere = orgId ? { orgId } : { userId, orgId: null };

    const where: Prisma.ContactWhereInput = {
      ...baseWhere,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Two-phase query: balance standing requires in-memory filtering
    if (
      filter?.balanceStanding &&
      filter.balanceStanding !== ContactBalanceStanding.ALL
    ) {
      const allContacts = await this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          transactions: {
            select: {
              type: true,
              amount: true,
              status: true,
              parentId: true,
              conversions: {
                where: {
                  type: { in: ['GIFT_GIVEN', 'GIFT_RECEIVED'] },
                  status: { not: 'CANCELLED' },
                },
                select: { amount: true },
              },
            },
          },
        },
      });

      const filtered = allContacts.filter((c) => {
        const balance = this.computeContactBalance(c.transactions);
        if (filter.balanceStanding === ContactBalanceStanding.OWED_TO_ME)
          return balance > 0;
        if (filter.balanceStanding === ContactBalanceStanding.I_OWE)
          return balance < 0;
        return true;
      });

      const total = filtered.length;
      const items = filtered.slice((page - 1) * limit, page * limit);
      return { items, total, page, limit };
    }

    const [total, items] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Personal contacts (userId: me, orgId: null) that have no existing
   * org-owned copy in the active org yet (derivedContacts: none for that
   * org) — the candidate list for "From my contacts" when recording an org
   * transaction. Requires an active org: sharing only makes sense from
   * inside one.
   */
  async findShareable(
    userId: string,
    orgId: string | null,
    filter?: FilterContactInput,
  ) {
    if (!orgId) {
      throw new BadRequestException(
        'An active organisation is required to list shareable contacts',
      );
    }

    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;
    const search = filter?.search;

    const where: Prisma.ContactWhereInput = {
      userId,
      orgId: null,
      derivedContacts: { none: { orgId } },
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Returns the effective principal of a transaction for balance math:
   * the raw amount minus any non-cancelled gift conversions (clamped at 0).
   * Shared by `computeContactBalance` (list view) and `getBalance`
   * (single contact) so both code paths stay in lockstep.
   */
  private effectiveTransactionAmount(tx: {
    amount: unknown;
    conversions?: Array<{ amount: unknown }>;
  }): number {
    const toNum = (value: unknown): number => {
      if (value == null) return 0;
      if (typeof value === 'object' && value !== null && 'toNumber' in value) {
        return (value as { toNumber: () => number }).toNumber();
      }
      return Number(value);
    };

    let amount = toNum(tx.amount);
    if (tx.conversions && tx.conversions.length > 0) {
      const totalGifted = tx.conversions.reduce(
        (sum, conv) => sum + toNum(conv.amount),
        0,
      );
      amount = Math.max(0, amount - totalGifted);
    }
    return amount;
  }

  private computeContactBalance(
    transactions: Array<{
      type: string;
      amount: unknown;
      status: string;
      parentId?: string | null;
      conversions?: Array<{ amount: unknown }>;
    }>,
    isCreator = true,
  ): number {
    let balance = 0;
    for (const tx of transactions) {
      if (tx.status === 'CANCELLED') continue;

      // Skip gift conversion children — their effect is applied by reducing
      // the parent loan's effective amount below.
      if (
        (tx.type === 'GIFT_GIVEN' || tx.type === 'GIFT_RECEIVED') &&
        tx.parentId
      ) {
        continue;
      }

      const amount = this.effectiveTransactionAmount(tx);
      const sign = CONTACT_STANDING_SIGN[tx.type] ?? 0;
      balance += isCreator ? sign * amount : -sign * amount;
    }
    return balance;
  }

  /**
   * Authorises access to a contact already loaded from the DB.
   * Org contacts (contact.orgId set): caller must be an active member of
   * that same org — membership, not creation, grants access, since org
   * contacts are shared by every member. Personal contacts (orgId null):
   * caller must be the creator or the linked platform user (shared ledger).
   */
  private async assertContactAccess(
    contact: Contact,
    userId: string,
    orgId: string | null,
  ): Promise<void> {
    if (contact.orgId) {
      if (contact.orgId !== orgId) {
        throw new ForbiddenException(
          'You do not have permission to access this contact',
        );
      }
      const member = await this.prisma.organisationMember.findUnique({
        where: { orgId_userId: { orgId: contact.orgId, userId } },
      });
      if (!member) {
        throw new ForbiddenException(
          'You do not have permission to access this contact',
        );
      }
      return;
    }

    // Allow access if the user is the owner OR the linked user (shared ledger)
    if (contact.userId !== userId && contact.linkedUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this contact',
      );
    }
  }

  async findOne(id: string, userId: string, orgId: string | null = null) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        transactions: true,
        user: true,
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.assertContactAccess(contact, userId, orgId);

    return contact;
  }

  async update(
    id: string,
    updateContactInput: UpdateContactInput,
    userId: string,
    orgId: string | null = null,
  ) {
    // Check existence and access
    await this.findOne(id, userId, orgId);

    const { name, email, phoneNumber } = updateContactInput;
    let nameData = {};
    if (name) {
      const { firstName, lastName } = splitName(name);
      nameData = { firstName, lastName };
    }

    const normalizedEmail = email ? normalizeEmail(email) : undefined;

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...nameData,
        ...(email !== undefined && { email: normalizedEmail }),
        ...(phoneNumber !== undefined && { phoneNumber }),
      },
    });
  }

  async remove(id: string, userId: string, orgId: string | null = null) {
    if (!userId) {
      throw new BadRequestException('User ID is required to remove a contact');
    }

    // Check existence and access
    await this.findOne(id, userId, orgId);

    return this.prisma.contact.delete({
      where: { id },
    });
  }

  /**
   * Sums one side of a contact's balance. `flip: false` for transactions
   * recorded directly against this Contact row (apply the sign as-is,
   * regardless of *which* org member created it — org standing is a
   * property of the org↔contact relationship, not the recording member's);
   * `flip: true` for the shared-ledger reverse side (see `getBalance`).
   */
  private sumBalanceTransactions(
    transactions: Array<{
      type: string;
      amount: unknown;
      parentId?: string | null;
      conversions?: Array<{ amount: unknown }>;
    }>,
    flip: boolean,
  ): number {
    let balance = 0;
    for (const tx of transactions) {
      // If this is a GIFT_GIVEN/GIFT_RECEIVED transaction that has a parent, it's a conversion.
      if (
        (tx.type === 'GIFT_GIVEN' || tx.type === 'GIFT_RECEIVED') &&
        tx.parentId
      ) {
        continue;
      }

      const amount = this.effectiveTransactionAmount(tx);
      const sign = CONTACT_STANDING_SIGN[tx.type] ?? 0;
      balance += flip ? -sign * amount : sign * amount;
    }
    return balance;
  }

  async getBalance(contactId: string, userId: string): Promise<number> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { linkedUserId: true, orgId: true },
    });

    const conversionsSelect = {
      // Load BOTH gift conversion sides: a LOAN_GIVEN parent gets reduced by
      // GIFT_GIVEN conversions, and a LOAN_RECEIVED parent gets reduced by
      // GIFT_RECEIVED conversions. Only non-cancelled conversions count.
      where: {
        type: {
          in: ['GIFT_GIVEN', 'GIFT_RECEIVED'],
        } as Prisma.EnumTransactionTypeFilter,
        status: { not: 'CANCELLED' } as Prisma.EnumTransactionStatusFilter,
      },
      select: { amount: true },
    };

    // Direct transactions recorded against this Contact row. For an org
    // contact these can be created by *any* member — the sign is applied
    // as-is regardless of creator, since org standing doesn't flip per
    // viewer. (Personal contacts can only ever be created-against by their
    // one owner, so this was already effectively unflipped there too.)
    const directTransactions = await this.prisma.transaction.findMany({
      where: {
        contactId,
        category: AssetCategory.FUNDS,
        status: { not: 'CANCELLED' },
      },
      select: {
        type: true,
        amount: true,
        parentId: true,
        conversions: conversionsSelect,
      },
    });
    let balance = this.sumBalanceTransactions(directTransactions, false);

    // Shared-ledger reverse side: transactions the linked platform user
    // created against *their own* contact-record naming this user back —
    // always flipped, since it's literally the other party's view of the
    // same relationship. Personal contacts only: an org contact's
    // linkedUserId is copied over by promoteContactToOrg for perspective
    // flipping on transactions *within that org*, not an invitation to
    // pull in the linked user's unrelated private personal-ledger activity
    // with a third party into a balance shown to other org members.
    if (!contact?.orgId && contact?.linkedUserId) {
      const reverseTransactions = await this.prisma.transaction.findMany({
        where: {
          createdById: contact.linkedUserId,
          contact: { linkedUserId: userId },
          category: AssetCategory.FUNDS,
          status: { not: 'CANCELLED' },
          orgId: null,
        },
        select: {
          type: true,
          amount: true,
          parentId: true,
          conversions: conversionsSelect,
        },
      });
      balance += this.sumBalanceTransactions(reverseTransactions, true);
    }

    return balance;
  }

  async checkContactOnPlatform(
    id: string,
    userId: string,
    contactData?: Contact,
    orgId: string | null = null,
  ) {
    const contact = contactData || (await this.findOne(id, userId, orgId));

    if (!contact.email) {
      return {
        isRegistered: false,
        hasPendingInvitation: false,
      };
    }

    const registeredUser = await this.prisma.user.findUnique({
      where: { email: contact.email },
    });

    const pendingInvitation = await this.prisma.contactInvitation.findFirst({
      where: {
        contactId: id,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    return {
      isRegistered: !!registeredUser,
      hasPendingInvitation: !!pendingInvitation,
      registeredUser,
    };
  }

  async inviteContactToPlatform(
    id: string,
    userId: string,
    orgId: string | null = null,
  ) {
    const contact = await this.findOne(id, userId, orgId);

    if (!contact.email) {
      throw new BadRequestException(
        'Contact must have an email address to be invited',
      );
    }

    const status = await this.checkContactOnPlatform(
      id,
      userId,
      undefined,
      orgId,
    );
    if (status.isRegistered) {
      throw new BadRequestException(
        'Contact is already registered on the platform',
      );
    }

    // Generate token and expiry (7 days)
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Check if there's already a pending invitation for this contact and inviter
    const existingInvitation = await this.prisma.contactInvitation.findFirst({
      where: {
        contactId: id,
        inviterId: userId,
        status: InvitationStatus.PENDING,
      },
    });

    let invitation;
    if (existingInvitation) {
      // Update existing invitation
      invitation = await this.prisma.contactInvitation.update({
        where: { id: existingInvitation.id },
        data: {
          token,
          expiresAt,
          status: InvitationStatus.PENDING,
        },
      });
    } else {
      // Create new invitation
      invitation = await this.prisma.contactInvitation.create({
        data: {
          token,
          expiresAt,
          contactId: id,
          inviterId: userId,
          status: InvitationStatus.PENDING,
        },
      });
    }

    // Send email
    await this.notificationService.sendContactInvitationEmail(
      contact.email,
      contact.firstName,
      `${contact.user.firstName} ${contact.user.lastName}`,
      token,
    );

    return {
      success: true,
      message: existingInvitation
        ? 'Invitation resent successfully'
        : 'Invitation sent successfully',
      invitation,
    };
  }

  async resendContactInvitation(
    contactId: string,
    userId: string,
    orgId: string | null = null,
  ) {
    const invitation = await this.prisma.contactInvitation.findFirst({
      where: {
        contactId,
        inviterId: userId,
        status: InvitationStatus.PENDING,
      },
    });

    if (!invitation) {
      throw new NotFoundException(
        'No pending invitation found for this contact',
      );
    }

    return this.inviteContactToPlatform(contactId, userId, orgId);
  }

  async linkContactsForUser(userId: string, email: string) {
    return this.prisma.contact.updateMany({
      where: {
        email,
        linkedUserId: null,
      },
      data: {
        linkedUserId: userId,
      },
    });
  }
}
