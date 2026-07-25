import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ContactsService } from '../../contacts/contacts.service';
import { OrganisationsService } from '../../organisations/organisations.service';
import { TransactionsService } from '../transactions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notifications/notification.service';
import { ExchangeRateService } from '../../exchange-rate/exchange-rate.service';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import {
  TransactionType,
  AssetCategory,
} from '../../../generated/prisma/client';
import { FakePrisma } from './fake-prisma';

/**
 * End-to-end ledger scenario eval for shared personal↔org contacts (see
 * .claude/plans/as-a-member-and-melodic-aho.md). No LLM component here, so
 * "eval" means a scripted, deterministic scenario exercising ContactsService,
 * OrganisationsService, and TransactionsService together against one shared
 * FakePrisma — proving the pieces agree with each other once wired up, which
 * the per-service unit specs (contacts.service.spec.ts,
 * transactions.personal-mirror.spec.ts) can't by construction, since each
 * mocks the others' effects away.
 *
 * Story: Fawaz has a personal contact (Aisha). He shares her into "Acme Org".
 * As Acme, he records a LOAN_RECEIVED of 100,000 from Aisha with the
 * personal-ledger reflection toggle on, then partially repays 40,000. A
 * second org member (Bello) should see Aisha as a normal org contact with
 * the same standing, and see none of Fawaz's personal-side data.
 */
describe('Personal-mirror ledger scenario (end-to-end)', () => {
  let prisma: FakePrisma;
  let contactsService: ContactsService;
  let organisationsService: OrganisationsService;
  let transactionsService: TransactionsService;

  const ORG_ID = 'acme-org';
  const FAWAZ_ID = 'user-fawaz';
  const BELLO_ID = 'user-bello';

  beforeEach(async () => {
    prisma = new FakePrisma();
    prisma.seedUser({
      id: FAWAZ_ID,
      firstName: 'Fawaz',
      lastName: 'Abdganiyu',
      email: 'fawaz@example.com',
      preferredCurrency: 'NGN',
    });
    prisma.seedUser({
      id: BELLO_ID,
      firstName: 'Bello',
      lastName: 'Musa',
      email: 'bello@example.com',
      preferredCurrency: 'NGN',
    });
    prisma.seedOrgMembership(ORG_ID, FAWAZ_ID, 'ADMIN');
    prisma.seedOrgMembership(ORG_ID, BELLO_ID, 'OPERATOR');

    const mockConfigService = { getOrThrow: jest.fn(), get: jest.fn() };
    const mockCacheManager = { get: jest.fn(), set: jest.fn() };
    const mockNotificationService = {
      sendTransactionWitnessInvite: jest.fn(),
      sendWitnessUpdateNotification: jest.fn(),
      sendContactInvitationEmail: jest.fn(),
    };
    const mockExchangeRateService = {
      convert: jest.fn((amount: number) => Promise.resolve(amount)),
    };
    const mockInAppNotificationsService = {
      createSafely: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ContactsService,
        OrganisationsService,
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
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

    contactsService = module.get(ContactsService);
    organisationsService = module.get(OrganisationsService);
    transactionsService = module.get(TransactionsService);
  });

  it('reflects an org loan + partial repayment onto the personal ledger, with matching standings on both sides and correct member-B visibility', async () => {
    // 1. Fawaz creates Aisha as a personal contact.
    const aishaPersonal = await contactsService.create(
      { name: 'Aisha Bello', email: 'aisha@example.com' },
      FAWAZ_ID,
      null,
    );

    // 2. Fawaz shares Aisha into Acme Org instead of recreating her.
    const aishaOrg = await organisationsService.promoteContactToOrg(
      aishaPersonal.id,
      ORG_ID,
      FAWAZ_ID,
    );
    expect(aishaOrg.orgId).toBe(ORG_ID);
    expect(aishaOrg.sourceContactId).toBe(aishaPersonal.id);

    // 3. Fawaz records a 100,000 LOAN_RECEIVED against org-Aisha, with the
    // personal-liability toggle on (defaults true in the UI whenever the
    // contact has a sourceContactId).
    const orgLoan = await transactionsService.create(
      {
        type: TransactionType.LOAN_RECEIVED,
        category: AssetCategory.FUNDS,
        amount: 100_000,
        currency: 'NGN',
        contactId: aishaOrg.id,
        date: new Date('2026-01-01'),
        recordOnPersonalLedger: true,
      },
      FAWAZ_ID,
      ORG_ID,
    );

    // 4. Fawaz partially repays 40,000 against the org loan.
    await transactionsService.create(
      {
        type: TransactionType.REPAYMENT_MADE,
        category: AssetCategory.FUNDS,
        amount: 40_000,
        currency: 'NGN',
        parentId: orgLoan.id,
        date: new Date('2026-02-01'),
      },
      FAWAZ_ID,
      ORG_ID,
    );

    // --- Assertions -------------------------------------------------------

    // Org contact standing: -100,000 (LOAN_RECEIVED) + 40,000 (REPAYMENT_MADE) = -60,000.
    const orgStanding = await contactsService.getBalance(aishaOrg.id, FAWAZ_ID);
    expect(orgStanding).toBe(-60_000);

    // Personal contact standing on the ORIGINAL Aisha mirrors it exactly —
    // same math, same sign, on a completely separate Contact row.
    const personalStanding = await contactsService.getBalance(
      aishaPersonal.id,
      FAWAZ_ID,
    );
    expect(personalStanding).toBe(-60_000);

    // Personal Total Balance (dashboard netBalance, TransactionsService.findAll
    // summary) also moves as a real, ordinary personal transaction would.
    // NOTE: netBalance uses the OPPOSITE sign convention from contact
    // standing — confirmed against the existing suite
    // (transactions.balance.spec.ts: "accumulates LOAN_RECEIVED; netBalance
    // positive", "accumulates LOAN_GIVEN; netBalance negative"). So a
    // LOAN_RECEIVED that makes contact standing go to -100,000 makes
    // netBalance go to +100,000; the 40,000 REPAYMENT_MADE then subtracts.
    // This is pre-existing codebase behavior, not something this feature
    // changes — the mirror row is deliberately indistinguishable from any
    // other personal transaction to computeNetBalance.
    const personalTotals = await transactionsService.findAll(
      FAWAZ_ID,
      null,
      {},
    );
    expect(personalTotals.summary.netBalance).toBe(100_000 - 40_000);
    expect(personalTotals.total).toBe(2); // the two mirror rows only

    // Member Bello (not the sharer) sees org-Aisha as a normal org contact:
    // same org-scoped standing, full read access, granted by org
    // membership rather than by who shared the contact in.
    const aishaAsSeenByBello = await contactsService.findOne(
      aishaOrg.id,
      BELLO_ID,
      ORG_ID,
    );
    expect(aishaAsSeenByBello.id).toBe(aishaOrg.id);
    const bolloViewOfOrgStanding = await contactsService.getBalance(
      aishaOrg.id,
      BELLO_ID,
    );
    expect(bolloViewOfOrgStanding).toBe(-60_000);

    // Bello has no access whatsoever to Fawaz's personal-side Aisha — org
    // membership never bleeds into personal-scope authorisation.
    await expect(
      contactsService.findOne(aishaPersonal.id, BELLO_ID, ORG_ID),
    ).rejects.toThrow();

    // And Bello's own personal ledger (orgId: null) is untouched — the
    // mirror only ever writes onto the sharer's own contact.
    const belloPersonalTotals = await transactionsService.findAll(
      BELLO_ID,
      null,
      {},
    );
    expect(belloPersonalTotals.total).toBe(0);
  });
});
