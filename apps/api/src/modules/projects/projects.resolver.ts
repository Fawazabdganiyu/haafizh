import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Float,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveOrg } from '../organisations/decorators/active-org.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectsService } from './projects.service';
import { ProjectTransactionsService } from './project-transactions.service';
import { Project } from './entities/project.entity';
import { CreateProjectInput } from './dto/create-project.input';
import { UpdateProjectInput } from './dto/update-project.input';
import { FilterProjectInput } from './dto/filter-project.input';
import { FilterProjectTransactionInput } from './dto/filter-project-transaction.input';
import { PaginatedProjectsResponse } from './entities/paginated-projects-response.entity';
import { PaginatedProjectTransactionsResponse } from './entities/paginated-project-transactions-response.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../../generated/prisma/client';
import { Contact } from '../contacts/entities/contact.entity';

@Resolver(() => Project)
@UseGuards(GqlAuthGuard)
export class ProjectsResolver {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectTransactionsService: ProjectTransactionsService,
  ) {}

  @Query(() => PaginatedProjectsResponse, { name: 'myProjects' })
  async myProjects(
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
    @Args('filter', { nullable: true }) filter?: FilterProjectInput,
  ) {
    return this.projectsService.findAll(user.id, orgId, filter);
  }

  @Query(() => Project, { name: 'project' })
  async project(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.projectsService.findOne(id, user.id, orgId);
  }

  @Mutation(() => Project)
  async createProject(
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
    @Args('input') input: CreateProjectInput,
  ) {
    return this.projectsService.create(user.id, orgId, input);
  }

  @Mutation(() => Project)
  async updateProject(
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
    @Args('input') input: UpdateProjectInput,
  ) {
    return this.projectsService.update(user.id, input, orgId);
  }

  @ResolveField(() => Float, { defaultValue: 0 })
  async totalIncome(@Parent() project: Project): Promise<number> {
    const { totalIncome } = await this.projectsService.getTransactionTotals(
      project.id,
    );
    return totalIncome;
  }

  @ResolveField(() => Float, { defaultValue: 0 })
  async totalExpenses(@Parent() project: Project): Promise<number> {
    const { totalExpenses } = await this.projectsService.getTransactionTotals(
      project.id,
    );
    return totalExpenses;
  }

  @ResolveField(() => PaginatedProjectTransactionsResponse)
  async transactions(
    @Parent() project: Project,
    @Args('filter', { nullable: true }) filter?: FilterProjectTransactionInput,
  ): Promise<PaginatedProjectTransactionsResponse> {
    return this.projectTransactionsService.findByProject(project.id, filter);
  }

  @ResolveField(() => [Contact])
  async linkedContacts(@Parent() project: Project): Promise<Contact[]> {
    return this.projectsService.getLinkedContacts(project.id);
  }

  @Query(() => [String], { name: 'projectTransactionCategorySuggestions' })
  async projectTransactionCategorySuggestions(
    @CurrentUser() user: User,
    @Args('projectId', { type: () => ID }) projectId: string,
  ) {
    return this.projectTransactionsService.usedCategories(user.id, projectId);
  }

  @Query(() => [Transaction], { name: 'projectContactOutstandingLoans' })
  async projectContactOutstandingLoans(
    @CurrentUser() user: User,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('contactId', { type: () => ID }) contactId: string,
    @Args('contactTransactionType', {
      type: () => TransactionType,
      nullable: true,
    })
    contactTransactionType?: TransactionType,
  ) {
    return this.projectTransactionsService.findOutstandingContactLoans(
      user.id,
      projectId,
      contactId,
      contactTransactionType,
    );
  }
}
