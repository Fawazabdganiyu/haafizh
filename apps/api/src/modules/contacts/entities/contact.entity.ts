import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class Contact {
  @Field(() => ID)
  id: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  linkedUserId?: string;

  @Field({ nullable: true })
  orgId?: string;

  @Field({ nullable: true })
  sourceContactId?: string;

  @Field(() => User, { nullable: true })
  sharedBy?: User;

  @Field()
  createdAt: Date;

  @Field()
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => [Transaction], { nullable: true })
  transactions?: Transaction[];

  @Field(() => Number)
  balance: number;

  @Field(() => Boolean)
  isOnPlatform: boolean;

  @Field(() => Boolean)
  isSupporter: boolean;

  @Field(() => Boolean)
  hasPendingInvitation: boolean;
}
