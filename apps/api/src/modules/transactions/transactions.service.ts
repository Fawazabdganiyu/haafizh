import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionInput } from './dto/create-transaction.input';
import { AddWitnessInput } from './dto/add-witness.input';
import { UpdateTransactionInput } from './dto/update-transaction.input';
import {
  AssetCategory,
  WitnessStatus,
  TransactionStatus,
  TransactionType,
  ProjectTransactionType,
  Prisma,
  Witness,
} from '../../generated/prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { hashToken } from '../../common/utils/crypto.utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import * as ms from 'ms';
import { WitnessInviteInput } from '../witnesses/dto/witness-invite.input';
import { NotificationService } from '../notifications/notification.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { NotificationTemplates } from '../in-app-notifications/notification-templates';
import { normalizeEmail, splitName } from '../../common/utils/string.utils';
import { FilterTransactionInput } from './dto/filter-transaction.input';
import { FilterSharedHistoryInput } from './dto/filter-shared-history.input';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { computeProjectTransactionBalanceEffect } from '../projects/project-transactions.service';

/** Perspective-flip pairs for shared-ledger view. */
const PERSPECTIVE_FLIP_MAP: Partial<Record<string, string>> = {
  LOAN_GIVEN: 'LOAN_RECEIVED',
  LOAN_RECEIVED: 'LOAN_GIVEN',
  REPAYMENT_MADE: 'REPAYMENT_RECEIVED',
  REPAYMENT_RECEIVED: 'REPAYMENT_MADE',
  GIFT_GIVEN: 'GIFT_RECEIVED',
  GIFT_RECEIVED: 'GIFT_GIVEN',
  ADVANCE_PAID: 'ADVANCE_RECEIVED',
  ADVANCE_RECEIVED: 'ADVANCE_PAID',
  DEPOSIT_PAID: 'DEPOSIT_RECEIVED',
  DEPOSIT_RECEIVED: 'DEPOSIT_PAID',
  ESCROWED: 'REMITTED',
  REMITTED: 'ESCROWED',
};

function computeNetBalance(summary: TransactionSummary): number {
  return (
    summary.totalLoanReceived -
    summary.totalLoanGiven +
    summary.totalRepaymentReceived -
    summary.totalRepaymentMade +
    summary.totalGiftReceived -
    summary.totalGiftGiven +
    summary.totalAdvanceReceived -
    summary.totalAdvancePaid +
    summary.totalDepositReceived -
    summary.totalDepositPaid +
    summary.totalEscrowed -
    summary.totalRemitted
  );
}

export interface WitnessNotification {
  witnessId: string;
  userId: string;
  email: string;
  firstName: string;
  rawToken: string;
  senderId: string;
  phoneNumber?: string;
  transactionDetails: {
    creatorName: string;
    contactName: string;
    amount: string;
    itemName?: string;
    currency?: string;
    category: AssetCategory;
    type: TransactionType;
  };
}

