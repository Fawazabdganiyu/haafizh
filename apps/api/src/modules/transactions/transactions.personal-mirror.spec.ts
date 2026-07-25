import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationService } from '../notifications/notification.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { TransactionType, AssetCategory } from '../../generated/prisma/client';

/**
 * Covers TransactionsService.maybeCreatePersonalMirror and the guards that
 * protect a mirror row once created (see transactions.service.ts, and the
 * shared-contacts plan at .claude/plans/as-a-member-and-melodic-aho.md).
 */

const ORG_ID = 'org-1';
const CREATOR_ID = 'creator-1';
const OTHER_MEMBER_ID = 'member-2';
const ORG_CONTACT_ID = 'org-contact-1';
const PERSONAL_CONTACT_ID = 'personal-contact-1';
const TX_DATE = new Date('2026-03-22');

// Org-scoped copy of a personal contact, as produced by promoteContactToOrg.
const orgContactSharedByCreator = {
  id: ORG_CONTACT_ID,
  orgId: ORG_ID,
  userId: CREATOR_ID,
  sourceContactId: PERSONAL_CONTACT_ID,
};

// Same org contact, but created directly in the org (never shared in).
const orgContactCreatedDirectly = {
  id: ORG_CONTACT_ID,
  orgId: ORG_ID,
  userId: CREATOR_ID,
  sourceContactId: null,
};

const personalSourceContactOwnedByCreator = {
  id: PERSONAL_CONTACT_ID,
  userId: CREATOR_ID,
  orgId: null,
};

const personalSourceContactOwnedByOther = {
  id: PERSONAL_CONTACT_ID,
  userId: OTHER_MEMBER_ID,
  orgId: null,
};

function contactMap(
  ...contacts: Array<{ id: string } & Record<string, unknown>>
) {
  const byId = new Map(contacts.map((c) => [c.id, c]));
  return ({ where }: { where: { id: string } }) =>
    Promise.resolve(byId.get(where.id) ?? null);
}

