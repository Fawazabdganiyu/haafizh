import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectContactLinkService } from './project-contact-link.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ProjectTransactionsService } from '../projects/project-transactions.service';
import { ProjectsService } from '../projects/projects.service';
import {
  Prisma,
  ProjectTransactionType,
  TransactionType,
} from '../../generated/prisma/client';

const USER_ID = 'user-1';
const PROJECT_ID = 'proj-1';
const CONTACT_ID = 'contact-1';

const mockProject = {
  id: PROJECT_ID,
  userId: USER_ID,
  orgId: null,
  name: 'Kitchen Renovation',
  currency: 'NGN',
};

const mockContact = {
  id: CONTACT_ID,
  userId: USER_ID,
  orgId: null,
  firstName: 'Aminu',
  lastName: 'Musa',
};

const mockPrismaService = {
  project: { findUnique: jest.fn(), delete: jest.fn() },
  contact: { findUnique: jest.fn() },
  transaction: { findUnique: jest.fn(), update: jest.fn() },
  projectTransaction: { findUnique: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

const mockTransactionsService = {
  create: jest.fn(),
  createWithClient: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
  notifyWitnesses: jest.fn().mockResolvedValue(undefined),
  syncMirroredAmount: jest.fn(),
  deleteMirroredTransaction: jest.fn(),
};

const mockProjectTransactionsService = {
  create: jest.fn(),
  createWithClient: jest.fn(),
  update: jest.fn(),
  updateWithClient: jest.fn(),
  remove: jest.fn(),
  removeWithClient: jest.fn(),
  notifyWitnesses: jest.fn().mockResolvedValue(undefined),
  syncMirroredAmount: jest.fn(),
};

const mockProjectsService = {
  findOne: jest.fn(),
};

describe('ProjectContactLinkService', () => {
  let service: ProjectContactLinkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectContactLinkService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TransactionsService, useValue: mockTransactionsService },
        {
          provide: ProjectTransactionsService,
          useValue: mockProjectTransactionsService,
        },
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compile();

    service = module.get(ProjectContactLinkService);
    jest.clearAllMocks();
  });

  describe('createProjectOriginated', () => {
    it('delegates straight to ProjectTransactionsService.create when no contact link is requested', async () => {
      const input = {
        projectId: PROJECT_ID,
        amount: 100,
        type: ProjectTransactionType.INCOME,
      } as never;
      mockProjectTransactionsService.create.mockResolvedValue({ id: 'pt-1' });

      const result = await service.createProjectOriginated(USER_ID, input);

      expect(mockProjectTransactionsService.create).toHaveBeenCalledWith(
        USER_ID,
        input,
      );
      expect(result).toEqual({ id: 'pt-1' });
    });

    it('rejects a direction/type mismatch (EXPENSE project transaction paired with an INCOME-only contact type)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.EXPENSE,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.LOAN_RECEIVED,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the contact belongs to a different organisation than the project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue({
        ...mockContact,
        orgId: 'org-2',
      });

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.INCOME,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.LOAN_RECEIVED,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the caller does not own the project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        ...mockProject,
        userId: 'someone-else',
      });
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.INCOME,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.LOAN_RECEIVED,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a repayment-type contact link with no parentTransactionId', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.EXPENSE,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.REPAYMENT_MADE,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a parentTransactionId whose loan originated from a different project', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockPrismaService.transaction.findUnique.mockResolvedValue({
        id: 'loan-1',
        projectTransaction: { projectId: 'a-different-project' },
      });

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.EXPENSE,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.REPAYMENT_MADE,
          parentTransactionId: 'loan-1',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a standalone GIFT_GIVEN with no parentTransactionId (gifts have an optional, not mandatory, parent)', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockProjectTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'pt-1' },
        notifications: [],
      });
      mockTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'tx-1' },
        notifications: [],
      });

      await expect(
        service.createProjectOriginated(USER_ID, {
          projectId: PROJECT_ID,
          amount: 100,
          type: ProjectTransactionType.EXPENSE,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.GIFT_GIVEN,
        } as never),
      ).resolves.toBeDefined();
    });

    it('creates both rows atomically and marks the mirror as project-originated', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockProjectTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'pt-1' },
        notifications: [],
      });
      mockTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'tx-1' },
        notifications: [],
      });

      const input = {
        projectId: PROJECT_ID,
        amount: 500,
        type: ProjectTransactionType.INCOME,
        contactId: CONTACT_ID,
        contactTransactionType: TransactionType.LOAN_RECEIVED,
      } as never;

      await service.createProjectOriginated(USER_ID, input);

      expect(
        mockProjectTransactionsService.createWithClient,
      ).toHaveBeenCalledWith(mockPrismaService, input);
      expect(mockTransactionsService.createWithClient).toHaveBeenCalledWith(
        mockPrismaService,
        expect.objectContaining({
          type: TransactionType.LOAN_RECEIVED,
          contactId: CONTACT_ID,
          amount: 500,
          currency: mockProject.currency,
        }),
        USER_ID,
        mockProject.orgId,
        { projectTransactionId: 'pt-1', isMirroredFromProject: true },
      );
    });
  });

  describe('createContactOriginated', () => {
    it('delegates straight to TransactionsService.create when no project link is requested', async () => {
      const input = { type: TransactionType.LOAN_GIVEN, amount: 100 } as never;
      mockTransactionsService.create.mockResolvedValue({ id: 'tx-1' });

      const result = await service.createContactOriginated(
        USER_ID,
        input,
        null,
      );

      expect(mockTransactionsService.create).toHaveBeenCalledWith(
        input,
        USER_ID,
        null,
      );
      expect(result).toEqual({ id: 'tx-1' });
    });

    it('rejects linking an ITEM-category transaction to a project', async () => {
      await expect(
        service.createContactOriginated(
          USER_ID,
          {
            category: 'ITEM',
            type: TransactionType.LOAN_GIVEN,
            contactId: CONTACT_ID,
            projectId: PROJECT_ID,
          } as never,
          null,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a project link with no contactId on the transaction', async () => {
      await expect(
        service.createContactOriginated(
          USER_ID,
          {
            category: 'FUNDS',
            type: TransactionType.LOAN_GIVEN,
            projectId: PROJECT_ID,
          } as never,
          null,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates both rows atomically, deriving EXPENSE direction from LOAN_GIVEN, and links the FK back onto the Transaction', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'tx-1' },
        notifications: [],
      });
      mockProjectTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'pt-1' },
        notifications: [],
      });
      mockPrismaService.transaction.update.mockResolvedValue({
        id: 'tx-1',
        projectTransactionId: 'pt-1',
      });

      const input = {
        category: 'FUNDS',
        type: TransactionType.LOAN_GIVEN,
        amount: 300,
        contactId: CONTACT_ID,
        projectId: PROJECT_ID,
        date: new Date('2026-01-01'),
      } as never;

      await service.createContactOriginated(USER_ID, input, null);

      expect(mockTransactionsService.createWithClient).toHaveBeenCalledWith(
        mockPrismaService,
        input,
        USER_ID,
        null,
      );
      expect(
        mockProjectTransactionsService.createWithClient,
      ).toHaveBeenCalledWith(
        mockPrismaService,
        expect.objectContaining({
          projectId: PROJECT_ID,
          type: ProjectTransactionType.EXPENSE,
          contactId: CONTACT_ID,
          contactTransactionType: TransactionType.LOAN_GIVEN,
        }),
        { isMirroredFromContact: true },
      );
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { projectTransactionId: 'pt-1' },
      });
    });
  });

  describe('updateProjectOriginated — immutability', () => {
    const linkedExisting = {
      id: 'pt-1',
      contactId: CONTACT_ID,
      contactTransactionType: TransactionType.LOAN_RECEIVED,
      type: ProjectTransactionType.INCOME,
      amount: 500,
      project: mockProject,
      transaction: { id: 'tx-1' },
    };

    it('rejects changing contactId once linked', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue(
        linkedExisting,
      );

      await expect(
        service.updateProjectOriginated(USER_ID, {
          id: 'pt-1',
          contactId: 'a-different-contact',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects changing the direction (type) once linked', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue(
        linkedExisting,
      );

      await expect(
        service.updateProjectOriginated(USER_ID, {
          id: 'pt-1',
          contactTransactionType: TransactionType.LOAN_RECEIVED,
          type: ProjectTransactionType.EXPENSE,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('syncs the mirrored amount when only amount changes on an already-linked entry', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue(
        linkedExisting,
      );
      mockProjectTransactionsService.updateWithClient.mockResolvedValue({
        transaction: { id: 'pt-1' },
        amountChanged: true,
        newAmount: 700,
      });

      await service.updateProjectOriginated(USER_ID, {
        id: 'pt-1',
        contactTransactionType: TransactionType.LOAN_RECEIVED,
        amount: 700,
      } as never);

      expect(mockTransactionsService.syncMirroredAmount).toHaveBeenCalledWith(
        mockPrismaService,
        'tx-1',
        700,
        USER_ID,
      );
    });

    it('syncs the mirrored amount for an already-linked entry even when the request omits contactId/contactTransactionType — the real frontend shape, since the UI never resends immutable link fields', async () => {
      // Regression test: the frontend renders the contact link as read-only
      // once set and never resends contactId/contactTransactionType on a
      // plain amount edit — the same request shape as an entry that was
      // never linked at all. isAlreadyLinked must be checked against DB
      // state, not against which fields happen to be present in the input,
      // or every real amount edit to a linked entry silently skips the sync.
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue(
        linkedExisting,
      );
      mockProjectTransactionsService.updateWithClient.mockResolvedValue({
        transaction: { id: 'pt-1' },
        amountChanged: true,
        newAmount: 700,
      });

      await service.updateProjectOriginated(USER_ID, {
        id: 'pt-1',
        amount: 700,
      } as never);

      expect(mockProjectTransactionsService.update).not.toHaveBeenCalled();
      expect(mockTransactionsService.syncMirroredAmount).toHaveBeenCalledWith(
        mockPrismaService,
        'tx-1',
        700,
        USER_ID,
      );
    });

    it('takes the plain-update shortcut for a genuinely unlinked entry with no link fields in the request', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        ...linkedExisting,
        contactId: null,
        contactTransactionType: null,
        transaction: null,
      });
      mockProjectTransactionsService.update.mockResolvedValue({ id: 'pt-1' });

      await service.updateProjectOriginated(USER_ID, {
        id: 'pt-1',
        amount: 700,
      } as never);

      expect(mockProjectTransactionsService.update).toHaveBeenCalledWith(
        USER_ID,
        {
          id: 'pt-1',
          amount: 700,
        },
      );
      expect(mockTransactionsService.syncMirroredAmount).not.toHaveBeenCalled();
    });

    it('throws NotFoundException (not ForbiddenException) when the caller does not own the project, to obscure existence', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        ...linkedExisting,
        project: { ...mockProject, userId: 'someone-else' },
      });

      await expect(
        service.updateProjectOriginated(USER_ID, {
          id: 'pt-1',
          amount: 100,
          contactTransactionType: TransactionType.LOAN_RECEIVED,
        } as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateContactOriginated', () => {
    const linkedTransaction = {
      id: 'tx-1',
      contactId: CONTACT_ID,
      projectTransactionId: 'pt-1',
      type: TransactionType.LOAN_GIVEN,
      amount: 300,
      date: new Date('2026-01-01'),
      description: null,
      parentId: null,
    };

    it('allows editing other fields when the resubmitted projectId matches the existing link (a no-op resend)', async () => {
      mockTransactionsService.findOne.mockResolvedValue(linkedTransaction);
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        projectId: PROJECT_ID,
      });
      mockTransactionsService.update.mockResolvedValue({ id: 'tx-1' });

      await service.updateContactOriginated(USER_ID, {
        id: 'tx-1',
        projectId: PROJECT_ID,
        description: 'updated description',
      } as never);

      expect(mockTransactionsService.update).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({ description: 'updated description' }),
        USER_ID,
        null,
      );
    });

    it('rejects changing the transaction type once linked to a project', async () => {
      mockTransactionsService.findOne.mockResolvedValue(linkedTransaction);

      await expect(
        service.updateContactOriginated(USER_ID, {
          id: 'tx-1',
          type: TransactionType.GIFT_GIVEN,
        } as never),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionsService.update).not.toHaveBeenCalled();
    });

    it('syncs the mirrored ProjectTransaction amount when an already-linked transaction has its amount edited', async () => {
      mockTransactionsService.findOne.mockResolvedValue(linkedTransaction);
      mockTransactionsService.update.mockResolvedValue({
        id: 'tx-1',
        amount: 500,
      });

      await service.updateContactOriginated(USER_ID, {
        id: 'tx-1',
        amount: 500,
      } as never);

      expect(mockTransactionsService.update).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({ amount: 500 }),
        USER_ID,
        null,
      );
      expect(
        mockProjectTransactionsService.syncMirroredAmount,
      ).toHaveBeenCalledWith(mockPrismaService, 'pt-1', 500, USER_ID);
    });

    it('does not call syncMirroredAmount when the amount is unchanged', async () => {
      mockTransactionsService.findOne.mockResolvedValue(linkedTransaction);
      mockTransactionsService.update.mockResolvedValue({ id: 'tx-1' });

      await service.updateContactOriginated(USER_ID, {
        id: 'tx-1',
        amount: linkedTransaction.amount,
        description: 'no amount change',
      } as never);

      expect(
        mockProjectTransactionsService.syncMirroredAmount,
      ).not.toHaveBeenCalled();
    });

    it('rejects an attempt to point an already-linked transaction at a different project', async () => {
      mockTransactionsService.findOne.mockResolvedValue(linkedTransaction);
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        projectId: PROJECT_ID,
      });

      await expect(
        service.updateContactOriginated(USER_ID, {
          id: 'tx-1',
          projectId: 'a-different-project',
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('retroactively links an unlinked transaction and returns the post-link row, not the stale pre-link one', async () => {
      mockTransactionsService.findOne.mockResolvedValue({
        ...linkedTransaction,
        projectTransactionId: null,
      });
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockTransactionsService.update.mockResolvedValue({
        id: 'tx-1',
        projectTransactionId: null,
      });
      mockProjectTransactionsService.createWithClient.mockResolvedValue({
        transaction: { id: 'pt-2' },
        notifications: [],
      });
      mockPrismaService.transaction.update.mockResolvedValue({
        id: 'tx-1',
        projectTransactionId: 'pt-2',
      });

      const result = await service.updateContactOriginated(USER_ID, {
        id: 'tx-1',
        projectId: PROJECT_ID,
      } as never);

      expect(result).toEqual({ id: 'tx-1', projectTransactionId: 'pt-2' });
    });
  });

  describe('removeProjectOriginated', () => {
    it('delegates to ProjectTransactionsService.remove when the entry is unlinked', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        id: 'pt-1',
        project: mockProject,
        transaction: null,
      });
      mockProjectTransactionsService.remove.mockResolvedValue({ id: 'pt-1' });

      const result = await service.removeProjectOriginated(USER_ID, 'pt-1');

      expect(mockProjectTransactionsService.remove).toHaveBeenCalledWith(
        USER_ID,
        'pt-1',
      );
      expect(result).toEqual({ id: 'pt-1' });
    });

    it('blocks deletion when this ProjectTransaction is itself a passive mirror of a real contact transaction (never attempting the delete)', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        id: 'pt-1',
        project: mockProject,
        isMirroredFromContact: true,
        transaction: { id: 'tx-1', witnesses: [], conversions: [] },
      });

      await expect(
        service.removeProjectOriginated(USER_ID, 'pt-1'),
      ).rejects.toThrow(BadRequestException);
      expect(
        mockTransactionsService.deleteMirroredTransaction,
      ).not.toHaveBeenCalled();
    });

    it('blocks deletion when the linked mirror Transaction has witnesses', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        id: 'pt-1',
        project: mockProject,
        transaction: { id: 'tx-1', witnesses: [{ id: 'w1' }], conversions: [] },
      });

      await expect(
        service.removeProjectOriginated(USER_ID, 'pt-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(
        mockTransactionsService.deleteMirroredTransaction,
      ).not.toHaveBeenCalled();
    });

    it('blocks deletion when the linked mirror Transaction has repayment history', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        id: 'pt-1',
        project: mockProject,
        transaction: {
          id: 'tx-1',
          witnesses: [],
          conversions: [{ id: 'repay-1' }],
        },
      });

      await expect(
        service.removeProjectOriginated(USER_ID, 'pt-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes the mirror first, then the ProjectTransaction, when the mirror is clean', async () => {
      mockPrismaService.projectTransaction.findUnique.mockResolvedValue({
        id: 'pt-1',
        project: mockProject,
        transaction: { id: 'tx-1', witnesses: [], conversions: [] },
      });
      mockProjectTransactionsService.removeWithClient.mockResolvedValue({
        id: 'pt-1',
      });

      await service.removeProjectOriginated(USER_ID, 'pt-1');

      expect(
        mockTransactionsService.deleteMirroredTransaction,
      ).toHaveBeenCalledWith(mockPrismaService, 'tx-1', USER_ID);
      expect(
        mockProjectTransactionsService.removeWithClient,
      ).toHaveBeenCalledWith(mockPrismaService, USER_ID, 'pt-1');
    });
  });

  describe('removeProject', () => {
    afterEach(() => jest.restoreAllMocks());

    it('deletes the project outright when it has no project transactions', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([]);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      const result = await service.removeProject(USER_ID, PROJECT_ID);

      expect(mockProjectsService.findOne).toHaveBeenCalledWith(
        PROJECT_ID,
        USER_ID,
      );
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
      });
      expect(mockTransactionsService.remove).not.toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    it('deletes a mix of plain, project-originated-linked, and contact-originated-mirrored transactions, then the project', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        { id: 'pt-plain', witnesses: [], transaction: null },
        {
          id: 'pt-project-originated',
          witnesses: [],
          isMirroredFromContact: false,
          transaction: {
            id: 'tx-1',
            orgId: null,
            witnesses: [],
            conversions: [],
          },
        },
        {
          id: 'pt-contact-originated',
          witnesses: [],
          isMirroredFromContact: true,
          transaction: {
            id: 'tx-2',
            orgId: 'org-1',
            witnesses: [],
            conversions: [],
          },
        },
      ]);
      const removeProjectOriginatedSpy = jest
        .spyOn(service, 'removeProjectOriginated')
        .mockResolvedValue({ id: 'pt' } as never);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      await service.removeProject(USER_ID, PROJECT_ID);

      expect(removeProjectOriginatedSpy).toHaveBeenCalledWith(
        USER_ID,
        'pt-plain',
      );
      expect(removeProjectOriginatedSpy).toHaveBeenCalledWith(
        USER_ID,
        'pt-project-originated',
      );
      expect(mockTransactionsService.remove).toHaveBeenCalledWith(
        'tx-2',
        USER_ID,
        'org-1',
      );
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
      });
    });

    it('rejects the whole deletion when a project transaction has a direct witness, deleting nothing', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        { id: 'pt-1', witnesses: [{ id: 'w1' }], transaction: null },
      ]);

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
      expect(mockTransactionsService.remove).not.toHaveBeenCalled();
      expect(
        mockProjectTransactionsService.removeWithClient,
      ).not.toHaveBeenCalled();
    });

    it('rejects the whole deletion when a linked transaction has witnesses', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        {
          id: 'pt-1',
          witnesses: [],
          isMirroredFromContact: false,
          transaction: {
            id: 'tx-1',
            orgId: null,
            witnesses: [{ id: 'w1' }],
            conversions: [],
          },
        },
      ]);

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    it('rejects the whole deletion when a project-originated linked transaction has repayment history', async () => {
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        {
          id: 'pt-1',
          witnesses: [],
          isMirroredFromContact: false,
          transaction: {
            id: 'tx-1',
            orgId: null,
            witnesses: [],
            conversions: [{ id: 'repay-1' }],
          },
        },
      ]);

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    it('rejects the whole deletion when a contact-originated mirror has repayment history, even though TransactionsService.remove has no conversions guard of its own', async () => {
      // Regression test: TransactionsService.remove() (the delete path used
      // for isMirroredFromContact rows) never checks `conversions` before
      // hard-deleting. If this pre-check didn't also block on repayment
      // history for mirrored rows, removeProject would silently orphan the
      // child repayment's parentId (ON DELETE SET NULL) instead of blocking.
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        {
          id: 'pt-1',
          witnesses: [],
          isMirroredFromContact: true,
          transaction: {
            id: 'tx-1',
            orgId: null,
            witnesses: [],
            conversions: [{ id: 'repay-1' }],
          },
        },
      ]);

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockTransactionsService.remove).not.toHaveBeenCalled();
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });

    it('converts a foreign-key violation on the final project delete into a clean ConflictException', async () => {
      // Regression test: if a witness is added to a mirrored transaction in
      // the race window between the pre-check and its turn in the loop,
      // TransactionsService.remove() cancels (not deletes) it instead of
      // throwing, leaving a residual ProjectTransaction row that trips the
      // project_transactions_projectId_fkey (RESTRICT) on the final delete.
      mockProjectsService.findOne.mockResolvedValue(mockProject);
      mockPrismaService.projectTransaction.findMany.mockResolvedValue([
        {
          id: 'pt-1',
          witnesses: [],
          isMirroredFromContact: true,
          transaction: {
            id: 'tx-1',
            orgId: null,
            witnesses: [],
            conversions: [],
          },
        },
      ]);
      mockTransactionsService.remove.mockResolvedValue(undefined);
      mockPrismaService.project.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Foreign key constraint failed',
          {
            code: 'P2003',
            clientVersion: '7.3.0',
          },
        ),
      );

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('propagates NotFoundException from ownership/existence check without touching the DB', async () => {
      mockProjectsService.findOne.mockRejectedValue(
        new NotFoundException(`Project with ID ${PROJECT_ID} not found`),
      );

      await expect(service.removeProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockPrismaService.projectTransaction.findMany,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });
  });
});