export interface TransactionSummary {
  totalLoanGiven: number;
  totalLoanReceived: number;
  totalRepaymentMade: number;
  totalRepaymentReceived: number;
  totalGiftGiven: number;
  totalGiftReceived: number;
  totalAdvancePaid: number;
  totalAdvanceReceived: number;
  totalDepositPaid: number;
  totalDepositReceived: number;
  totalEscrowed: number;
  totalRemitted: number;
  netBalance?: number;
  currency: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly notificationService: NotificationService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly inAppNotificationsService: InAppNotificationsService,
  ) {}

  /**
   * Recomputes a parent transaction's lifecycle status based on its
   * non-cancelled children.
   *
   * Applies to the three "lifecycle" parent types:
   *  - LOAN_GIVEN / LOAN_RECEIVED — children are repayments + gift conversions
   *  - ESCROWED — children are remittances (REMITTED)
   *
   * - PENDING (a.k.a. "ACTIVE"): outstanding > 0
   * - COMPLETED (a.k.a. "SETTLED"): outstanding === 0
   *
   * Cancelled parents are left as-is. A parent that flips between PENDING
   * and COMPLETED writes a TransactionHistory row so the audit trail
   * captures the auto-transition.
   */
  private async recomputeParentLoanStatus(
    prisma: Prisma.TransactionClient,
    parentId: string,
    userId: string,
    // Caller may already have summed the non-cancelled children (e.g.
    // syncMirroredAmount computes this to validate the new amount) — skip
    // the redundant findMany when it's passed.
    preloadedSettledAmount?: number,
  ): Promise<void> {
    const parent = await prisma.transaction.findUnique({
      where: { id: parentId },
      select: { id: true, amount: true, status: true, type: true },
    });

    if (!parent || !parent.amount) return;
    if (parent.status === TransactionStatus.CANCELLED) return;
    // Only loan and escrow parents have a "settled" lifecycle
    if (
      parent.type !== 'LOAN_GIVEN' &&
      parent.type !== 'LOAN_RECEIVED' &&
      parent.type !== 'ESCROWED'
    ) {
      return;
    }

    let settled = preloadedSettledAmount;
    if (settled === undefined) {
      const children = await prisma.transaction.findMany({
        where: {
          parentId,
          status: { not: TransactionStatus.CANCELLED },
        },
        select: { amount: true },
      });
      settled = children.reduce(
        (sum, child) => sum + (child.amount ? Number(child.amount) : 0),
        0,
      );
    }
    const parentAmount = Number(parent.amount);
    const isFullySettled = settled >= parentAmount;
    const nextStatus = isFullySettled
      ? TransactionStatus.COMPLETED
      : TransactionStatus.PENDING;

    if (nextStatus === parent.status) return;

    await prisma.transaction.update({
      where: { id: parentId },
      data: { status: nextStatus },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId: parentId,
        userId,
        changeType: isFullySettled ? 'AUTO_SETTLED' : 'AUTO_REOPENED',
        previousState: { status: parent.status } as Prisma.InputJsonValue,
        newState: { status: nextStatus } as Prisma.InputJsonValue,
      },
    });
  }

  private async processWitnesses(
    transactionId: string,
    witnessUserIds: string[] | undefined,
    witnessInvites: WitnessInviteInput[] | undefined,
    prisma: Prisma.TransactionClient,
  ): Promise<WitnessNotification[]> {
    const notifications: WitnessNotification[] = [];

    // Fetch transaction details for the notification
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        createdBy: true,
        contact: true,
      },
    });

    if (!transaction) return notifications;

    const creatorName = `${transaction.createdBy.firstName} ${transaction.createdBy.lastName}`;
    const contactName = transaction.contact
      ? `${transaction.contact.firstName} ${transaction.contact.lastName}`
      : 'N/A';

    const transactionDetails = {
      creatorName,
      contactName,
      amount: transaction.amount?.toString(),
      itemName: transaction.itemName,
      currency: transaction.currency,
      description: transaction.description || undefined,
      date: transaction.date
        ? new Intl.DateTimeFormat('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }).format(new Date(transaction.date))
        : undefined,
      quantity: transaction.quantity ? String(transaction.quantity) : undefined,
      category: transaction.category,
      type: transaction.type,
    };

    // Handle existing users as witnesses
    if (witnessUserIds && witnessUserIds.length > 0) {
      const witnessDetails: (Witness & {
        user: {
          email: string;
          firstName: string;
          lastName: string;
          phoneNumber: string | null;
        };
      })[] = [];

      for (const witnessUserId of witnessUserIds) {
        // Use upsert to handle duplicates and get the witness record
        const witness = await prisma.witness.upsert({
          where: {
            transactionId_userId: {
              transactionId,
              userId: witnessUserId,
            },
          },
          update: {}, // No updates needed if it exists
          create: {
            transactionId,
            userId: witnessUserId,
            status: WitnessStatus.PENDING,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        });

        witnessDetails.push(
          witness as Witness & {
            user: {
              email: string;
              firstName: string;
              lastName: string;
              phoneNumber: string | null;
            };
          },
        );
      }

      for (const witness of witnessDetails) {
        const rawToken = uuidv4();

        notifications.push({
          witnessId: witness.id,
          userId: witness.userId,
          email: witness.user.email,
          firstName: witness.user.firstName,
          rawToken,
          senderId: transaction.createdById,
          phoneNumber: witness.user.phoneNumber || undefined,
          transactionDetails,
        });
      }
    }

    // Handle new user invites
    if (witnessInvites && witnessInvites.length > 0) {
      for (const invite of witnessInvites) {
        const normalizedEmail = normalizeEmail(invite.email);
        // Check if user already exists by email
        let user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        // If not, create a placeholder user
        if (!user) {
          const { firstName, lastName } = splitName(invite.name);
          user = await prisma.user.create({
            data: {
              email: normalizedEmail,
              firstName,
              lastName,
              phoneNumber: invite.phoneNumber,
              passwordHash: null, // Indicates invited user
            },
          });
        }

        // Check if witness record already exists
        const existingWitness = await prisma.witness.findUnique({
          where: {
            transactionId_userId: {
              transactionId,
              userId: user.id,
            },
          },
        });

        let witnessId: string;
        if (!existingWitness) {
          // Create witness record WITHOUT invite token first (we'll store it in Redis)
          const newWitness = await prisma.witness.create({
            data: {
              transactionId,
              userId: user.id,
              status: WitnessStatus.PENDING,
            },
          });
          witnessId = newWitness.id;
        } else {
          witnessId = existingWitness.id;
        }

        const rawToken = uuidv4();

        const targetEmail = normalizedEmail || user.email;
        const { firstName } = splitName(invite.name);
        const targetName = firstName || user.firstName;

        notifications.push({
          witnessId,
          userId: user.id,
          email: targetEmail,
          firstName: targetName,
          rawToken,
          senderId: transaction.createdById,
          phoneNumber: invite.phoneNumber || user.phoneNumber || undefined,
          transactionDetails,
        });
      }
    }

    return notifications;
  }

  async notifyWitnesses(notifications: WitnessNotification[]) {
    for (const notification of notifications) {
      const {
        witnessId,
        userId,
        email,
        firstName,
        rawToken,
        senderId,
        phoneNumber,
        transactionDetails,
      } = notification;
      const hashedToken = hashToken(rawToken);

      // Store in Redis: `invite:${hashedToken}` -> `witnessId`
      await this.cacheManager.set(
        `invite:${hashedToken}`,
        witnessId,
        ms(
          this.configService.getOrThrow<string>(
            'auth.inviteTokenExpiry',
          ) as ms.StringValue,
        ),
      );

      // Send notification
      await this.notificationService.sendTransactionWitnessInvite(
        email,
        firstName,
        rawToken,
        transactionDetails,
        senderId,
        phoneNumber,
      );

      // In-app notification — fire-and-forget, never blocks the invite flow
      this.inAppNotificationsService.createSafely(
        {
          userId,
          ...NotificationTemplates.witnessInvited(
            transactionDetails.creatorName,
          ),
        },
        `witness invite (${userId})`,
      );
    }
  }

  async create(
    createTransactionInput: CreateTransactionInput,
    userId: string,
    orgId: string | null,
  ) {
    let notifications: WitnessNotification[] = [];
    const transaction = await this.prisma.$transaction(async (prisma) => {
      const result = await this.createWithClient(
        prisma,
        createTransactionInput,
        userId,
        orgId,
      );
      notifications = result.notifications;
      return result.transaction;
    });

    // Send notifications after transaction commits
    if (notifications.length > 0) {
      await this.notifyWitnesses(notifications).catch((err) => {
        console.error('Failed to send witness notifications:', err);
      });
    }

    return transaction;
  }

  /**
   * Writes a real, separate Transaction row (orgId: null) onto the caller's
   * own personal ledger reflecting an org transaction just created, linked
   * back via `orgSourceTransactionId`. Two cases:
   *
   *  - Top-level (no parentId): only when `recordOnPersonalLedger` is true
   *    AND the org contact is a `sourceContactId`-linked copy of one of the
   *    caller's own personal contacts. Sharing a contact into an org lets
   *    every member transact against it, but only the member who owns the
   *    underlying personal contact can reflect onto it — reflecting onto
   *    someone else's personal contact would silently mutate a ledger they
   *    don't control.
   *  - Child (repayment / remittance / gift conversion, parentId set): if
   *    the parent org transaction already has a personal mirror, the child
   *    mirrors automatically, ignoring the toggle — a loan recorded
   *    personally must settle personally too, or the mirrored loan never
   *    reaches COMPLETED.
   *
   * No witnesses, no notifications — the mirror is a bookkeeping echo, not
   * an independently-witnessed event.
   */
  private async maybeCreatePersonalMirror(
    prisma: Prisma.TransactionClient,
    orgTransaction: {
      id: string;
      type: TransactionType;
      category: AssetCategory;
      amount: Prisma.Decimal | null;
      itemName: string | null;
      quantity: number | null;
      currency: string;
      date: Date;
      description: string | null;
      status: TransactionStatus;
      orgId: string | null;
      contactId: string | null;
    },
    parentId: string | undefined,
    recordOnPersonalLedger: boolean | undefined,
    userId: string,
  ): Promise<void> {
    if (!orgTransaction.orgId) return;

    let personalContactId: string | undefined;
    let mirrorParentId: string | undefined;

    if (parentId) {
      // Child of a lifecycle parent — mirror only if the parent itself
      // was mirrored, and always inherit that mirror's contact/parent.
      const parentMirror = await prisma.transaction.findUnique({
        where: { orgSourceTransactionId: parentId },
        select: { id: true, contactId: true, createdById: true },
      });
      if (!parentMirror) return;
      // The mirror belongs to whichever member originally shared the
      // contact and reflected the parent loan — never let a *different*
      // org member's repayment/remittance/gift-conversion write onto it.
      if (parentMirror.createdById !== userId) return;
      personalContactId = parentMirror.contactId ?? undefined;
      mirrorParentId = parentMirror.id;
    } else {
      if (!recordOnPersonalLedger || !orgTransaction.contactId) return;
      const contact = await prisma.contact.findUnique({
        where: { id: orgTransaction.contactId },
        select: { sourceContactId: true },
      });
      if (!contact?.sourceContactId) return;

      // Only the member who owns the underlying personal contact can
      // reflect onto it — never mutate a ledger another member controls.
      const sourceContact = await prisma.contact.findUnique({
        where: { id: contact.sourceContactId },
        select: { userId: true },
      });
      if (sourceContact?.userId !== userId) return;

      personalContactId = contact.sourceContactId;
    }

    if (!personalContactId) return;

    await prisma.transaction.create({
      data: {
        category: orgTransaction.category,
        amount: orgTransaction.amount ?? undefined,
        itemName: orgTransaction.itemName,
        quantity: orgTransaction.quantity,
        type: orgTransaction.type,
        currency: orgTransaction.currency,
        date: orgTransaction.date,
        description: orgTransaction.description,
        status: orgTransaction.status,
        createdById: userId,
        orgId: null,
        contactId: personalContactId,
        parentId: mirrorParentId,
        orgSourceTransactionId: orgTransaction.id,
      },
    });

    if (mirrorParentId) {
      await this.recomputeParentLoanStatus(prisma, mirrorParentId, userId);
    }
  }

  /**
   * Leaf create logic accepting an externally-supplied transaction client so
   * `ProjectContactLinkService` can create a mirrored Transaction row inside
   * its own `$transaction` block (atomic with the ProjectTransaction write).
   * `extra` is set only by that internal caller — never client-settable via
   * the `createTransaction` mutation's `CreateTransactionInput`.
   */
  async createWithClient(
    prisma: Prisma.TransactionClient,
    createTransactionInput: CreateTransactionInput,
    userId: string,
    orgId: string | null,
    extra?: { projectTransactionId?: string; isMirroredFromProject?: boolean },
  ): Promise<{
    transaction: Awaited<ReturnType<typeof prisma.transaction.create>>;
    notifications: WitnessNotification[];
  }> {
    const {
      category,
      amount,
      itemName,
      quantity,
      witnessUserIds,
      witnessInvites,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      projectId, // Not a Transaction column — consumed by ProjectContactLinkService, never persisted here
      recordOnPersonalLedger,
      ...rest
    } = createTransactionInput;

    // Validation logic for category
    if (category === AssetCategory.FUNDS && !amount) {
      throw new BadRequestException(
        'Amount is required for financial transactions',
      );
    }

    if (category === AssetCategory.ITEM && !itemName) {
      throw new BadRequestException(
        'Item name is required for physical item tracking',
      );
    }

    const isRepayment =
      rest.type === 'REPAYMENT_MADE' || rest.type === 'REPAYMENT_RECEIVED';
    const isGiftConversion =
      rest.type === 'GIFT_GIVEN' || rest.type === 'GIFT_RECEIVED';
    const isRemittance = rest.type === 'REMITTED';

    let parentTransaction: Awaited<
      ReturnType<typeof prisma.transaction.findUnique>
    > = null;
    let derivedContactId: string | undefined;

    if (rest.parentId) {
      parentTransaction = await prisma.transaction.findUnique({
        where: { id: rest.parentId },
      });

      if (!parentTransaction) {
        throw new NotFoundException(
          `Parent transaction ${rest.parentId} not found`,
        );
      }

      // A personal-ledger mirror's children (repayments/remittances/gift
      // conversions) are only ever created automatically, alongside the
      // matching child on the org side (see maybeCreatePersonalMirror).
      // Recording one directly against the mirror here would desync it from
      // the org ledger it's supposed to echo.
      if (parentTransaction.orgSourceTransactionId) {
        throw new BadRequestException(
          'This is a personal-ledger reflection of an organisation transaction. Record repayments, remittances, or gift conversions from the organisation instead.',
        );
      }

      // Org-scoped parents are shared by every member of that org; personal
      // parents remain creator-only. Mirrors the contact-ownership rule below.
      const parentAllowed = parentTransaction.orgId
        ? parentTransaction.orgId === orgId
        : parentTransaction.createdById === userId;
      if (!parentAllowed) {
        throw new ForbiddenException(
          'Cannot link to a transaction you do not own',
        );
      }

      if (isGiftConversion) {
        // Gift conversion must attach to an open loan
        if (
          parentTransaction.type !== 'LOAN_GIVEN' &&
          parentTransaction.type !== 'LOAN_RECEIVED'
        ) {
          throw new BadRequestException(
            'Only LOAN_GIVEN or LOAN_RECEIVED transactions can be converted to a gift',
          );
        }
        if (
          amount &&
          parentTransaction.amount &&
          Number(amount) > Number(parentTransaction.amount)
        ) {
          throw new BadRequestException(
            'Gift conversion amount cannot exceed parent transaction amount',
          );
        }
      } else if (isRepayment) {
        // Repayment must be linked to a matching loan
        const expectedParentType =
          rest.type === 'REPAYMENT_RECEIVED' ? 'LOAN_GIVEN' : 'LOAN_RECEIVED';
        if (parentTransaction.type !== expectedParentType) {
          throw new BadRequestException(
            `${rest.type} must be linked to a ${expectedParentType} transaction`,
          );
        }
        if (parentTransaction.category !== AssetCategory.FUNDS) {
          throw new BadRequestException(
            'Repayments can only be recorded against FUNDS loans',
          );
        }
        if (!parentTransaction.contactId) {
          throw new BadRequestException(
            'Parent loan must have a contact to record a repayment',
          );
        }

        // Derive contactId/currency from parent (ignore any client-supplied values)
        derivedContactId = parentTransaction.contactId;
        rest.contactId = parentTransaction.contactId;
        rest.currency =
          parentTransaction.currency ?? rest.currency ?? undefined;

        // Outstanding = parent amount - (sum of existing repayment children + sum of gift conversions)
        const children = await prisma.transaction.findMany({
          where: {
            parentId: rest.parentId,
            status: { not: 'CANCELLED' },
          },
          select: { amount: true, type: true },
        });
        const alreadySettled = children.reduce(
          (sum, child) => sum + (child.amount ? Number(child.amount) : 0),
          0,
        );
        const parentAmount = parentTransaction.amount
          ? Number(parentTransaction.amount)
          : 0;
        const outstanding = Math.max(0, parentAmount - alreadySettled);
        const repayAmount = Number(amount ?? 0);

        if (repayAmount <= 0) {
          throw new BadRequestException(
            'Repayment amount must be greater than zero',
          );
        }
        if (repayAmount > outstanding) {
          throw new BadRequestException(
            `Repayment amount (${repayAmount}) exceeds outstanding balance (${outstanding}) on the parent loan`,
          );
        }
      } else if (isRemittance) {
        // Remittance must be linked to an open escrow
        if (parentTransaction.type !== 'ESCROWED') {
          throw new BadRequestException(
            'REMITTED must be linked to an ESCROWED transaction',
          );
        }
        if (parentTransaction.category !== AssetCategory.FUNDS) {
          throw new BadRequestException(
            'Remittances can only be recorded against FUNDS escrows',
          );
        }
        if (!parentTransaction.contactId) {
          throw new BadRequestException(
            'Parent escrow must have a contact to record a remittance',
          );
        }

        // Derive contactId/currency from parent (ignore any client-supplied values)
        derivedContactId = parentTransaction.contactId;
        rest.contactId = parentTransaction.contactId;
        rest.currency =
          parentTransaction.currency ?? rest.currency ?? undefined;

        // Outstanding = parent amount - sum of existing remittance children
        const children = await prisma.transaction.findMany({
          where: {
            parentId: rest.parentId,
            status: { not: 'CANCELLED' },
          },
          select: { amount: true },
        });
        const alreadyRemitted = children.reduce(
          (sum, child) => sum + (child.amount ? Number(child.amount) : 0),
          0,
        );
        const parentAmount = parentTransaction.amount
          ? Number(parentTransaction.amount)
          : 0;
        const outstanding = Math.max(0, parentAmount - alreadyRemitted);
        const remitAmount = Number(amount ?? 0);

        if (remitAmount <= 0) {
          throw new BadRequestException(
            'Remittance amount must be greater than zero',
          );
        }
        if (remitAmount > outstanding) {
          throw new BadRequestException(
            `Remittance amount (${remitAmount}) exceeds outstanding balance (${outstanding}) on the parent escrow`,
          );
        }
      } else {
        // Parent linkage is only supported for gifts, repayments, and remittances
        throw new BadRequestException(
          'parentId is only valid for gift conversions, repayments, or remittances',
        );
      }
    } else if (isRepayment) {
      throw new BadRequestException(
        'Repayments must be linked to a parent loan via parentId',
      );
    } else if (isRemittance) {
      throw new BadRequestException(
        'Remittances must be linked to a parent escrow via parentId',
      );
    }

    // Validate contactId if provided (skipped when derived from parent above)
    if (rest.contactId && !derivedContactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: rest.contactId },
      });

      if (!contact) {
        throw new NotFoundException(`Contact ${rest.contactId} not found`);
      }

      // Org-scoped contacts are shared by every member of that org; personal
      // contacts remain creator-only. Prevents attaching an org contact to a
      // personal transaction and vice versa.
      const contactAllowed = orgId
        ? contact.orgId === orgId
        : contact.userId === userId && contact.orgId === null;
      if (!contactAllowed) {
        throw new ForbiddenException(
          'Cannot create a transaction for a contact you do not own',
        );
      }
    }

    // Lifecycle parent types start as PENDING (outstanding obligation).
    // The schema default is COMPLETED, which is correct for one-shot
    // transactions but wrong for parents that expect children to settle
    // them. Children themselves (repayments / remittances) keep the
    // default COMPLETED — they're standalone settled events.
    const isLifecycleParent =
      !rest.parentId &&
      (rest.type === 'LOAN_GIVEN' ||
        rest.type === 'LOAN_RECEIVED' ||
        rest.type === 'ESCROWED');

    const transaction = await prisma.transaction.create({
      data: {
        category,
        amount: category === AssetCategory.FUNDS ? amount : null,
        itemName: category === AssetCategory.ITEM ? itemName : null,
        quantity: category === AssetCategory.ITEM ? quantity : null,
        createdById: userId,
        orgId: orgId ?? undefined,
        ...rest,
        ...(isLifecycleParent ? { status: TransactionStatus.PENDING } : {}),
        ...(extra?.projectTransactionId
          ? { projectTransactionId: extra.projectTransactionId }
          : {}),
        ...(extra?.isMirroredFromProject
          ? { isMirroredFromProject: true }
          : {}),
      },
    });

    await this.maybeCreatePersonalMirror(
      prisma,
      transaction,
      rest.parentId,
      recordOnPersonalLedger,
      userId,
    );

    // Log parent-history entry for conversions, repayments, and remittances
    if (rest.parentId && parentTransaction) {
      const parentAmountNum = parentTransaction.amount
        ? Number(parentTransaction.amount)
        : 0;
      const thisAmountNum = Number(amount ?? 0);
      let changeType: string;
      let newState: Prisma.InputJsonValue;
      if (isRepayment) {
        changeType = 'REPAYMENT_RECORDED';
        newState = {
          repaymentId: transaction.id,
          repaymentAmount: amount,
          repaymentType: rest.type,
        };
      } else if (isRemittance) {
        changeType = 'REMITTANCE_RECORDED';
        newState = {
          remittanceId: transaction.id,
          remittanceAmount: amount,
        };
      } else {
        changeType = 'PARTIAL_CONVERSION_TO_GIFT';
        newState = {
          conversionId: transaction.id,
          giftAmount: amount,
          remainingAmount: parentAmountNum - thisAmountNum,
        };
      }
      await prisma.transactionHistory.create({
        data: {
          transactionId: rest.parentId,
          userId,
          changeType,
          previousState: {
            amount: parentTransaction.amount,
            type: parentTransaction.type,
          },
          newState,
        },
      });
    }

    // Auto-flip parent status when a repayment or remittance settles it
    if (rest.parentId && (isRepayment || isRemittance)) {
      await this.recomputeParentLoanStatus(prisma, rest.parentId, userId);
    }

    const notifications = await this.processWitnesses(
      transaction.id,
      witnessUserIds,
      witnessInvites,
      prisma,
    );

    return { transaction, notifications };
  }

  /**
   * Keeps a mirrored Transaction's amount in sync when the originating
   * ProjectTransaction's amount is edited. Re-runs the same settlement
   * recompute `update()` performs for amount changes, without touching
   * ProjectTransaction's own witness/audit bookkeeping.
   */
  async syncMirroredAmount(
    prisma: Prisma.TransactionClient,
    transactionId: string,
    newAmount: number,
    userId: string,
  ): Promise<void> {
    const mirrored = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        type: true,
        amount: true,
        parentId: true,
        isMirroredFromProject: true,
      },
    });
    if (!mirrored) return;

    // Defense in depth: this method exists to mutate a passive project→contact
    // mirror, never the origin side directly (that goes through update()'s own
    // guards). Guards against a future call site passing the wrong id.
    if (!mirrored.isMirroredFromProject) {
      throw new ForbiddenException(
        'This transaction was not created from a project link and cannot be synced this way.',
      );
    }

    if (newAmount <= 0) {
      throw new BadRequestException(
        'Transaction amount must be greater than zero',
      );
    }

    const previousAmount = mirrored.amount ? Number(mirrored.amount) : 0;
    if (newAmount === previousAmount) return;

    // If this is itself a lifecycle parent (loan/escrow), shrinking it below
    // what's already been settled by its children would leave a negative
    // outstanding balance — the same bound createWithClient enforces when a
    // repayment/remittance is first created.
    const isLifecycleParent =
      mirrored.type === 'LOAN_GIVEN' ||
      mirrored.type === 'LOAN_RECEIVED' ||
      mirrored.type === 'ESCROWED';
    let alreadySettled = 0;
    if (isLifecycleParent) {
      const children = await prisma.transaction.findMany({
        where: { parentId: transactionId, status: { not: 'CANCELLED' } },
        select: { amount: true },
      });
      alreadySettled = children.reduce(
        (sum, child) => sum + (child.amount ? Number(child.amount) : 0),
        0,
      );
      if (newAmount < alreadySettled) {
        throw new BadRequestException(
          `Amount (${newAmount}) cannot be less than the amount already settled (${alreadySettled}) against this transaction`,
        );
      }
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { amount: newAmount },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        userId,
        changeType: 'UPDATE',
        previousState: { amount: previousAmount } as Prisma.InputJsonValue,
        newState: { amount: newAmount } as Prisma.InputJsonValue,
      },
    });

    if (mirrored.parentId) {
      await this.recomputeParentLoanStatus(prisma, mirrored.parentId, userId);
    }
    if (isLifecycleParent) {
      await this.recomputeParentLoanStatus(
        prisma,
        transactionId,
        userId,
        alreadySettled,
      );
    }
  }

  /**
   * Hard-deletes a mirrored Transaction. Callers (ProjectTransactionsService
   * via ProjectContactLinkService, or `remove()` below for the reverse
   * direction) must have already verified no witnesses/conversions exist on
   * it. Reopens the parent loan's settlement status if it was itself a
   * repayment/remittance child.
   */
  async deleteMirroredTransaction(
    prisma: Prisma.TransactionClient,
    transactionId: string,
    userId: string,
  ): Promise<void> {
    const mirrored = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!mirrored) return;

    await prisma.transaction.delete({ where: { id: transactionId } });

    if (mirrored.parentId) {
      await this.recomputeParentLoanStatus(prisma, mirrored.parentId, userId);
    }
  }

  async addWitness(
    addWitnessInput: AddWitnessInput,
    userId: string,
    orgId: string | null = null,
  ) {
    const { transactionId, witnessUserIds, witnessInvites } = addWitnessInput;

    const transaction = await this.findOne(transactionId, userId, orgId);

    if (transaction.isMirroredFromProject) {
      throw new BadRequestException(
        'This transaction originated from a project. Add witnesses from the project page instead.',
      );
    }

    if (transaction.orgSourceTransactionId) {
      throw new BadRequestException(
        'This is a personal-ledger reflection of an organisation transaction and cannot be witnessed directly.',
      );
    }

    let notifications: WitnessNotification[] = [];
    const updatedTransaction = await this.prisma.$transaction(
      async (prisma) => {
        notifications = await this.processWitnesses(
          transaction.id,
          witnessUserIds,
          witnessInvites,
          prisma,
        );

        // Return updated transaction with witnesses
        return prisma.transaction.findUnique({
          where: { id: transactionId },
          include: {
            witnesses: {
              include: {
                user: true,
              },
            },
          },
        });
      },
    );

    // Send notifications after transaction commits
    if (notifications.length > 0) {
      await this.notifyWitnesses(notifications).catch((err) => {
        console.error('Failed to send witness notifications:', err);
      });
    }

    return updatedTransaction;
  }

  private flipStatePerspective(state: Record<string, unknown> | null) {
    if (!state) return null;
    const flipped = { ...state };
    if (typeof state.type === 'string' && PERSPECTIVE_FLIP_MAP[state.type]) {
      flipped.type = PERSPECTIVE_FLIP_MAP[state.type];
    }
    return flipped;
  }

  private applyPerspective<
    T extends {
      createdById: string;
      type: TransactionType;
      history?: {
        previousState: unknown;
        newState: unknown;
      }[];
      createdBy?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        isSupporter: boolean;
      } | null;
      contact?: unknown;
    },
  >(transaction: T, userId: string): T {
    if (transaction.createdById === userId) return transaction;

    // Flip perspective for the contact
    const transformed = { ...transaction };

    // If we have creator info, use it as the contact for the viewer
    if (transaction.createdBy) {
      // Create a virtual contact from the creator
      const creator = transaction.createdBy;
      const virtualContact = {
        id: creator.id, // Using creator's user ID as contact ID
        firstName: creator.firstName,
        lastName: creator.lastName,
        name: `${creator.firstName} ${creator.lastName}`,
        email: creator.email,
        isSupporter: creator.isSupporter,
        linkedUserId: creator.id,
        userId: userId, // The viewer "owns" this virtual contact view
        isOnPlatform: true,
      };

      // We need to cast this because we're modifying the structure potentially
      transformed.contact = virtualContact;
    }

    if (PERSPECTIVE_FLIP_MAP[transaction.type]) {
      transformed.type = PERSPECTIVE_FLIP_MAP[
        transaction.type
      ] as TransactionType;
    }

    // Flip history entries if present
    if (transformed.history && Array.isArray(transformed.history)) {
      transformed.history = transformed.history.map((h) => ({
        ...h,
        previousState: this.flipStatePerspective(
          h.previousState as Record<string, unknown>,
        ),
        newState: this.flipStatePerspective(
          h.newState as Record<string, unknown>,
        ),
      }));
    }

    return transformed;
  }

  async findAll(
    userId: string,
    orgId: string | null,
    filter?: FilterTransactionInput,
  ) {
    const baseWhere: Prisma.TransactionWhereInput = orgId
      ? { orgId }
      : { createdById: userId, orgId: null };

    const where: Prisma.TransactionWhereInput = {
      ...baseWhere,
      status: { not: TransactionStatus.CANCELLED },
    };

    if (filter) {
      if (filter.contactId) {
        const contact = await this.prisma.contact.findUnique({
          where: { id: filter.contactId },
        });

        if (contact?.linkedUserId) {
          // If we're filtering by a contact who is also a user,
          // we want transactions we created with them OR transactions they created with us
          where.OR = [
            { createdById: userId, contactId: filter.contactId },
            {
              createdById: contact.linkedUserId,
              contact: { linkedUserId: userId },
            },
          ];
        } else {
          // Regular contact, only transactions we created
          delete where.OR;
          where.createdById = userId;
          where.contactId = filter.contactId;
        }
      }

      if (filter.types && filter.types.length > 0) {
        where.type = { in: filter.types };
      }
      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.currency) {
        where.currency = filter.currency;
      }
      if (filter.startDate || filter.endDate) {
        where.date = {
          ...(filter.startDate && { gte: filter.startDate }),
          ...(filter.endDate && { lte: filter.endDate }),
        };
      }
      if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
        where.amount = {
          ...(filter.minAmount !== undefined && { gte: filter.minAmount }),
          ...(filter.maxAmount !== undefined && { lte: filter.maxAmount }),
        };
      }
      if (filter.search) {
        const searchFilter = {
          OR: [
            { description: { contains: filter.search, mode: 'insensitive' } },
            { itemName: { contains: filter.search, mode: 'insensitive' } },
            {
              contact: {
                OR: [
                  {
                    firstName: { contains: filter.search, mode: 'insensitive' },
                  },
                  {
                    lastName: { contains: filter.search, mode: 'insensitive' },
                  },
                ],
              },
            },
          ],
        };

        // Combine search with existing where
        const existingWhere = { ...where };
        delete where.OR;
        delete where.createdById;
        delete where.contactId;

        where.AND = [
          existingWhere,
          searchFilter as Prisma.TransactionWhereInput,
        ];
      }
    }

    // Default to excluding cancelled transactions from general list
    if (!where.status) {
      where.status = { not: TransactionStatus.CANCELLED };
    }

    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;
    const skip = (page - 1) * limit;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: {
          contact: true,
          createdBy: true,
          witnesses: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    const transformedItems = items.map((item) =>
      this.applyPerspective(item, userId),
    );

    const combinedItems = transformedItems;

    // Determine target currency for summary
    let targetCurrency = filter?.summaryCurrency || filter?.currency;
    if (!targetCurrency) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredCurrency: true },
      });
      targetCurrency = user?.preferredCurrency || 'NGN';
    }

    const summary = await this.calculateConvertedSummary(
      userId,
      where,
      targetCurrency,
    );

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: combinedItems as any,
      summary,
      total,
      page,
      limit,
    };
  }

  private async calculateConvertedSummary(
    userId: string,
    where: Prisma.TransactionWhereInput,
    targetCurrency: string,
  ) {
    // 1. Aggregations for transactions created by the user
    const ownAggregations = await this.prisma.transaction.groupBy({
      by: ['type', 'currency'],
      where: { ...where, createdById: userId },
      _sum: {
        amount: true,
      },
    });

    // 2. Aggregations for transactions where user is the contact (flip required)
    const contactAggregations = await this.prisma.transaction.groupBy({
      by: ['type', 'currency'],
      where: {
        ...where,
        createdById: { not: userId },
        contact: { linkedUserId: userId },
      },
      _sum: {
        amount: true,
      },
    });

    const summary: TransactionSummary = {
      totalLoanGiven: 0,
      totalLoanReceived: 0,
      totalRepaymentMade: 0,
      totalRepaymentReceived: 0,
      totalGiftGiven: 0,
      totalGiftReceived: 0,
      totalAdvancePaid: 0,
      totalAdvanceReceived: 0,
      totalDepositPaid: 0,
      totalDepositReceived: 0,
      totalEscrowed: 0,
      totalRemitted: 0,
      netBalance: 0,
      currency: targetCurrency,
    };

    // Process own transactions
    for (const agg of ownAggregations) {
      const amount = Number(agg._sum.amount) || 0;
      if (amount === 0) continue;

      const convertedAmount = await this.exchangeRateService.convert(
        amount,
        agg.currency,
        targetCurrency,
      );

      this.updateSummaryWithTransaction(summary, agg.type, convertedAmount);
    }

    // Process contact transactions (with flip)
    for (const agg of contactAggregations) {
      const amount = Number(agg._sum.amount) || 0;
      if (amount === 0) continue;

      const convertedAmount = await this.exchangeRateService.convert(
        amount,
        agg.currency,
        targetCurrency,
      );

      const flippedType = (PERSPECTIVE_FLIP_MAP[agg.type] ??
        agg.type) as TransactionType;
      this.updateSummaryWithTransaction(summary, flippedType, convertedAmount);
    }

    summary.netBalance = computeNetBalance(summary);

    return summary;
  }

  private updateSummaryWithTransaction(
    summary: TransactionSummary,
    type: TransactionType,
    amount: number,
  ) {
    const fieldMap: Partial<Record<string, keyof TransactionSummary>> = {
      LOAN_GIVEN: 'totalLoanGiven',
      LOAN_RECEIVED: 'totalLoanReceived',
      REPAYMENT_MADE: 'totalRepaymentMade',
      REPAYMENT_RECEIVED: 'totalRepaymentReceived',
      GIFT_GIVEN: 'totalGiftGiven',
      GIFT_RECEIVED: 'totalGiftReceived',
      ADVANCE_PAID: 'totalAdvancePaid',
      ADVANCE_RECEIVED: 'totalAdvanceReceived',
      DEPOSIT_PAID: 'totalDepositPaid',
      DEPOSIT_RECEIVED: 'totalDepositReceived',
      ESCROWED: 'totalEscrowed',
      REMITTED: 'totalRemitted',
    };
    const field = fieldMap[type];
    if (field) (summary[field] as number) += amount;
  }

  async groupByContact(userId: string, filter?: FilterTransactionInput) {
    const baseWhere: Prisma.TransactionWhereInput = {
      status: { not: TransactionStatus.CANCELLED },
    };

    if (filter?.types && filter.types.length > 0) {
      baseWhere.type = { in: filter.types };
    }
    if (filter?.startDate || filter?.endDate) {
      baseWhere.date = {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate }),
      };
    }
    if (filter?.minAmount !== undefined || filter?.maxAmount !== undefined) {
      baseWhere.amount = {
        ...(filter.minAmount !== undefined && { gte: filter.minAmount }),
        ...(filter.maxAmount !== undefined && { lte: filter.maxAmount }),
      };
    }
    if (filter?.search) {
      baseWhere.OR = [
        { description: { contains: filter.search, mode: 'insensitive' } },
        { itemName: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Determine target currency for summary
    let targetCurrency = filter?.summaryCurrency || filter?.currency;
    if (!targetCurrency) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredCurrency: true },
      });
      targetCurrency = user?.preferredCurrency || 'NGN';
    }

    // 1. Aggregations for transactions created by the user
    const ownAggregations = await this.prisma.transaction.groupBy({
      by: ['contactId', 'type', 'currency'],
      where: {
        ...baseWhere,
        createdById: userId,
        contactId: filter?.contactId || undefined,
      },
      _sum: {
        amount: true,
      },
    });

    // 2. Aggregations for transactions where user is the contact (flip required)
    const sharedAggregations = await this.prisma.transaction.groupBy({
      by: ['createdById', 'type', 'currency'],
      where: {
        ...baseWhere,
        createdById: { not: userId },
        contact: { linkedUserId: userId },
      },
      _sum: {
        amount: true,
      },
    });

    // Get all contacts for this user to map names
    const contacts = await this.prisma.contact.findMany({
      where: { userId },
    });

    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    // Map linkedUserId to local contactId for shared transactions
    const linkedUserContactMap = new Map(
      contacts.filter((c) => c.linkedUserId).map((c) => [c.linkedUserId, c.id]),
    );

    // Group aggregations by contactId
    const groupedByContact = new Map<string | null, TransactionSummary>();

    const getInitialSummary = (): TransactionSummary => ({
      totalLoanGiven: 0,
      totalLoanReceived: 0,
      totalRepaymentMade: 0,
      totalRepaymentReceived: 0,
      totalGiftGiven: 0,
      totalGiftReceived: 0,
      totalAdvancePaid: 0,
      totalAdvanceReceived: 0,
      totalDepositPaid: 0,
      totalDepositReceived: 0,
      totalEscrowed: 0,
      totalRemitted: 0,
      netBalance: 0,
      currency: targetCurrency,
    });

    // Process own transactions
    for (const agg of ownAggregations) {
      const contactId = agg.contactId;
      if (!groupedByContact.has(contactId)) {
        groupedByContact.set(contactId, getInitialSummary());
      }

      const summary = groupedByContact.get(contactId);
      const amount = Number(agg._sum.amount) || 0;
      if (amount === 0) continue;

      const convertedAmount = await this.exchangeRateService.convert(
        amount,
        agg.currency,
        targetCurrency,
      );

      this.updateSummaryWithTransaction(summary, agg.type, convertedAmount);
    }

    // Process shared transactions (with flip)
    for (const agg of sharedAggregations) {
      // Find the local contact representing the creator
      const contactId = linkedUserContactMap.get(agg.createdById) || null;

      // If we are filtering by contactId and this shared transaction doesn't match, skip
      if (filter?.contactId && contactId !== filter.contactId) continue;

      if (!groupedByContact.has(contactId)) {
        groupedByContact.set(contactId, getInitialSummary());
      }

      const summary = groupedByContact.get(contactId);
      const amount = Number(agg._sum.amount) || 0;
      if (amount === 0) continue;

      const convertedAmount = await this.exchangeRateService.convert(
        amount,
        agg.currency,
        targetCurrency,
      );

      // Flip perspective
      const flippedType = (PERSPECTIVE_FLIP_MAP[agg.type] ??
        agg.type) as TransactionType;
      this.updateSummaryWithTransaction(summary, flippedType, convertedAmount);
    }

    // Calculate net balance for each contact and format result
    const result = Array.from(groupedByContact.entries()).map(
      ([contactId, summary]) => {
        summary.netBalance = computeNetBalance(summary);

        return {
          contact: contactId ? contactMap.get(contactId) : null,
          summary,
        };
      },
    );

    return result;
  }

  /**
   * Org-scoped transactions (orgId set) are shared by every active member of
   * that org — same shape as ContactsService.assertContactAccess. Personal
   * transactions (orgId null) remain gated on creator-or-linked-contact.
   */
  private async assertTransactionAccess(
    transaction: {
      orgId: string | null;
      createdById: string;
      contact?: { linkedUserId: string | null } | null;
    },
    userId: string,
    orgId: string | null,
  ): Promise<void> {
    if (transaction.orgId) {
      if (transaction.orgId !== orgId) {
        throw new ForbiddenException(
          'You do not have permission to access this transaction',
        );
      }
      const member = await this.prisma.organisationMember.findUnique({
        where: { orgId_userId: { orgId: transaction.orgId, userId } },
      });
      if (!member) {
        throw new ForbiddenException(
          'You do not have permission to access this transaction',
        );
      }
      return;
    }

    const isCreator = transaction.createdById === userId;
    const isLinkedContact = transaction.contact?.linkedUserId === userId;

    if (!isCreator && !isLinkedContact) {
      throw new ForbiddenException(
        'You do not have permission to access this transaction',
      );
    }
  }

  async findOne(
    id: string,
    userId: string,
    orgId: string | null = null,
    flipPerspective = false,
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        contact: true,
        createdBy: true,
        conversions: {
          orderBy: {
            date: 'desc',
          },
        },
        witnesses: {
          include: {
            user: true,
          },
        },
        history: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        personalMirror: {
          select: { id: true, parentId: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    await this.assertTransactionAccess(transaction, userId, orgId);

    return flipPerspective
      ? this.applyPerspective(transaction, userId)
      : transaction;
  }

  async update(
    id: string,
    updateTransactionInput: UpdateTransactionInput,
    userId: string,
    orgId: string | null = null,
  ) {
    const transaction = await this.findOne(id, userId, orgId);

    // Org-scoped transactions are shared by every active member of that org
    // (already verified by findOne/assertTransactionAccess above) — personal
    // transactions remain creator-only, so the other party in a shared
    // ledger can view but not edit.
    if (!transaction.orgId && transaction.createdById !== userId) {
      throw new ForbiddenException(
        'Only the creator can update this transaction',
      );
    }

    if (transaction.isMirroredFromProject) {
      throw new BadRequestException(
        'This transaction originated from a project. Edit it from the project page instead.',
      );
    }

    if (transaction.orgSourceTransactionId) {
      throw new BadRequestException(
        'This is a personal-ledger reflection of an organisation transaction. Edit it from the organisation instead.',
      );
    }

    // Create audit log entry
    const previousState = {
      category: transaction.category,
      amount: transaction.amount,
      currency: transaction.currency,
      itemName: transaction.itemName,
      quantity: transaction.quantity,
      type: transaction.type,
      date: transaction.date,
      description: transaction.description,
      contactId: transaction.contactId,
    };

    const {
      category,
      amount,
      currency,
      itemName,
      quantity,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      witnessUserIds, // Destructure to exclude from rest
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      witnessInvites, // Destructure to exclude from rest
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      projectId, // Not a Transaction column — consumed by ProjectContactLinkService, never persisted here
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      recordOnPersonalLedger, // Create-time only — a mirror can't be retroactively attached via update()
      ...rest
    } = updateTransactionInput;

    // Re-validate category constraints if they are being updated
    if (category === AssetCategory.FUNDS && !amount && !transaction.amount) {
      // Note: This check is simplified; ideally check if 'amount' is in input OR exists in DB.
      // For PartialType, undefined means "do not update".
    }

    // Determine what actually changed for the history log
    const changes: Prisma.TransactionUncheckedUpdateInput = {};
    const changeDescriptions: string[] = [];

    if (category && category !== transaction.category) {
      changes.category = category;
      changeDescriptions.push(`Category changed to ${category}`);
    }
    if (
      amount &&
      Number(amount) !== Number(transaction.amount) &&
      (category === AssetCategory.FUNDS ||
        (!category && transaction.category === AssetCategory.FUNDS))
    ) {
      changes.amount = amount;
      changeDescriptions.push(`Amount changed to ${amount}`);
    }
    if (currency && currency !== transaction.currency) {
      changes.currency = currency;
      changeDescriptions.push(`Currency changed to ${currency}`);
    }
    if (
      itemName &&
      itemName !== transaction.itemName &&
      (category === AssetCategory.ITEM ||
        (!category && transaction.category === AssetCategory.ITEM))
    ) {
      changes.itemName = itemName;
      changeDescriptions.push(`Item Name changed to ${itemName}`);
    }
    if (
      quantity &&
      quantity !== transaction.quantity &&
      (category === AssetCategory.ITEM ||
        (!category && transaction.category === AssetCategory.ITEM))
    ) {
      changes.quantity = quantity;
      changeDescriptions.push(`Quantity changed to ${quantity}`);
    }
    if (rest.description && rest.description !== transaction.description) {
      changes.description = rest.description;
      changeDescriptions.push('Description updated');
    }
    if (
      rest.date &&
      new Date(rest.date).getTime() !== new Date(transaction.date).getTime()
    ) {
      changes.date = rest.date;
      changeDescriptions.push(
        `Date changed to ${new Date(rest.date).toLocaleDateString()}`,
      );
    }
    if (rest.type && rest.type !== transaction.type) {
      changes.type = rest.type;
      changeDescriptions.push(`Type changed to ${rest.type}`);
    }
    if (rest.contactId && rest.contactId !== transaction.contactId) {
      changes.contactId = rest.contactId;
      changeDescriptions.push('Contact updated');
    }

    // Validate contactId if it's being updated
    if (rest.contactId && rest.contactId !== transaction.contactId) {
      // A mirror's contactId points at the sharer's personal source contact
      // of the *current* org contact — reassigning the org side would leave
      // the mirror pointing at the wrong (or a since-unshared) contact.
      // Reflecting onto a different contact requires deleting this mirror
      // and letting a fresh create() re-derive one; not supported in-place.
      if (transaction.personalMirror) {
        throw new BadRequestException(
          'Cannot reassign the contact on a transaction that has a personal-ledger mirror. Remove and recreate it instead.',
        );
      }

      const contact = await this.prisma.contact.findUnique({
        where: { id: rest.contactId },
      });

      if (!contact) {
        throw new NotFoundException(`Contact ${rest.contactId} not found`);
      }

      // Org-scoped contacts are shared by every member of that org; personal
      // contacts remain creator-only. Mirrors createWithClient's rule.
      const contactAllowed = orgId
        ? contact.orgId === orgId
        : contact.userId === userId && contact.orgId === null;
      if (!contactAllowed) {
        throw new ForbiddenException(
          'Cannot assign a transaction to a contact you do not own',
        );
      }
    }

    // Validate parentId if it's being updated
    if (rest.parentId && rest.parentId !== transaction.parentId) {
      const parent = await this.prisma.transaction.findUnique({
        where: { id: rest.parentId },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent transaction ${rest.parentId} not found`,
        );
      }

      // Org-scoped parents are shared by every member of that org; personal
      // parents remain creator-only. Mirrors createWithClient's rule.
      const parentAllowed = parent.orgId
        ? parent.orgId === orgId
        : parent.createdById === userId;
      if (!parentAllowed) {
        throw new ForbiddenException(
          'Cannot link to a transaction you do not own',
        );
      }
    }

    const hasChanges = Object.keys(changes).length > 0;

    // Business Rule: Check if any witness has acknowledged
    const acknowledgedWitnesses = transaction.witnesses.filter(
      (w: { status: WitnessStatus }) => w.status === WitnessStatus.ACKNOWLEDGED,
    );
    const hasAcknowledgedWitness = acknowledgedWitnesses.length > 0;

    if (hasChanges && hasAcknowledgedWitness) {
      // Logic for post-acknowledgement update:
      // Mark witnesses as MODIFIED instead of PENDING to indicate an update occurred
      await this.prisma.witness.updateMany({
        where: { transactionId: id, status: WitnessStatus.ACKNOWLEDGED },
        data: {
          status: WitnessStatus.MODIFIED,
          acknowledgedAt: null,
        },
      });

      // Notify witnesses
      const updater = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const updaterName = updater
        ? `${updater.firstName} ${updater.lastName}`
        : 'Transaction Owner';

      for (const witness of acknowledgedWitnesses) {
        if (witness.user && witness.user.email) {
          // Fire and forget notification
          this.notificationService
            .sendWitnessUpdateNotification(
              witness.user.email,
              witness.user.firstName || 'Witness',
              updaterName,
              changeDescriptions,
              id,
            )
            .catch((err) =>
              console.error(
                `Failed to send witness update notification to ${witness.user.email}`,
                err,
              ),
            );
        }

        this.inAppNotificationsService.createSafely(
          {
            userId: witness.userId,
            ...NotificationTemplates.witnessTransactionModified(
              updaterName,
              id,
            ),
          },
          `witness transaction modified (${witness.userId})`,
        );
      }
    }

    const updatedTransaction = await this.prisma.$transaction(
      async (prisma) => {
        const updated = await prisma.transaction.update({
          where: { id },
          data: {
            ...(category && { category }),
            amount:
              category === AssetCategory.FUNDS
                ? amount
                : category === AssetCategory.ITEM
                  ? null
                  : amount,
            itemName:
              category === AssetCategory.ITEM
                ? itemName
                : category === AssetCategory.FUNDS
                  ? null
                  : itemName,
            quantity:
              category === AssetCategory.ITEM
                ? quantity
                : category === AssetCategory.FUNDS
                  ? null
                  : quantity,
            ...rest,
          },
        });

        await prisma.transactionHistory.create({
          data: {
            transactionId: id,
            userId,
            changeType: hasAcknowledgedWitness ? 'UPDATE_POST_ACK' : 'UPDATE',
            previousState: previousState as Prisma.InputJsonValue,
            newState: changes as Prisma.InputJsonValue,
          },
        });

        if (witnessUserIds || witnessInvites) {
          await this.processWitnesses(
            id,
            witnessUserIds,
            witnessInvites,
            prisma as Prisma.TransactionClient,
          );
        }

        // Re-evaluate the parent's settled status when a child's amount
        // changes, OR when this transaction is itself a loan whose face
        // amount was edited (the outstanding balance shifts).
        const amountChanged = changes.amount !== undefined;
        if (amountChanged) {
          if (transaction.parentId) {
            await this.recomputeParentLoanStatus(
              prisma as Prisma.TransactionClient,
              transaction.parentId,
              userId,
            );
          }
          if (
            transaction.type === 'LOAN_GIVEN' ||
            transaction.type === 'LOAN_RECEIVED' ||
            transaction.type === 'ESCROWED'
          ) {
            await this.recomputeParentLoanStatus(
              prisma as Prisma.TransactionClient,
              id,
              userId,
            );
          }
        }

        // Propagate edits onto this transaction's personal-ledger mirror
        // (see maybeCreatePersonalMirror) so the two ledgers never drift.
        if (transaction.personalMirror) {
          const mirrorChanges: Prisma.TransactionUncheckedUpdateInput = {};
          if (changes.amount !== undefined)
            mirrorChanges.amount = changes.amount;
          if (changes.date !== undefined) mirrorChanges.date = changes.date;
          if (changes.description !== undefined)
            mirrorChanges.description = changes.description;
          if (changes.type !== undefined) mirrorChanges.type = changes.type;
          if (changes.currency !== undefined)
            mirrorChanges.currency = changes.currency;
          if (changes.category !== undefined)
            mirrorChanges.category = changes.category;
          if (changes.itemName !== undefined)
            mirrorChanges.itemName = changes.itemName;
          if (changes.quantity !== undefined)
            mirrorChanges.quantity = changes.quantity;
          // contactId is deliberately never forwarded — the mirror's
          // contactId points at the personal source contact and is
          // rejected outright by the reassignment guard above whenever a
          // mirror exists, so `changes.contactId` can never be set here.

          if (Object.keys(mirrorChanges).length > 0) {
            await (prisma as Prisma.TransactionClient).transaction.update({
              where: { id: transaction.personalMirror.id },
              data: mirrorChanges,
            });
          }

          if (amountChanged) {
            // Mirror child (e.g. repayment) settling a mirrored loan.
            if (transaction.personalMirror.parentId) {
              await this.recomputeParentLoanStatus(
                prisma as Prisma.TransactionClient,
                transaction.personalMirror.parentId,
                userId,
              );
            }
            // Mirror is itself a lifecycle parent whose face amount moved.
            if (
              transaction.type === 'LOAN_GIVEN' ||
              transaction.type === 'LOAN_RECEIVED' ||
              transaction.type === 'ESCROWED'
            ) {
              await this.recomputeParentLoanStatus(
                prisma as Prisma.TransactionClient,
                transaction.personalMirror.id,
                userId,
              );
            }
          }
        }

        return updated;
      },
    );

    return updatedTransaction;
  }

  /**
   * Reverses a mirrored ProjectTransaction's contribution to `project.balance`
   * without touching the row itself — shared by the soft-cancel branch of
   * `remove()` (row survives) and `deleteMirroredProjectTransaction` (row is
   * about to be deleted) so the same balance math isn't hand-copied twice.
   * Takes the already-fetched row's fields directly so neither caller pays
   * for a redundant re-fetch.
   */
  private async reverseMirroredProjectTransactionBalance(
    prisma: Prisma.TransactionClient,
    mirrored: {
      projectId: string;
      type: ProjectTransactionType;
      amount: Prisma.Decimal | number;
    },
  ): Promise<void> {
    const balanceEffect = computeProjectTransactionBalanceEffect(
      mirrored.type,
      Number(mirrored.amount),
    );

    await prisma.project.update({
      where: { id: mirrored.projectId },
      data: { balance: { decrement: balanceEffect } },
    });
  }

  /**
   * Reverse direction of `ProjectContactLinkService`'s mirror-deletion: this
   * Transaction is the origin of a contact→project link, so its mirrored
   * ProjectTransaction (never independently witnessed) is removed alongside
   * it and the project balance reversed. Called only from the hard-delete
   * branch of `remove()` below — the soft-cancel branch only reverses the
   * mirror's balance contribution, since the mirror row itself must survive
   * (Transaction.projectTransactionId's onDelete: Restrict still references it).
   */
  private async deleteMirroredProjectTransaction(
    prisma: Prisma.TransactionClient,
    projectTransactionId: string,
  ): Promise<void> {
    const mirrored = await prisma.projectTransaction.findUnique({
      where: { id: projectTransactionId },
      include: { witnesses: true },
    });
    if (!mirrored) return;

    // Defense in depth: this helper only ever deletes a ProjectTransaction
    // that is itself a passive mirror of THIS Transaction (created via
    // ProjectContactLinkService.createContactOriginated with
    // isMirroredFromContact: true) — never a project-originated row. Guards
    // against a future call site reaching this method for the wrong row.
    if (!mirrored.isMirroredFromContact) {
      throw new ForbiddenException(
        'This project transaction was not created from a contact link and cannot be deleted this way.',
      );
    }

    // Defense in depth: ProjectTransaction mirrors are never witnessed by
    // design (witnessing stays on whichever side originated the entry), so
    // this should never trip today. Guards against a future change adding
    // witness support to a contact-originated mirror silently losing its
    // audit trail here.
    if (mirrored.witnesses.length > 0) {
      throw new ForbiddenException(
        'The linked project transaction has witnesses and cannot be deleted.',
      );
    }

    await this.reverseMirroredProjectTransactionBalance(prisma, mirrored);

    await prisma.projectTransaction.delete({
      where: { id: projectTransactionId },
    });
  }

  async remove(id: string, userId: string, orgId: string | null = null) {
    const transaction = await this.findOne(id, userId, orgId);

    // Org-scoped transactions are shared by every active member of that org
    // (already verified by findOne/assertTransactionAccess above) — personal
    // transactions remain creator-only.
    if (!transaction.orgId && transaction.createdById !== userId) {
      throw new ForbiddenException(
        'Only the creator can remove this transaction',
      );
    }

    if (transaction.isMirroredFromProject) {
      throw new BadRequestException(
        'This transaction originated from a project. Delete it from the project page instead.',
      );
    }

    if (transaction.orgSourceTransactionId) {
      throw new BadRequestException(
        'This is a personal-ledger reflection of an organisation transaction. Delete it from the organisation instead.',
      );
    }

    // If there are no witnesses, we can safely hard-delete
    if (transaction.witnesses.length === 0) {
      const deleted = await this.prisma.$transaction(async (prisma) => {
        // Tear down the personal-ledger mirror first — its FK back to this
        // row is ON DELETE SET NULL, which would otherwise leave an
        // orphaned "on behalf of" entry with no org transaction to point to.
        if (transaction.personalMirror) {
          await this.deleteMirroredTransaction(
            prisma as Prisma.TransactionClient,
            transaction.personalMirror.id,
            userId,
          );
        }
        const removed = await prisma.transaction.delete({ where: { id } });
        if (transaction.parentId) {
          await this.recomputeParentLoanStatus(
            prisma as Prisma.TransactionClient,
            transaction.parentId,
            userId,
          );
        }
        if (transaction.projectTransactionId) {
          await this.deleteMirroredProjectTransaction(
            prisma as Prisma.TransactionClient,
            transaction.projectTransactionId,
          );
        }
        return removed;
      });
      return deleted;
    }

    // If there are witnesses, we mark as CANCELLED to preserve accountability
    // and notify witnesses.
    const cancelledTransaction = await this.prisma.$transaction(
      async (prisma) => {
        const updated = await prisma.transaction.update({
          where: { id },
          data: { status: TransactionStatus.CANCELLED },
        });
        await prisma.transactionHistory.create({
          data: {
            transactionId: id,
            userId,
            changeType: 'CANCELLED',
            previousState: {
              status: transaction.status,
            } as Prisma.InputJsonValue,
            newState: {
              status: TransactionStatus.CANCELLED,
            } as Prisma.InputJsonValue,
          },
        });
        // Cancelling a child repayment can re-open the parent loan
        if (transaction.parentId) {
          await this.recomputeParentLoanStatus(
            prisma as Prisma.TransactionClient,
            transaction.parentId,
            userId,
          );
        }
        // Deliberately does NOT delete a linked mirrored ProjectTransaction
        // here: this row is only soft-cancelled, not removed, so
        // Transaction.projectTransactionId (onDelete: Restrict) still
        // references it — attempting the delete would violate that FK and
        // roll back the whole cancellation. ProjectTransaction has no
        // CANCELLED-equivalent status, so the project side keeps showing
        // this entry as-is (for history); only a hard delete (no witnesses)
        // removes the row. But project.balance itself must stop counting a
        // cancelled entry — computeNetBalance already excludes CANCELLED
        // transactions from the contact side, so the project side needs the
        // same exclusion or its balance permanently overstates the voided
        // amount.
        if (transaction.projectTransactionId) {
          const mirrored = await prisma.projectTransaction.findUnique({
            where: { id: transaction.projectTransactionId },
          });
          if (mirrored) {
            await this.reverseMirroredProjectTransactionBalance(
              prisma as Prisma.TransactionClient,
              mirrored,
            );
          }
        }
        // Cascade the cancellation onto the personal-ledger mirror too —
        // unlike the project mirror above, this is always safe: a mirror
        // can never carry its own witnesses (it's a bookkeeping echo, not
        // an independently-witnessed event), so no FK/witness conflict
        // blocks updating it directly.
        if (transaction.personalMirror) {
          await (prisma as Prisma.TransactionClient).transaction.update({
            where: { id: transaction.personalMirror.id },
            data: { status: TransactionStatus.CANCELLED },
          });
          if (transaction.personalMirror.parentId) {
            await this.recomputeParentLoanStatus(
              prisma as Prisma.TransactionClient,
              transaction.personalMirror.parentId,
              userId,
            );
          }
        }
        return updated;
      },
    );

    // Notify acknowledged witnesses
    const acknowledgedWitnesses = transaction.witnesses.filter(
      (w: { status: WitnessStatus }) => w.status === WitnessStatus.ACKNOWLEDGED,
    );

    if (acknowledgedWitnesses.length > 0) {
      const owner = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const ownerName = owner
        ? `${owner.firstName} ${owner.lastName}`
        : 'Transaction Owner';

      for (const witness of acknowledgedWitnesses) {
        if (witness.user && witness.user.email) {
          this.notificationService
            .sendWitnessUpdateNotification(
              witness.user.email,
              witness.user.firstName || 'Witness',
              ownerName,
              ['This transaction has been cancelled/voided.'],
              id,
            )
            .catch((err) =>
              console.error(
                `Failed to send cancellation notification to ${witness.user.email}`,
                err,
              ),
            );
        }

        this.inAppNotificationsService.createSafely(
          {
            userId: witness.userId,
            ...NotificationTemplates.witnessTransactionCancelled(ownerName, id),
          },
          `witness transaction cancelled (${witness.userId})`,
        );
      }
    }

    return cancelledTransaction;
  }

  async findMyContactTransactions(
    userId: string,
    filter?: FilterSharedHistoryInput,
  ) {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      contact: {
        linkedUserId: userId,
      },
    };

    if (filter?.types && filter.types.length > 0) {
      where.type = { in: filter.types };
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.startDate || filter?.endDate) {
      where.date = {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate }),
      };
    }
    if (filter?.search) {
      const searchFilter: Prisma.TransactionWhereInput = {
        OR: [
          { description: { contains: filter.search, mode: 'insensitive' } },
          {
            createdBy: {
              firstName: { contains: filter.search, mode: 'insensitive' },
            },
          },
          {
            createdBy: {
              lastName: { contains: filter.search, mode: 'insensitive' },
            },
          },
        ],
      };
      const existingWhere = { ...where };
      where.AND = [existingWhere, searchFilter];
      delete where.contact;
      delete where.type;
      delete where.status;
      delete where.date;
    }

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: {
          contact: true,
          createdBy: true,
          witnesses: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map((item) => this.applyPerspective(item, userId)),
      total,
      page,
      limit,
    };
  }
}