const mockPrismaService = {
  transaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contact: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  organisationMember: {
    findUnique: jest.fn(),
  },
  transactionHistory: {
    create: jest.fn(),
  },
  witness: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

const mockNotificationService = {
  sendTransactionWitnessInvite: jest.fn(),
  sendWitnessUpdateNotification: jest.fn(),
  sendContactNotification: jest.fn().mockResolvedValue(undefined),
};

describe('TransactionsService — personal-ledger mirror (maybeCreatePersonalMirror)', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn(), get: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ExchangeRateService, useValue: {} },
        {
          provide: InAppNotificationsService,
          useValue: { createSafely: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
    jest.clearAllMocks();

    // findUnique with no id (e.g. processWitnesses' post-create lookup, or a
    // parent lookup no test cares about) safely resolves to null by default.
    mockPrismaService.transaction.findUnique.mockResolvedValue(null);
    mockPrismaService.transaction.findMany.mockResolvedValue([]);

    let createCount = 0;
    mockPrismaService.transaction.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        createCount += 1;
        return Promise.resolve({ id: `created-tx-${createCount}`, ...data });
      },
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('top-level creation (no parentId)', () => {
    const baseInput = {
      type: TransactionType.LOAN_GIVEN,
      category: AssetCategory.FUNDS,
      amount: 5000,
      currency: 'NGN',
      contactId: ORG_CONTACT_ID,
      date: TX_DATE,
    };

    it('creates a personal-ledger mirror when org mode + toggle on + contact shared from own personal list', async () => {
      mockPrismaService.contact.findUnique.mockImplementation(
        contactMap(
          orgContactSharedByCreator,
          personalSourceContactOwnedByCreator,
        ),
      );

      await service.create(
        { ...baseInput, recordOnPersonalLedger: true },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(2);
      const [orgCall, mirrorCall] =
        mockPrismaService.transaction.create.mock.calls;
      const orgTxId = (
        await mockPrismaService.transaction.create.mock.results[0].value
      ).id;

      expect(orgCall[0].data).toMatchObject({
        orgId: ORG_ID,
        contactId: ORG_CONTACT_ID,
        createdById: CREATOR_ID,
      });
      expect(mirrorCall[0].data).toMatchObject({
        orgId: null,
        contactId: PERSONAL_CONTACT_ID,
        createdById: CREATOR_ID,
        orgSourceTransactionId: orgTxId,
        type: TransactionType.LOAN_GIVEN,
        currency: 'NGN',
        parentId: undefined,
      });
      expect(mirrorCall[0].data.amount).toBeDefined();
    });

    it('does NOT create a mirror in personal mode (orgId null)', async () => {
      mockPrismaService.contact.findUnique.mockImplementation(
        contactMap(
          { ...orgContactSharedByCreator, orgId: null, userId: CREATOR_ID },
          personalSourceContactOwnedByCreator,
        ),
      );

      await service.create(
        { ...baseInput, recordOnPersonalLedger: true },
        CREATOR_ID,
        null,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT create a mirror when recordOnPersonalLedger is not set', async () => {
      mockPrismaService.contact.findUnique.mockImplementation(
        contactMap(
          orgContactSharedByCreator,
          personalSourceContactOwnedByCreator,
        ),
      );

      await service.create(baseInput, CREATOR_ID, ORG_ID);

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });

    it('does NOT create a mirror when the contact was created directly in the org (no sourceContactId)', async () => {
      mockPrismaService.contact.findUnique.mockImplementation(
        contactMap(orgContactCreatedDirectly),
      );

      await service.create(
        { ...baseInput, recordOnPersonalLedger: true },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });

    it("does NOT create a mirror when the personal source contact belongs to a different member — reflecting onto someone else's ledger is never allowed", async () => {
      mockPrismaService.contact.findUnique.mockImplementation(
        contactMap(
          orgContactSharedByCreator,
          personalSourceContactOwnedByOther,
        ),
      );

      await service.create(
        { ...baseInput, recordOnPersonalLedger: true },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('child creation (repayment against a mirrored loan)', () => {
    it('mirrors the child automatically onto the existing parent mirror, ignoring the toggle, and recomputes the mirror parent status', async () => {
      const orgParentLoan = {
        id: 'org-parent-1',
        orgId: ORG_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_RECEIVED,
        category: AssetCategory.FUNDS,
        currency: 'NGN',
        amount: 1000,
        createdById: CREATOR_ID,
      };
      const mirrorParent = {
        id: 'mirror-parent-1',
        contactId: PERSONAL_CONTACT_ID,
        createdById: CREATOR_ID,
        amount: 1000,
        status: 'PENDING',
        type: TransactionType.LOAN_RECEIVED,
      };

      mockPrismaService.transaction.findUnique.mockImplementation(
        ({
          where,
        }: {
          where: { id?: string; orgSourceTransactionId?: string };
        }) => {
          if (where.id === 'org-parent-1')
            return Promise.resolve(orgParentLoan);
          if (where.orgSourceTransactionId === 'org-parent-1')
            return Promise.resolve(mirrorParent);
          return Promise.resolve(null);
        },
      );

      // recomputeParentLoanStatus is exercised separately in its own suite
      // (transactions.mirror-guards.spec.ts) — stub it here so this test
      // stays focused on the mirror-creation call itself.
      const recomputeSpy = jest
        .spyOn(
          service as unknown as {
            recomputeParentLoanStatus: (...args: unknown[]) => Promise<void>;
          },
          'recomputeParentLoanStatus',
        )
        .mockResolvedValue(undefined);

      await service.create(
        {
          type: TransactionType.REPAYMENT_MADE,
          category: AssetCategory.FUNDS,
          amount: 400,
          currency: 'NGN',
          parentId: 'org-parent-1',
          date: TX_DATE,
        },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(2);
      const [orgRepaymentCall, mirrorRepaymentCall] =
        mockPrismaService.transaction.create.mock.calls;
      const orgRepaymentId = (
        await mockPrismaService.transaction.create.mock.results[0].value
      ).id;

      expect(orgRepaymentCall[0].data).toMatchObject({
        orgId: ORG_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.REPAYMENT_MADE,
      });
      expect(mirrorRepaymentCall[0].data).toMatchObject({
        orgId: null,
        contactId: PERSONAL_CONTACT_ID,
        parentId: 'mirror-parent-1',
        orgSourceTransactionId: orgRepaymentId,
        type: TransactionType.REPAYMENT_MADE,
      });

      // Both the org parent and the mirror parent get their settlement
      // status recomputed — the personal ledger must not lag behind.
      expect(recomputeSpy).toHaveBeenCalledWith(
        expect.anything(),
        'mirror-parent-1',
        CREATOR_ID,
      );
      expect(recomputeSpy).toHaveBeenCalledWith(
        expect.anything(),
        'org-parent-1',
        CREATOR_ID,
      );
    });

    it('does NOT mirror a repayment child when the parent org loan was never itself mirrored', async () => {
      const orgParentLoan = {
        id: 'org-parent-2',
        orgId: ORG_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_RECEIVED,
        category: AssetCategory.FUNDS,
        currency: 'NGN',
        amount: 1000,
        createdById: CREATOR_ID,
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({
          where,
        }: {
          where: { id?: string; orgSourceTransactionId?: string };
        }) => {
          if (where.id === 'org-parent-2')
            return Promise.resolve(orgParentLoan);
          // No mirror exists for this parent.
          if (where.orgSourceTransactionId === 'org-parent-2')
            return Promise.resolve(null);
          return Promise.resolve(null);
        },
      );

      await service.create(
        {
          type: TransactionType.REPAYMENT_MADE,
          category: AssetCategory.FUNDS,
          amount: 400,
          currency: 'NGN',
          parentId: 'org-parent-2',
          date: TX_DATE,
        },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });

    it("does NOT mirror a repayment onto a different member's personal ledger — the parent mirror belongs to whoever originally shared the contact, not the caller", async () => {
      const orgParentLoan = {
        id: 'org-parent-3',
        orgId: ORG_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_RECEIVED,
        category: AssetCategory.FUNDS,
        currency: 'NGN',
        amount: 1000,
        createdById: CREATOR_ID,
      };
      // The mirror was created by CREATOR_ID when they shared the contact —
      // OTHER_MEMBER_ID is a different org member recording this repayment.
      const mirrorParent = {
        id: 'mirror-parent-3',
        contactId: PERSONAL_CONTACT_ID,
        createdById: CREATOR_ID,
        amount: 1000,
        status: 'PENDING',
        type: TransactionType.LOAN_RECEIVED,
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({
          where,
        }: {
          where: { id?: string; orgSourceTransactionId?: string };
        }) => {
          if (where.id === 'org-parent-3')
            return Promise.resolve(orgParentLoan);
          if (where.orgSourceTransactionId === 'org-parent-3')
            return Promise.resolve(mirrorParent);
          return Promise.resolve(null);
        },
      );
      jest
        .spyOn(
          service as unknown as {
            recomputeParentLoanStatus: (...args: unknown[]) => Promise<void>;
          },
          'recomputeParentLoanStatus',
        )
        .mockResolvedValue(undefined);

      await service.create(
        {
          type: TransactionType.REPAYMENT_MADE,
          category: AssetCategory.FUNDS,
          amount: 400,
          currency: 'NGN',
          parentId: 'org-parent-3',
          date: TX_DATE,
        },
        OTHER_MEMBER_ID,
        ORG_ID,
      );

      // Only the org repayment is created — no mirror write onto CREATOR_ID's
      // personal contact on OTHER_MEMBER_ID's behalf.
      expect(mockPrismaService.transaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('guards against operating on a mirror row directly', () => {
    const mirrorRow = {
      id: 'mirror-1',
      createdById: CREATOR_ID,
      contactId: PERSONAL_CONTACT_ID,
      type: TransactionType.LOAN_GIVEN,
      status: 'PENDING',
      amount: 1000,
      currency: 'NGN',
      orgId: null,
      orgSourceTransactionId: 'org-tx-1',
      parentId: null,
      projectTransactionId: null,
      isMirroredFromProject: false,
      contact: { linkedUserId: null },
      witnesses: [],
      history: [],
      conversions: [],
    };

    it('rejects editing a mirror row directly', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(mirrorRow);

      await expect(
        service.update(
          'mirror-1',
          { id: 'mirror-1', description: 'changed' },
          CREATOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects removing a mirror row directly', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(mirrorRow);

      await expect(service.remove('mirror-1', CREATOR_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects adding a witness to a mirror row directly', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(mirrorRow);

      await expect(
        service.addWitness(
          { transactionId: 'mirror-1', witnessUserIds: ['w1'] },
          CREATOR_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects recording a repayment directly against a mirror parent (children only mirror automatically from the org side)', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue({
        ...mirrorRow,
        type: TransactionType.LOAN_GIVEN,
      });

      await expect(
        service.create(
          {
            type: TransactionType.REPAYMENT_RECEIVED,
            category: AssetCategory.FUNDS,
            amount: 100,
            currency: 'NGN',
            parentId: 'mirror-1',
            date: new Date('2026-01-01'),
          },
          CREATOR_ID,
          null,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('update() propagation onto an existing mirror', () => {
    it('propagates amount/date/description/type edits from the org row onto its personal mirror', async () => {
      const orgRow = {
        id: 'org-tx-2',
        createdById: CREATOR_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        status: 'PENDING',
        amount: 1000,
        currency: 'NGN',
        orgId: ORG_ID,
        orgSourceTransactionId: null,
        parentId: null,
        projectTransactionId: null,
        isMirroredFromProject: false,
        contact: { linkedUserId: null },
        witnesses: [],
        history: [],
        conversions: [],
        personalMirror: { id: 'mirror-2', parentId: null },
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) => {
          if (where.id === 'org-tx-2') return Promise.resolve(orgRow);
          return Promise.resolve(null);
        },
      );
      mockPrismaService.transaction.update.mockResolvedValue({
        ...orgRow,
        amount: 1500,
      });
      mockPrismaService.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      await service.update(
        'org-tx-2',
        { id: 'org-tx-2', amount: 1500 },
        CREATOR_ID,
        ORG_ID,
      );

      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mirror-2' },
        data: expect.objectContaining({ amount: 1500 }),
      });
    });

    it('propagates currency/category/itemName/quantity edits from the org row onto its personal mirror', async () => {
      const orgRow = {
        id: 'org-tx-5',
        createdById: CREATOR_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        status: 'PENDING',
        amount: 1000,
        currency: 'NGN',
        orgId: ORG_ID,
        orgSourceTransactionId: null,
        parentId: null,
        projectTransactionId: null,
        isMirroredFromProject: false,
        contact: { linkedUserId: null },
        witnesses: [],
        history: [],
        conversions: [],
        personalMirror: { id: 'mirror-5', parentId: null },
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) => {
          if (where.id === 'org-tx-5') return Promise.resolve(orgRow);
          return Promise.resolve(null);
        },
      );
      mockPrismaService.transaction.update.mockResolvedValue({
        ...orgRow,
        currency: 'USD',
      });
      mockPrismaService.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      await service.update(
        'org-tx-5',
        { id: 'org-tx-5', currency: 'USD' },
        CREATOR_ID,
        ORG_ID,
      );

      // computeNetBalance groups by currency — a currency edit that isn't
      // propagated leaves the two ledgers describing the same obligation in
      // two different currency buckets.
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mirror-5' },
        data: expect.objectContaining({ currency: 'USD' }),
      });
    });

    it('rejects reassigning the contact on a transaction that has a personal-ledger mirror', async () => {
      const orgRow = {
        id: 'org-tx-6',
        createdById: CREATOR_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        status: 'PENDING',
        amount: 1000,
        currency: 'NGN',
        orgId: ORG_ID,
        orgSourceTransactionId: null,
        parentId: null,
        projectTransactionId: null,
        isMirroredFromProject: false,
        contact: { linkedUserId: null },
        witnesses: [],
        history: [],
        conversions: [],
        personalMirror: { id: 'mirror-6', parentId: null },
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) => {
          if (where.id === 'org-tx-6') return Promise.resolve(orgRow);
          return Promise.resolve(null);
        },
      );
      mockPrismaService.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      await expect(
        service.update(
          'org-tx-6',
          { id: 'org-tx-6', contactId: 'some-other-contact' },
          CREATOR_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe('remove() teardown of an existing mirror', () => {
    it('deletes the personal mirror alongside the org row when hard-deleting (no witnesses)', async () => {
      const orgRow = {
        id: 'org-tx-3',
        createdById: CREATOR_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_GIVEN,
        status: 'PENDING',
        amount: 1000,
        currency: 'NGN',
        orgId: ORG_ID,
        orgSourceTransactionId: null,
        parentId: null,
        projectTransactionId: null,
        isMirroredFromProject: false,
        contact: { linkedUserId: null },
        witnesses: [],
        history: [],
        conversions: [],
        personalMirror: { id: 'mirror-3', parentId: null },
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) => {
          if (where.id === 'org-tx-3') return Promise.resolve(orgRow);
          if (where.id === 'mirror-3')
            return Promise.resolve({ id: 'mirror-3', parentId: null });
          return Promise.resolve(null);
        },
      );
      mockPrismaService.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      await service.remove('org-tx-3', CREATOR_ID, ORG_ID);

      expect(mockPrismaService.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'mirror-3' },
      });
      expect(mockPrismaService.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'org-tx-3' },
      });
    });

    it('cascades CANCELLED onto the personal mirror when soft-cancelling a witnessed org row', async () => {
      const orgRow = {
        id: 'org-tx-4',
        createdById: CREATOR_ID,
        contactId: ORG_CONTACT_ID,
        type: TransactionType.LOAN_GIVEN,
        status: 'PENDING',
        amount: 1000,
        currency: 'NGN',
        orgId: ORG_ID,
        orgSourceTransactionId: null,
        parentId: null,
        projectTransactionId: null,
        isMirroredFromProject: false,
        contact: { linkedUserId: null },
        witnesses: [{ id: 'w1', status: 'PENDING', user: {} }],
        history: [],
        conversions: [],
        personalMirror: { id: 'mirror-4', parentId: null },
      };
      mockPrismaService.transaction.findUnique.mockImplementation(
        ({ where }: { where: { id?: string } }) => {
          if (where.id === 'org-tx-4') return Promise.resolve(orgRow);
          return Promise.resolve(null);
        },
      );
      mockPrismaService.transaction.update.mockResolvedValue({
        ...orgRow,
        status: 'CANCELLED',
      });
      mockPrismaService.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      await service.remove('org-tx-4', CREATOR_ID, ORG_ID);

      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'mirror-4' },
        data: { status: 'CANCELLED' },
      });
    });
  });
});
