import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveOrg } from '../organisations/decorators/active-org.decorator';
import { User } from '../users/entities/user.entity';
import { CheckFeature } from '../subscription/decorators/check-feature.decorator';
import { FeatureLimitInterceptor } from '../subscription/interceptors/feature-limit.interceptor';
import { ProjectContactLinkService } from './project-contact-link.service';
import { ProjectTransaction } from '../projects/entities/project-transaction.entity';
import { Project } from '../projects/entities/project.entity';
import { LogProjectTransactionInput } from '../projects/dto/log-project-transaction.input';
import { UpdateProjectTransactionInput } from '../projects/dto/update-project-transaction.input';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CreateTransactionInput } from '../transactions/dto/create-transaction.input';
import { UpdateTransactionInput } from '../transactions/dto/update-transaction.input';

/**
 * Owns every mutation that can create/edit a linked (Transaction,
 * ProjectTransaction) pair, from both origin directions. Split out from
 * ProjectsResolver/TransactionsResolver specifically so ProjectsModule and
 * TransactionsModule never need to import this module back — only this
 * module imports them (see ProjectContactLinksModule).
 */
@Resolver()
@UseGuards(GqlAuthGuard)
export class ProjectContactLinkResolver {
  constructor(private readonly linkService: ProjectContactLinkService) {}

  @Mutation(() => ProjectTransaction)
  async logProjectTransaction(
    @CurrentUser() user: User,
    @Args('input') input: LogProjectTransactionInput,
  ) {
    return this.linkService.createProjectOriginated(user.id, input);
  }

  @Mutation(() => ProjectTransaction)
  async updateProjectTransaction(
    @CurrentUser() user: User,
    @Args('input') input: UpdateProjectTransactionInput,
  ) {
    return this.linkService.updateProjectOriginated(user.id, input);
  }

  @Mutation(() => ProjectTransaction)
  async removeProjectTransaction(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.linkService.removeProjectOriginated(user.id, id);
  }

  @Mutation(() => Project)
  async removeProject(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.linkService.removeProject(user.id, id);
  }

  @Mutation(() => Transaction)
  @CheckFeature('maxWitnessesPerMonth')
  @UseInterceptors(FeatureLimitInterceptor)
  async createTransaction(
    @Args('input') input: CreateTransactionInput,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.linkService.createContactOriginated(user.id, input, orgId);
  }

  @Mutation(() => Transaction)
  @CheckFeature('maxWitnessesPerMonth')
  @UseInterceptors(FeatureLimitInterceptor)
  async updateTransaction(
    @Args('input') input: UpdateTransactionInput,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.linkService.updateContactOriginated(user.id, input, orgId);
  }
}
