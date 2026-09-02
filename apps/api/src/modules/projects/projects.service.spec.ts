import { Test } from '@nestjs/testing';
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
