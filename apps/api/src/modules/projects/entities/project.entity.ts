import {
  ObjectType,
  Field,
  Float,
  ID,
  registerEnumType,
} from '@nestjs/graphql';
import { ProjectStatus } from '../../../generated/prisma/enums';
import { PaginatedProjectTransactionsResponse } from './paginated-project-transactions-response.entity';
import { Contact } from '../../contacts/entities/contact.entity';

registerEnumType(ProjectStatus, { name: 'ProjectStatus' });

@ObjectType()
export class Project {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  budget?: number;

  @Field(() => Float, { defaultValue: 0 })
  balance: number;

  @Field(() => Float, { defaultValue: 0 })
  totalIncome: number;

  @Field(() => Float, { defaultValue: 0 })
  totalExpenses: number;

  @Field({ defaultValue: 'NGN' })
  currency: string;

  @Field(() => ProjectStatus, { defaultValue: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @Field()
  userId: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => PaginatedProjectTransactionsResponse, { nullable: true })
  transactions?: PaginatedProjectTransactionsResponse;

  @Field(() => [Contact], { nullable: true })
  linkedContacts?: Contact[];
}
