import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationService } from '../notifications/notification.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { TransactionType, AssetCategory } from '../../generated/prisma/client';

const CREATOR_ID = 'creator-1';
const CONTACT_ID = 'contact-1';

const mockContact = {
  id: CONTACT_ID,
  userId: CREATOR_ID,
  firstName: 'Aminu',
  lastName: 'Musa',
  phoneNumber: '+2348099999999',
  email: 'aminu@example.com',
  linkedUserId: null,
  orgId: null,
  createdAt: new Date(),
};

const mockCreator = {
  id: CREATOR_ID,
  firstName: 'Fatima',
  lastName: 'Bello',
  email: 'fatima@example.com',
};

const mockTransaction = {
  id: 'tx-1',
  createdById: CREATOR_ID,
  contactId: CONTACT_ID,
  type: TransactionType.LOAN_GIVEN,
  category: AssetCategory.FUNDS,
  amount: {
    toNumber: () => 5000,
  } as unknown as import('../../generated/prisma/client').Transaction['amount'],
  currency: 'NGN',
  status: 'PENDING' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
  itemName: null,
  quantity: null,
  parentId: null,
  dueDate: null,
};

const mockPrismaService = {
  transaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  contact: {
    findUnique: jest.fn(),
  },
  user: {
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

const mockConfigService = { getOrThrow: jest.fn(), get: jest.fn() };
const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const mockExchangeRateService = {
  convert: jest.fn((v: number) => Promise.resolve(v)),
};
const mockInAppNotificationsService = {
  create: jest.fn().mockResolvedValue({}),
};

describe('TransactionsService - create()', () => {
  let service: TransactionsService;

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
    jest.clearAllMocks();

    mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
    mockPrismaService.user.findUnique.mockResolvedValue(mockCreator);
    mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);
  });

  const TX_DATE = new Date('2026-03-22');

  it('does NOT send contact notification at creation time for a LOAN_GIVEN transaction', async () => {
    await service.create(
      {
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 5000,
        currency: 'NGN',
        contactId: CONTACT_ID,
        date: TX_DATE,
      },
      CREATOR_ID,
      null,
    );

    expect(
      mockNotificationService.sendContactNotification,
    ).not.toHaveBeenCalled();
  });

  it('does NOT send contact notification at creation time for a LOAN_RECEIVED transaction', async () => {
    mockPrismaService.transaction.create.mockResolvedValue({
      ...mockTransaction,
      type: TransactionType.LOAN_RECEIVED,
    });

    await service.create(
      {
        type: TransactionType.LOAN_RECEIVED,
        category: AssetCategory.FUNDS,
        amount: 3000,
        currency: 'NGN',
        contactId: CONTACT_ID,
        date: TX_DATE,
      },
      CREATOR_ID,
      null,
    );

    expect(
      mockNotificationService.sendContactNotification,
    ).not.toHaveBeenCalled();
  });

  it('does NOT send contact notification at creation time for a REPAYMENT_MADE transaction', async () => {
    // REPAYMENT_MADE must be linked to a parent LOAN_RECEIVED via parentId.
    // Stub the parent lookup so the validation in create() passes. Use the
    // *Once variants so the queued values are consumed and don't bleed into
    // later tests in this suite.
    const parentLoan = {
      ...mockTransaction,
      id: 'parent-loan-1',
      type: TransactionType.LOAN_RECEIVED,
      contactId: CONTACT_ID,
      category: AssetCategory.FUNDS,
      amount: 5000, // Number — recompute reads via Number(parent.amount)
      currency: 'NGN',
      status: 'PENDING' as const,
    };
    mockPrismaService.transaction.findUnique
      .mockResolvedValueOnce(parentLoan) // create() validation lookup
      .mockResolvedValueOnce(parentLoan) // recomputeParentLoanStatus lookup
      .mockResolvedValueOnce(null); // processWitnesses lookup (early-returns on null)
    // findMany is called twice (validation children check + recompute);
    // an empty array is harmless for any other test that may call findMany.
    mockPrismaService.transaction.findMany = jest.fn().mockResolvedValue([]);
    mockPrismaService.transaction.update = jest
      .fn()
      .mockResolvedValue(parentLoan);
    mockPrismaService.transaction.create.mockResolvedValueOnce({
      ...mockTransaction,
      type: TransactionType.REPAYMENT_MADE,
      parentId: parentLoan.id,
    });

    await service.create(
      {
        type: TransactionType.REPAYMENT_MADE,
        category: AssetCategory.FUNDS,
        amount: 2000,
        currency: 'NGN',
        contactId: CONTACT_ID,
        parentId: parentLoan.id,
        date: TX_DATE,
      },
      CREATOR_ID,
      null,
    );

    expect(
      mockNotificationService.sendContactNotification,
    ).not.toHaveBeenCalled();
  });

  it('does NOT send contact notification for a GIFT_GIVEN transaction', async () => {
    mockPrismaService.transaction.create.mockResolvedValue({
      ...mockTransaction,
      type: TransactionType.GIFT_GIVEN,
      amount: null,
      contactId: null,
    });

    await service.create(
      {
        type: TransactionType.GIFT_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 1000,
        currency: 'NGN',
        date: TX_DATE,
      },
      CREATOR_ID,
      null,
    );

    expect(
      mockNotificationService.sendContactNotification,
    ).not.toHaveBeenCalled();
  });

  it('does NOT send contact notification when no contactId is set', async () => {
    mockPrismaService.transaction.create.mockResolvedValue({
      ...mockTransaction,
      contactId: null,
    });

    await service.create(
      {
        type: TransactionType.LOAN_GIVEN,
        category: AssetCategory.FUNDS,
        amount: 5000,
        currency: 'NGN',
        date: TX_DATE,
      },
      CREATOR_ID,
      null,
    );

    expect(
      mockNotificationService.sendContactNotification,
    ).not.toHaveBeenCalled();
  });
});
