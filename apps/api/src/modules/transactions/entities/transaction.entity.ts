import {
  ObjectType,
  Field,
  Float,
  Int,
  ID,
  registerEnumType,
} from '@nestjs/graphql';
import {
  AssetCategory,
  TransactionType,
  TransactionStatus,
  WitnessStatus,
} from '../../../generated/prisma/client';
import { Contact } from '../../contacts/entities/contact.entity';
import { User } from '../../users/entities/user.entity';
import { Witness } from '../../witnesses/entities/witness.entity';
import { TransactionHistory } from './transaction-history.entity';
import { ProjectTransaction } from '../../projects/entities/project-transaction.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
});

registerEnumType(AssetCategory, {
  name: 'AssetCategory',
});

registerEnumType(TransactionType, {
  name: 'TransactionType',
});

registerEnumType(WitnessStatus, {
  name: 'WitnessStatus',
});

@ObjectType()
export class Transaction {
  @Field(() => ID)
  id: string;

  @Field(() => AssetCategory)
  category: AssetCategory;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field({ nullable: true })
  itemName?: string;

  @Field(() => Int, { nullable: true })
  quantity?: number;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field()
  currency: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  createdAt: Date;

  @Field({ nullable: true })
  parentId?: string;

  @Field(() => Transaction, { nullable: true })
  parent?: Transaction;

  @Field(() => [Transaction], { nullable: true })
  conversions?: Transaction[];

  /**
   * For lifecycle parent transactions (loans + escrows): parent.amount
   * minus the sum of non-cancelled children (repayments + gift conversions
   * for loans; remittances for escrows). Resolved on demand.
   */
  @Field(() => Float, { nullable: true })
  remainingAmount?: number;

  @Field({ nullable: true })
  contactId?: string;

  @Field(() => Contact, { nullable: true })
  contact?: Contact;

  @Field()
  createdById: string;

  @Field(() => User, { nullable: true })
  createdBy?: User;

  @Field(() => [Witness], { nullable: true })
  witnesses?: Witness[];

  @Field(() => [TransactionHistory], { nullable: true })
  history?: TransactionHistory[];

  @Field({ nullable: true })
  projectTransactionId?: string;

  @Field()
  isMirroredFromProject: boolean;

  @Field(() => ProjectTransaction, { nullable: true })
  projectTransaction?: ProjectTransaction;

  @Field({ nullable: true })
  orgId?: string;

  @Field(() => Organisation, { nullable: true })
  organisation?: Organisation;

  /**
   * Set only on a personal-ledger mirror row (see
   * TransactionsService.createWithClient's recordOnPersonalLedger branch):
   * points back at the org transaction it reflects. Read this (rather than
   * denormalised org/project columns) to render "on behalf of <org>" —
   * org and project attribution live on the org-side row and are reached
   * through this link so re-linking a project never leaves the mirror stale.
   */
  @Field({ nullable: true })
  orgSourceTransactionId?: string;

  @Field(() => Transaction, { nullable: true })
  orgSourceTransaction?: Transaction;
}
