import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectBalanceStanding } from './dto/filter-project.input';

describe('ProjectsService — findAll pagination', () => {
  let service: ProjectsService;
  let prisma: {
    project: { findMany: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      project: { findMany: jest.fn(), count: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('returns paginated projects with total', async () => {
    prisma.project.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Alpha',
        balance: 100,
        budget: 200,
        status: 'ACTIVE',
      },
    ]);
    prisma.project.count.mockResolvedValue(1);
    const result = await service.findAll('user-1', null, {
      page: 1,
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('filters by OVER_BUDGET — uses $queryRaw', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    await service.findAll('user-1', null, {
      balanceStanding: ProjectBalanceStanding.OVER_BUDGET,
    });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

describe('ProjectsService — getLinkedContacts', () => {
  let service: ProjectsService;
  let prisma: { projectTransaction: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { projectTransaction: { findMany: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('returns the distinct contacts linked via the project transactions', async () => {
    prisma.projectTransaction.findMany.mockResolvedValue([
      { contact: { id: 'c1', firstName: 'Aminu', lastName: 'Musa' } },
      { contact: { id: 'c2', firstName: 'Ngozi', lastName: 'Eze' } },
    ]);

    const result = await service.getLinkedContacts('proj-1');

    expect(prisma.projectTransaction.findMany).toHaveBeenCalledWith({
      where: { projectId: 'proj-1', contactId: { not: null } },
      distinct: ['contactId'],
      include: { contact: true },
    });
    expect(result).toEqual([
      { id: 'c1', firstName: 'Aminu', lastName: 'Musa' },
      { id: 'c2', firstName: 'Ngozi', lastName: 'Eze' },
    ]);
  });

  it('returns an empty array when no transactions are linked to a contact', async () => {
    prisma.projectTransaction.findMany.mockResolvedValue([]);

    const result = await service.getLinkedContacts('proj-1');

    expect(result).toEqual([]);
  });
});

describe('ProjectsService — findOne / update access control', () => {
  let service: ProjectsService;
  let prisma: {
    project: { findUnique: jest.Mock; update: jest.Mock };
    organisationMember: { findUnique: jest.Mock };
  };

  const personalProject = {
    id: 'proj-1',
    userId: 'creator',
    orgId: null,
    name: 'Personal Project',
  };

  const orgProject = {
    id: 'proj-2',
    userId: 'creator',
    orgId: 'org-1',
    name: 'Org Project',
  };

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn(), update: jest.fn() },
      organisationMember: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  describe('findOne', () => {
    it('allows the creator to access their personal project', async () => {
      prisma.project.findUnique.mockResolvedValue(personalProject);
      const result = await service.findOne('proj-1', 'creator', null);
      expect(result).toEqual(personalProject);
    });

    it('rejects a non-creator from accessing a personal project even with an active org', async () => {
      prisma.project.findUnique.mockResolvedValue(personalProject);
      await expect(
        service.findOne('proj-1', 'other-user', 'org-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('allows the creator to access an org project', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      const result = await service.findOne('proj-2', 'creator', 'org-1');
      expect(result).toEqual(orgProject);
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('allows a non-creator org member to access an org project', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      prisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });
      const result = await service.findOne('proj-2', 'teammate', 'org-1');
      expect(result).toEqual(orgProject);
      expect(prisma.organisationMember.findUnique).toHaveBeenCalledWith({
        where: { orgId_userId: { orgId: 'org-1', userId: 'teammate' } },
      });
    });

    it('rejects a non-member from accessing an org project', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      prisma.organisationMember.findUnique.mockResolvedValue(null);
      await expect(
        service.findOne('proj-2', 'not-a-member', 'org-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects access to an org project when the caller has no active org', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      await expect(service.findOne('proj-2', 'teammate', null)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('rejects access to an org project from a different active org', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      await expect(
        service.findOne('proj-2', 'teammate', 'org-2'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.organisationMember.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing', 'creator', null)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('allows a non-creator org member to update an org project', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      prisma.organisationMember.findUnique.mockResolvedValue({
        id: 'mem-1',
        role: 'OPERATOR',
      });
      prisma.project.update.mockResolvedValue({
        ...orgProject,
        name: 'Renamed',
      });

      const result = await service.update(
        'teammate',
        { id: 'proj-2', name: 'Renamed' },
        'org-1',
      );

      expect(result.name).toBe('Renamed');
      expect(prisma.project.update).toHaveBeenCalled();
    });

    it('rejects a non-member from updating an org project', async () => {
      prisma.project.findUnique.mockResolvedValue(orgProject);
      prisma.organisationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.update('not-a-member', { id: 'proj-2', name: 'X' }, 'org-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });
  });
});
