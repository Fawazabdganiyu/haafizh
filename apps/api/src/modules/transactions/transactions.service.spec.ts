import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationService } from '../notifications/notification.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import {
  TransactionType,
  AssetCategory,
  TransactionStatus,
  WitnessStatus,
  NotificationType,
} from '../../generated/prisma/client';

const mockPrismaService = {
  transaction: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  transactionHistory: {
    create: jest.fn(),
  },
  witness: {
    updateMany: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  contact: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
  },
  projectTransaction: {
    groupBy: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((arg) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg(mockPrismaService);
  }),
};

const mockConfigService = {
  getOrThrow: jest.fn(),
};

const mockCacheManager = {
  set: jest.fn(),
  get: jest.fn(),
};

const mockNotificationService = {
  sendTransactionWitnessInvite: jest.fn(),
  sendWitnessUpdateNotification: jest.fn(),
};

const mockExchangeRateService = {
  convert: jest.fn((amount) => Promise.resolve(amount)),
};

const mockInAppNotificationsService = {
  create: jest.fn().mockResolvedValue({}),
  createSafely: jest.fn().mockResolvedValue(undefined),
};

describe('TransactionsService - Pagination', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    contact: { findMany: jest.Mock; findUnique: jest.Mock };
    project: { findMany: jest.Mock };
    projectTransaction: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
        {
          provide: InAppNotificationsService,
          useValue: mockInAppNotificationsService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(
      PrismaService,
    ) as unknown as typeof prisma;

    jest.clearAllMocks();
    prisma.project.findMany.mockResolvedValue([]);
    prisma.projectTransaction.groupBy.mockResolvedValue([]);
    prisma.projectTransaction.findMany.mockResolvedValue([]);
  });

  const userId = 'user-pagination-1';

  const makeTransaction = (id: string) => ({
    id,
    amount: { toNumber: () => 100 },
    type: TransactionType.LOAN_GIVEN,
    category: AssetCategory.FUNDS,
    status: TransactionStatus.COMPLETED,
    currency: 'NGN',
    date: new Date('2024-01-15'),
    description: 'test',
    createdAt: new Date(),
    createdById: userId,
    contactId: 'contact-1',
    contact: {
      id: 'contact-1',
      firstName: 'John',
      lastName: 'Doe',
      linkedUserId: null,
    },
    createdBy: {
      id: userId,
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@test.com',
    },
    witnesses: [],
    itemName: null,
    quantity: null,
    parentId: null,
    parent: null,
    conversions: [],
  });

  describe('findAll with pagination', () => {
    it('should return { items, summary, total, page, limit }', async () => {
      const totalCount = 50;
      const mockItems = [makeTransaction('tx-1'), makeTransaction('tx-2')];

      prisma.user.findUnique.mockResolvedValue({ preferredCurrency: 'NGN' });
      prisma.transaction.count.mockResolvedValue(totalCount);
      prisma.transaction.findMany.mockResolvedValue(mockItems);
      prisma.transaction.groupBy.mockResolvedValue([]);

      // $transaction mock returns [count, findMany] for array calls
      prisma.$transaction.mockImplementation((arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.resolve([totalCount, mockItems]);
        }
        return (arg as (p: unknown) => Promise<unknown>)(prisma);
      });

      const result = await service.findAll(userId, null, {
        page: 1,
        limit: 25,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.total).toBe(totalCount);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
    });

    it('should correctly compute skip for page 2', async () => {
      const totalCount = 50;
      const mockItems = [makeTransaction('tx-26')];

      prisma.user.findUnique.mockResolvedValue({ preferredCurrency: 'NGN' });
      prisma.transaction.count.mockResolvedValue(totalCount);
      prisma.transaction.findMany.mockResolvedValue(mockItems);
      prisma.transaction.groupBy.mockResolvedValue([]);

      let capturedFindManyArgs: Record<string, unknown> | undefined;
      prisma.$transaction.mockImplementation((arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.resolve([totalCount, mockItems]);
        }
        return (arg as (p: unknown) => Promise<unknown>)(prisma);
      });

      // Capture findMany args by spying
      prisma.transaction.findMany.mockImplementation(
        (args: Record<string, unknown>) => {
          capturedFindManyArgs = args;
          return Promise.resolve(mockItems);
        },
      );

      await service.findAll(userId, null, { page: 2, limit: 10 });

      // skip should be (2-1)*10 = 10
      expect(capturedFindManyArgs?.skip).toBe(10);
      expect(capturedFindManyArgs?.take).toBe(10);
    });
  });

  describe('TransactionsService — org scoping', () => {
    let scopeService: TransactionsService;
    let scopePrisma: {
      transaction: {
        findMany: jest.Mock;
        count: jest.Mock;
        create: jest.Mock;
        groupBy: jest.Mock;
      };
    };

    beforeEach(async () => {
      scopePrisma = {
        transaction: {
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          groupBy: jest.fn().mockResolvedValue([]),
        },
      };
      const module = await Test.createTestingModule({
        providers: [
          TransactionsService,
          { provide: PrismaService, useValue: scopePrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: ExchangeRateService, useValue: mockExchangeRateService },
          {
            provide: InAppNotificationsService,
            useValue: mockInAppNotificationsService,
          },
        ],
      }).compile();
      scopeService = module.get(TransactionsService);
    });

    it('scopes findAll to orgId when org context is active', async () => {
      scopePrisma.transaction.findMany.mockResolvedValue([]);
      scopePrisma.transaction.count.mockResolvedValue(0);

      // Provide a $transaction mock on scopePrisma
      (scopePrisma as unknown as Record<string, unknown>).$transaction =
        jest.fn((arg: unknown) => {
          if (Array.isArray(arg)) return Promise.resolve([0, []]);
          return (arg as (p: unknown) => Promise<unknown>)(scopePrisma);
        });
      // Provide user + project mocks used inside findAll
      (scopePrisma as unknown as Record<string, unknown>).user = {
        findUnique: jest.fn().mockResolvedValue({ preferredCurrency: 'NGN' }),
      };
      (scopePrisma as unknown as Record<string, unknown>).project = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (scopePrisma as unknown as Record<string, unknown>).projectTransaction = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      await scopeService.findAll('user1', 'org1', {});

      expect(scopePrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org1' }),
        }),
      );
    });

    it('scopes findAll to personal records when orgId is null', async () => {
      scopePrisma.transaction.findMany.mockResolvedValue([]);
      scopePrisma.transaction.count.mockResolvedValue(0);

      (scopePrisma as unknown as Record<string, unknown>).$transaction =
        jest.fn((arg: unknown) => {
          if (Array.isArray(arg)) return Promise.resolve([0, []]);
          return (arg as (p: unknown) => Promise<unknown>)(scopePrisma);
        });
      (scopePrisma as unknown as Record<string, unknown>).user = {
        findUnique: jest.fn().mockResolvedValue({ preferredCurrency: 'NGN' }),
      };
      (scopePrisma as unknown as Record<string, unknown>).project = {
        findMany: jest.fn().mockResolvedValue([]),
      };
      (scopePrisma as unknown as Record<string, unknown>).projectTransaction = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      await scopeService.findAll('user1', null, {});

      expect(scopePrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ createdById: 'user1', orgId: null }),
        }),
      );
    });
  });

  describe('TransactionsService — org-aware contact/parent validation on create', () => {
    let validationService: TransactionsService;
    let validationPrisma: {
      transaction: {
        findUnique: jest.Mock;
        findMany: jest.Mock;
        create: jest.Mock;
      };
      contact: { findUnique: jest.Mock };
      transactionHistory: { create: jest.Mock };
      $transaction: jest.Mock;
    };

    beforeEach(async () => {
      validationPrisma = {
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
        },
        contact: { findUnique: jest.fn() },
        transactionHistory: { create: jest.fn() },
        $transaction: jest.fn((fn) => fn(validationPrisma)),
      };
      const module = await Test.createTestingModule({
        providers: [
          TransactionsService,
          { provide: PrismaService, useValue: validationPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: ExchangeRateService, useValue: mockExchangeRateService },
          {
            provide: InAppNotificationsService,
            useValue: mockInAppNotificationsService,
          },
        ],
      }).compile();
      validationService = module.get(TransactionsService);
      validationPrisma.transaction.create.mockResolvedValue({
        id: 'tx-new',
        type: TransactionType.LOAN_GIVEN,
        amount: 1000,
      });
    });

    const baseInput = {
      type: TransactionType.LOAN_GIVEN,
      category: AssetCategory.FUNDS,
      amount: 1000,
      currency: 'NGN',
      contactId: 'contact-1',
      date: new Date('2026-01-01'),
    };

    it('allows attaching an org contact when the caller is recording in that same org', async () => {
      validationPrisma.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'other-member',
        orgId: 'org1',
      });

      await expect(
        validationService.create(baseInput, 'creator-1', 'org1'),
      ).resolves.toBeDefined();
    });

    it('rejects attaching an org contact from a different org than the one being recorded in', async () => {
      validationPrisma.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'other-member',
        orgId: 'org2',
      });

      await expect(
        validationService.create(baseInput, 'creator-1', 'org1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects attaching an org contact to a personal-mode transaction', async () => {
      validationPrisma.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'creator-1',
        orgId: 'org1',
      });

      await expect(
        validationService.create(baseInput, 'creator-1', null),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects attaching another user's personal contact to a personal-mode transaction", async () => {
      validationPrisma.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'someone-else',
        orgId: null,
      });

      await expect(
        validationService.create(baseInput, 'creator-1', null),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows attaching an org-scoped parent transaction created by a different member of the same org', async () => {
      validationPrisma.transaction.findUnique.mockResolvedValueOnce({
        id: 'parent-1',
        orgId: 'org1',
        createdById: 'other-member',
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 1000,
        currency: 'NGN',
        contactId: 'contact-1',
      });

      await expect(
        validationService.create(
          {
            type: TransactionType.GIFT_GIVEN,
            category: AssetCategory.FUNDS,
            amount: 500,
            currency: 'NGN',
            parentId: 'parent-1',
            date: new Date('2026-01-01'),
          },
          'creator-1',
          'org1',
        ),
      ).resolves.toBeDefined();
    });

    it("rejects linking to a parent transaction outside the caller's active org", async () => {
      validationPrisma.transaction.findUnique.mockResolvedValueOnce({
        id: 'parent-1',
        orgId: 'org2',
        createdById: 'other-member',
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 1000,
        currency: 'NGN',
        contactId: 'contact-1',
      });

      await expect(
        validationService.create(
          {
            type: TransactionType.GIFT_GIVEN,
            category: AssetCategory.FUNDS,
            amount: 500,
            currency: 'NGN',
            parentId: 'parent-1',
            date: new Date('2026-01-01'),
          },
          'creator-1',
          'org1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects linking to a personal parent transaction the caller didn't create", async () => {
      validationPrisma.transaction.findUnique.mockResolvedValueOnce({
        id: 'parent-1',
        orgId: null,
        createdById: 'someone-else',
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 1000,
        currency: 'NGN',
        contactId: 'contact-1',
      });

      await expect(
        validationService.create(
          {
            type: TransactionType.GIFT_GIVEN,
            category: AssetCategory.FUNDS,
            amount: 500,
            currency: 'NGN',
            parentId: 'parent-1',
            date: new Date('2026-01-01'),
          },
          'creator-1',
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('TransactionsService — org-membership access on findOne/update/remove', () => {
    let accessService: TransactionsService;
    let accessPrisma: {
      transaction: {
        findUnique: jest.Mock;
        findMany: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
      };
      organisationMember: { findUnique: jest.Mock };
      contact: { findUnique: jest.Mock };
      transactionHistory: { create: jest.Mock };
      witness: { updateMany: jest.Mock };
      user: { findUnique: jest.Mock };
      $transaction: jest.Mock;
    };

    const orgRow = {
      id: 'org-tx-1',
      createdById: 'fawaz',
      orgId: 'org1',
      contactId: 'contact-1',
      contact: { linkedUserId: null },
      type: TransactionType.LOAN_GIVEN,
      category: AssetCategory.FUNDS,
      status: TransactionStatus.PENDING,
      amount: 1000,
      currency: 'NGN',
      parentId: null,
      projectTransactionId: null,
      isMirroredFromProject: false,
      orgSourceTransactionId: null,
      personalMirror: null,
      witnesses: [],
      history: [],
      conversions: [],
    };

    const personalRow = {
      ...orgRow,
      id: 'personal-tx-1',
      orgId: null,
    };

    beforeEach(async () => {
      accessPrisma = {
        transaction: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          delete: jest.fn(),
        },
        organisationMember: { findUnique: jest.fn() },
        contact: { findUnique: jest.fn() },
        transactionHistory: { create: jest.fn() },
        witness: { updateMany: jest.fn() },
        user: { findUnique: jest.fn() },
        $transaction: jest.fn((fn) => fn(accessPrisma)),
      };
      const module = await Test.createTestingModule({
        providers: [
          TransactionsService,
          { provide: PrismaService, useValue: accessPrisma },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: CACHE_MANAGER, useValue: mockCacheManager },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: ExchangeRateService, useValue: mockExchangeRateService },
          {
            provide: InAppNotificationsService,
            useValue: mockInAppNotificationsService,
          },
        ],
      }).compile();
      accessService = module.get(TransactionsService);
    });

    it('grants a non-creator active member of the same org read access to an org transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(orgRow);
      accessPrisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });

      const result = await accessService.findOne('org-tx-1', 'bello', 'org1');
      expect(result.id).toBe('org-tx-1');
    });

    it('rejects a non-member of the org from reading an org transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(orgRow);
      accessPrisma.organisationMember.findUnique.mockResolvedValue(null);

      await expect(
        accessService.findOne('org-tx-1', 'stranger', 'org1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a personal-mode caller (no active org) from reading an org transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(orgRow);

      await expect(
        accessService.findOne('org-tx-1', 'bello', null),
      ).rejects.toThrow(ForbiddenException);
      expect(accessPrisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('lets a non-creator active org member update an org transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(orgRow);
      accessPrisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });
      accessPrisma.transaction.update.mockResolvedValue({
        ...orgRow,
        description: 'updated',
      });

      await expect(
        accessService.update(
          'org-tx-1',
          { id: 'org-tx-1', description: 'updated' },
          'bello',
          'org1',
        ),
      ).resolves.toBeDefined();
    });

    it('lets a non-creator active org member remove an org transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(orgRow);
      accessPrisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });
      accessPrisma.transaction.delete.mockResolvedValue(orgRow);

      await expect(
        accessService.remove('org-tx-1', 'bello', 'org1'),
      ).resolves.toBeDefined();
    });

    it('still rejects a non-creator, non-linked user from updating a personal transaction', async () => {
      accessPrisma.transaction.findUnique.mockResolvedValue(personalRow);

      await expect(
        accessService.update(
          'personal-tx-1',
          { id: 'personal-tx-1', description: 'updated' },
          'someone-else',
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('still rejects the linked contact (not the creator) from updating a personal transaction they can view', async () => {
      const linkedRow = {
        ...personalRow,
        contact: { linkedUserId: 'linked-user' },
      };
      accessPrisma.transaction.findUnique.mockResolvedValue(linkedRow);

      await expect(
        accessService.update(
          'personal-tx-1',
          { id: 'personal-tx-1', description: 'updated' },
          'linked-user',
          null,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findMyContactTransactions with pagination', () => {
    it('should return { items, total, page, limit }', async () => {
      const totalCount = 30;
      const mockItems = [makeTransaction('tx-c1')];

      prisma.transaction.count.mockResolvedValue(totalCount);
      prisma.transaction.findMany.mockResolvedValue(mockItems);

      const result = await service.findMyContactTransactions(userId, {
        page: 1,
        limit: 20,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.total).toBe(totalCount);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply skip for page 3 in findMyContactTransactions', async () => {
      const totalCount = 100;
      const mockItems = [makeTransaction('tx-c2')];

      let capturedFindManyArgs: Record<string, unknown> | undefined;
      prisma.transaction.findMany.mockImplementation(
        (args: Record<string, unknown>) => {
          capturedFindManyArgs = args;
          return Promise.resolve(mockItems);
        },
      );
      prisma.transaction.count.mockResolvedValue(totalCount);

      await service.findMyContactTransactions(userId, { page: 3, limit: 15 });

      // skip = (3-1)*15 = 30
      expect(capturedFindManyArgs?.skip).toBe(30);
      expect(capturedFindManyArgs?.take).toBe(15);
    });
  });
});

// ---------------------------------------------------------------------------
// In-app notification wiring — witness invite / modified / cancelled
// ---------------------------------------------------------------------------

describe('TransactionsService — in-app notification wiring', () => {
  let service: TransactionsService;

  const userId = 'creator-1';
  const witnessUserId = 'witness-1';

  const baseTransaction = {
    id: 'tx-1',
    createdById: userId,
    parentId: null,
    status: TransactionStatus.COMPLETED,
    type: TransactionType.LOAN_GIVEN,
    category: AssetCategory.FUNDS,
    amount: 50000,
    currency: 'NGN',
    itemName: null,
    quantity: null,
    description: 'Original description',
    date: new Date('2026-01-01'),
    contactId: null,
    contact: null,
    createdBy: { firstName: 'Musa', lastName: 'Ibrahim' },
    history: [],
    conversions: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
        {
          provide: InAppNotificationsService,
          useValue: mockInAppNotificationsService,
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue('7d');
    mockNotificationService.sendTransactionWitnessInvite.mockResolvedValue(
      undefined,
    );
    mockNotificationService.sendWitnessUpdateNotification.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('creates an in-app notification for the invited witness on create()', async () => {
    mockPrismaService.transaction.create.mockResolvedValue({ id: 'tx-1' });
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      ...baseTransaction,
    });
    mockPrismaService.witness.upsert.mockResolvedValue({
      id: 'witness-record-1',
      userId: witnessUserId,
      user: {
        id: witnessUserId,
        email: 'witness@example.com',
        firstName: 'Aminu',
        lastName: 'Bello',
        phoneNumber: null,
      },
    });

    await service.create(
      {
        category: AssetCategory.FUNDS,
        amount: 50000,
        type: TransactionType.LOAN_GIVEN,
        currency: 'NGN',
        date: new Date('2026-01-01'),
        witnessUserIds: [witnessUserId],
      } as never,
      userId,
      null,
    );

    expect(mockInAppNotificationsService.createSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: witnessUserId,
        type: NotificationType.WITNESS_INVITED,
        link: '/witnesses',
      }),
      expect.any(String),
    );
  });

  it('creates an in-app notification for each acknowledged witness on update()', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      ...baseTransaction,
      witnesses: [
        {
          userId: witnessUserId,
          status: WitnessStatus.ACKNOWLEDGED,
          user: { email: 'witness@example.com', firstName: 'Aminu' },
        },
      ],
    });
    mockPrismaService.user.findUnique.mockResolvedValue({
      firstName: 'Musa',
      lastName: 'Ibrahim',
    });
    mockPrismaService.transaction.update.mockResolvedValue({
      ...baseTransaction,
    });
    mockPrismaService.transactionHistory.create.mockResolvedValue({});
    mockPrismaService.witness.updateMany.mockResolvedValue({ count: 1 });

    await service.update(
      'tx-1',
      { description: 'Updated description' } as never,
      userId,
    );

    expect(mockInAppNotificationsService.createSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: witnessUserId,
        type: NotificationType.WITNESS_TRANSACTION_MODIFIED,
        link: '/transactions/tx-1',
      }),
      expect.any(String),
    );
  });

  it('creates an in-app notification for each acknowledged witness on remove() (cancel)', async () => {
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      ...baseTransaction,
      witnesses: [
        {
          userId: witnessUserId,
          status: WitnessStatus.ACKNOWLEDGED,
          user: { email: 'witness@example.com', firstName: 'Aminu' },
        },
      ],
    });
    mockPrismaService.user.findUnique.mockResolvedValue({
      firstName: 'Musa',
      lastName: 'Ibrahim',
    });
    mockPrismaService.transaction.update.mockResolvedValue({
      ...baseTransaction,
      status: TransactionStatus.CANCELLED,
    });
    mockPrismaService.transactionHistory.create.mockResolvedValue({});

    await service.remove('tx-1', userId);

    expect(mockInAppNotificationsService.createSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: witnessUserId,
        type: NotificationType.WITNESS_TRANSACTION_CANCELLED,
        link: '/transactions/tx-1',
      }),
      expect.any(String),
    );
  });
});
