import { InputType, Field, Float, Int, ID } from '@nestjs/graphql';
import {
  AssetCategory,
  TransactionType,
} from '../../../generated/prisma/client';
import {
  IsEnum,
  IsNotIn,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { WitnessInviteInput } from '../../witnesses/dto/witness-invite.input';

@InputType()
export class CreateTransactionInput {
  @Field(() => AssetCategory)
  @IsEnum(AssetCategory)
  category: AssetCategory;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  itemName?: string;

  @Field(() => Int, { defaultValue: 1, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @Field(() => TransactionType)
  @IsEnum(TransactionType)
  @IsNotIn(['GIVEN', 'RECEIVED', 'RETURNED', 'GIFT'], {
    message:
      'This transaction type is no longer supported. Use the new formal types.',
  })
  type: TransactionType;

  @Field({ defaultValue: 'NGN' })
  @IsString()
  currency: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  parentId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  contactId?: string;

  /** Optionally link this transaction to a project — the project-side direction (income/expense) is derived automatically from `type`. */
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  projectId?: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  witnessUserIds?: string[];

  @Field(() => [WitnessInviteInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WitnessInviteInput)
  witnessInvites?: WitnessInviteInput[];

  /**
   * Org-mode only: when the contact is a `sourceContactId`-linked copy of
   * one of the caller's own personal contacts, also write a real, separate
   * Transaction onto that personal contact's ledger (same type/amount,
   * orgId null), linked back via `orgSourceTransactionId`. Ignored outside
   * org mode or when the contact has no personal source of the caller's own.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  recordOnPersonalLedger?: boolean;
}
