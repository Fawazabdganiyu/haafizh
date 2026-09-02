import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ProjectTransactionType } from '../../generated/prisma/client';
import { CreateProjectInput } from './dto/create-project.input';
import { UpdateProjectInput } from './dto/update-project.input';
import {
  FilterProjectInput,
  ProjectBalanceStanding,
} from './dto/filter-project.input';
import { PaginatedProjectsResponse } from './entities/paginated-projects-response.entity';
import { Contact } from '../contacts/entities/contact.entity';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    orgId: string | null,
    input: CreateProjectInput,
  ) {
    return this.prisma.project.create({
      data: {
        ...input,
        userId,
        ...(orgId != null && { orgId }),
      },
    });
  }

  async findAll(
    userId: string,
    orgId: string | null,
    filter?: FilterProjectInput,
  ): Promise<PaginatedProjectsResponse> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 25;

    const baseWhere: Prisma.ProjectWhereInput = orgId
      ? { orgId }
      : { userId, orgId: null };

    // Balance standing requires raw SQL (column-vs-column comparison)
    if (
      filter?.balanceStanding &&
      filter.balanceStanding !== ProjectBalanceStanding.ALL
    ) {
      const isOverBudget =
        filter.balanceStanding === ProjectBalanceStanding.OVER_BUDGET;

      const rawIds = orgId
        ? await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "projects"
            WHERE "orgId" = ${orgId}
            AND "budget" IS NOT NULL
            AND ${isOverBudget ? Prisma.sql`"balance" > "budget"` : Prisma.sql`"balance" <= "budget"`}
            ${filter?.search ? Prisma.sql`AND "name" ILIKE ${'%' + filter.search + '%'}` : Prisma.empty}
            ${filter?.status ? Prisma.sql`AND "status" = ${filter.status}::"ProjectStatus"` : Prisma.empty}
          `
        : await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "projects"
            WHERE "userId" = ${userId}
            AND "orgId" IS NULL
            AND "budget" IS NOT NULL
            AND ${isOverBudget ? Prisma.sql`"balance" > "budget"` : Prisma.sql`"balance" <= "budget"`}
            ${filter?.search ? Prisma.sql`AND "name" ILIKE ${'%' + filter.search + '%'}` : Prisma.empty}
            ${filter?.status ? Prisma.sql`AND "status" = ${filter.status}::"ProjectStatus"` : Prisma.empty}
          `;

      const ids = rawIds.map((r) => r.id);
      const total = ids.length;
      const items = await this.prisma.project.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        items: items as unknown as PaginatedProjectsResponse['items'],
        total,
        page,
        limit,
      };
    }

    const where: Prisma.ProjectWhereInput = {
      ...baseWhere,
      ...(filter?.search && {
        name: { contains: filter.search, mode: 'insensitive' },
      }),
      ...(filter?.status && { status: filter.status }),
    };

    const [total, items] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: items as unknown as PaginatedProjectsResponse['items'],
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, userId: string, orgId: string | null = null) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    if (project.userId === userId) {
      return project;
    }

    // Org projects are shared by every member, matching ContactsService's
    // assertContactAccess convention — membership, not creation, grants access.
    if (project.orgId && project.orgId === orgId) {
      const member = await this.prisma.organisationMember.findUnique({
        where: { orgId_userId: { orgId: project.orgId, userId } },
      });
      if (member) {
        return project;
      }
    }

    throw new NotFoundException(`Project with ID ${id} not found`);
  }

  async getTransactionTotals(
    projectId: string,
  ): Promise<{ totalIncome: number; totalExpenses: number }> {
    const results = await this.prisma.projectTransaction.groupBy({
      by: ['type'],
      where: { projectId },
      _sum: { amount: true },
    });

    const income =
      results
        .find((r) => r.type === ProjectTransactionType.INCOME)
        ?._sum.amount?.toNumber() ?? 0;
    const expenses =
      results
        .find((r) => r.type === ProjectTransactionType.EXPENSE)
        ?._sum.amount?.toNumber() ?? 0;

    return { totalIncome: income, totalExpenses: expenses };
  }

  /** Distinct contacts referenced by this project's transactions — surfaced
   * on the delete-project confirmation so the consequence of also removing
   * those contacts' linked ledger entries is communicated up front. */
  async getLinkedContacts(projectId: string): Promise<Contact[]> {
    const rows = await this.prisma.projectTransaction.findMany({
      where: { projectId, contactId: { not: null } },
      distinct: ['contactId'],
      include: { contact: true },
    });

    return rows
      .map((row) => row.contact)
      .filter(
        (contact): contact is NonNullable<typeof contact> => !!contact,
      ) as unknown as Contact[];
  }

  async update(
    userId: string,
    input: UpdateProjectInput,
    orgId: string | null = null,
  ) {
    // Verify ownership or org membership
    await this.findOne(input.id, userId, orgId);

    return this.prisma.project.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description,
        budget: input.budget,
        currency: input.currency,
        status: input.status,
      },
    });
  }
}
