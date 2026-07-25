import { Test } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { ContactBalanceStanding } from './dto/filter-contact.input';

describe('ContactsService — findAll pagination', () => {
  let service: ContactsService;
  let prisma: {
    contact: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    organisationMember: {
      findUnique: jest.Mock;
    };
    transaction: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      contact: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      organisationMember: {
        findUnique: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get(ContactsService);
  });

  it('returns paginated contacts with total', async () => {
    prisma.contact.findMany.mockResolvedValue([
      { id: '1', firstName: 'Ali', lastName: 'B', transactions: [] },
    ]);
    prisma.contact.count.mockResolvedValue(1);

    const result = await service.findAll('user-1', null, {
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.items).toHaveLength(1);
  });

  it('uses default page and limit when not provided', async () => {
    prisma.contact.findMany.mockResolvedValue([]);
    prisma.contact.count.mockResolvedValue(0);

    const result = await service.findAll('user-1', null, {});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(25);
  });

  it('filters by OWED_TO_ME — returns only positive-balance contacts', async () => {
    const contacts = [
      {
        id: '1',
        firstName: 'Ali',
        transactions: [
          {
            type: 'LOAN_GIVEN',
            amount: { toNumber: () => 100 },
            status: 'COMPLETED',
          },
        ],
      },
      {
        id: '2',
        firstName: 'Ben',
        transactions: [
          {
            type: 'LOAN_RECEIVED',
            amount: { toNumber: () => 50 },
            status: 'COMPLETED',
          },
        ],
      },
    ];
    prisma.contact.findMany.mockResolvedValue(contacts);

    const result = await service.findAll('user-1', null, {
      balanceStanding: ContactBalanceStanding.OWED_TO_ME,
    });

    expect(result.items.map((c: { id: string }) => c.id)).toEqual(['1']);
  });

  it('filters by I_OWE — returns only negative-balance contacts', async () => {
    const contacts = [
      {
        id: '1',
        firstName: 'Ali',
        transactions: [
          {
            type: 'LOAN_GIVEN',
            amount: { toNumber: () => 100 },
            status: 'COMPLETED',
          },
        ],
      },
      {
        id: '2',
        firstName: 'Ben',
        transactions: [
          {
            type: 'LOAN_RECEIVED',
            amount: { toNumber: () => 50 },
            status: 'COMPLETED',
          },
        ],
      },
    ];
    prisma.contact.findMany.mockResolvedValue(contacts);

    const result = await service.findAll('user-1', null, {
      balanceStanding: ContactBalanceStanding.I_OWE,
    });

    expect(result.items.map((c: { id: string }) => c.id)).toEqual(['2']);
  });

  it('excludes CANCELLED transactions from balance computation', async () => {
    const contacts = [
      {
        id: '1',
        firstName: 'Ali',
        transactions: [
          {
            type: 'LOAN_GIVEN',
            amount: { toNumber: () => 100 },
            status: 'CANCELLED',
          },
        ],
      },
    ];
    prisma.contact.findMany.mockResolvedValue(contacts);

    // Balance is 0 (GIVEN is cancelled), so OWED_TO_ME should exclude it
    const result = await service.findAll('user-1', null, {
      balanceStanding: ContactBalanceStanding.OWED_TO_ME,
    });

    expect(result.items).toHaveLength(0);
  });

  it('applies pagination to balance-filtered results', async () => {
    const contacts = Array.from({ length: 5 }, (_, i) => ({
      id: `${i + 1}`,
      firstName: `Contact${i + 1}`,
      transactions: [
        {
          type: 'LOAN_GIVEN',
          amount: { toNumber: () => 100 },
          status: 'COMPLETED',
        },
      ],
    }));
    prisma.contact.findMany.mockResolvedValue(contacts);

    const result = await service.findAll('user-1', null, {
      balanceStanding: ContactBalanceStanding.OWED_TO_ME,
      page: 1,
      limit: 3,
    });

    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(3);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
  });

  describe('ContactsService — org scoping', () => {
    it('scopes findAll to orgId when org context active', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.contact.count.mockResolvedValue(0);

      await service.findAll('user1', 'org1', {});

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ orgId: 'org1' }),
        }),
      );
    });

    it('scopes findAll to personal when orgId is null', async () => {
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.contact.count.mockResolvedValue(0);

      await service.findAll('user1', null, {});

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user1', orgId: null }),
        }),
      );
    });
  });

  describe('ContactsService — org-aware access (assertContactAccess via findOne)', () => {
    const orgContact = {
      id: 'oc1',
      orgId: 'org1',
      userId: 'sharer-1',
      linkedUserId: null,
      transactions: [],
      user: {},
    };
    const personalContact = {
      id: 'pc1',
      orgId: null,
      userId: 'owner-1',
      linkedUserId: null,
      transactions: [],
      user: {},
    };

    it('grants any active member of the same org access to an org contact, regardless of who created it', async () => {
      prisma.contact.findUnique.mockResolvedValue(orgContact);
      prisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem1',
        role: 'OPERATOR',
      });

      const result = await service.findOne('oc1', 'other-member', 'org1');
      expect(result.id).toBe('oc1');
      expect(prisma.organisationMember.findUnique).toHaveBeenCalledWith({
        where: { orgId_userId: { orgId: 'org1', userId: 'other-member' } },
      });
    });

    it('rejects a non-member of the org from accessing an org contact', async () => {
      prisma.contact.findUnique.mockResolvedValue(orgContact);
      prisma.organisationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('oc1', 'not-a-member', 'org1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a personal-mode caller (no active org) from accessing an org contact', async () => {
      prisma.contact.findUnique.mockResolvedValue(orgContact);

      await expect(
        service.findOne('oc1', 'other-member', null),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('rejects access to a personal contact from a different org context entirely', async () => {
      prisma.contact.findUnique.mockResolvedValue(orgContact);

      await expect(
        service.findOne('oc1', 'other-member', 'different-org'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('still authorises a personal contact by owner-or-linked-user, unaffected by org scoping', async () => {
      prisma.contact.findUnique.mockResolvedValue(personalContact);

      const result = await service.findOne('pc1', 'owner-1', null);
      expect(result.id).toBe('pc1');
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a caller who neither owns nor is linked to a personal contact', async () => {
      prisma.contact.findUnique.mockResolvedValue(personalContact);

      await expect(
        service.findOne('pc1', 'someone-else', null),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ContactsService — findShareable', () => {
    it('throws when there is no active org', async () => {
      await expect(service.findShareable('user1', null, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it("lists the caller's own personal contacts not yet shared into the active org", async () => {
      prisma.contact.findMany.mockResolvedValue([
        { id: 'pc1', firstName: 'Ali' },
      ]);
      prisma.contact.count.mockResolvedValue(1);

      const result = await service.findShareable('user1', 'org1', {});

      expect(result.items).toHaveLength(1);
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user1',
            orgId: null,
            derivedContacts: { none: { orgId: 'org1' } },
          }),
        }),
      );
    });
  });

  describe('ContactsService — getBalance (multi-member org standing)', () => {
    // Regression test: caught by the end-to-end scenario eval
    // (transactions/__tests__/personal-mirror-scenario.spec.ts). getBalance
    // used to flip the sign for any transaction not created by the *viewing*
    // user, which was correct for the single-owner personal-contact case but
    // wrong for a shared org contact — a second member viewing a loan that a
    // *different* member recorded got an inverted balance.
    it('does not flip the sign for a direct transaction created by a different org member than the viewer', async () => {
      prisma.contact.findUnique.mockResolvedValue({ linkedUserId: null });
      prisma.transaction.findMany.mockResolvedValue([
        {
          type: 'LOAN_RECEIVED',
          amount: { toNumber: () => 100 },
          parentId: null,
          createdById: 'fawaz',
          conversions: [],
        },
      ]);

      // Bello (not the creator) views the same org contact's standing.
      const balance = await service.getBalance('org-contact-1', 'bello');
      expect(balance).toBe(-100); // same as the creator would see, not +100
    });

    it('still flips the sign for the true shared-ledger reverse-perspective case (linked platform user)', async () => {
      prisma.contact.findUnique.mockResolvedValue({ linkedUserId: 'ahmad' });
      prisma.transaction.findMany
        .mockResolvedValueOnce([]) // direct rows on my own contact-of-Ahmad
        .mockResolvedValueOnce([
          // Ahmad's own contact-record-of-me shows he recorded a LOAN_GIVEN
          {
            type: 'LOAN_GIVEN',
            amount: { toNumber: () => 100 },
            parentId: null,
            createdById: 'ahmad',
            conversions: [],
          },
        ]);

      const balance = await service.getBalance('my-contact-of-ahmad', 'me');
      // From my perspective, Ahmad recording LOAN_GIVEN means I received a
      // loan — flips to the LOAN_RECEIVED sign (-1).
      expect(balance).toBe(-100);
    });

    it("does NOT pull in the linked platform user's unrelated private personal-ledger activity for an org contact", async () => {
      // promoteContactToOrg copies linkedUserId onto the org copy (for
      // perspective flipping on transactions *within that org*) — it must
      // not also open the door to Aisha's private personal transactions
      // with some other org member leaking into the org balance.
      prisma.contact.findUnique.mockResolvedValue({
        linkedUserId: 'aisha-user-id',
        orgId: 'org-1',
      });
      prisma.transaction.findMany.mockResolvedValueOnce([
        {
          type: 'LOAN_RECEIVED',
          amount: { toNumber: () => 100 },
          parentId: null,
          createdById: 'fawaz',
          conversions: [],
        },
      ]);

      const balance = await service.getBalance('org-aisha-contact', 'bello');

      expect(balance).toBe(-100);
      // Only the direct-transactions query ran — no reverse-perspective
      // query for an org contact, regardless of linkedUserId.
      expect(prisma.transaction.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
