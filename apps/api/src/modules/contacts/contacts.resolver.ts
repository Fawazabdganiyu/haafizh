import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Contact } from './entities/contact.entity';
import { Contact as PrismaContact } from '../../generated/prisma/client';
import { CreateContactInput } from './dto/create-contact.input';
import { UpdateContactInput } from './dto/update-contact.input';
import { FilterContactInput } from './dto/filter-contact.input';
import { PaginatedContactsResponse } from './entities/paginated-contacts-response.entity';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InviteContactResponse,
  ContactPlatformStatus,
} from './entities/invite-response.entity';
import { CheckFeature } from '../subscription/decorators/check-feature.decorator';
import { FeatureLimitInterceptor } from '../subscription/interceptors/feature-limit.interceptor';
import { ActiveOrg } from '../organisations/decorators/active-org.decorator';

@Resolver(() => Contact)
@UseGuards(GqlAuthGuard)
export class ContactsResolver {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
  ) {}

  @Mutation(() => Contact)
  @CheckFeature('maxContacts')
  @UseInterceptors(FeatureLimitInterceptor)
  createContact(
    @Args('createContactInput') createContactInput: CreateContactInput,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.create(createContactInput, user.id, orgId);
  }

  @Query(() => PaginatedContactsResponse, { name: 'contacts' })
  findAll(
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
    @Args('filter', { nullable: true }) filter?: FilterContactInput,
  ) {
    return this.contactsService.findAll(user.id, orgId, filter);
  }

  /** Candidates for "From my contacts" when recording an org transaction. */
  @Query(() => PaginatedContactsResponse, { name: 'shareableContacts' })
  shareableContacts(
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
    @Args('filter', { nullable: true }) filter?: FilterContactInput,
  ) {
    return this.contactsService.findShareable(user.id, orgId, filter);
  }

  @Query(() => Contact, { name: 'contact' })
  findOne(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.findOne(id, user.id, orgId);
  }

  @ResolveField(() => String)
  name(@Parent() contact: Contact): string {
    return (
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      (contact as unknown as { name?: string }).name ||
      ''
    );
  }

  @ResolveField(() => Number)
  async balance(@Parent() contact: Contact, @CurrentUser() user: User) {
    return this.contactsService.getBalance(contact.id, user.id);
  }

  /**
   * Populated only when this contact is a `sourceContactId`-linked copy
   * shared into an org — the "Shared by <name>" provenance line. The
   * sharer is whoever's `userId` owns the org copy (promoteContactToOrg
   * sets it to the caller who ran the share), not the source contact's
   * own owner, which other members should never see.
   */
  @ResolveField(() => User, { nullable: true })
  async sharedBy(@Parent() contact: Contact): Promise<User | null> {
    if (!contact.sourceContactId) return null;
    const user = await this.prisma.user.findUnique({
      where: { id: contact.userId },
    });
    return user as unknown as User | null;
  }

  @ResolveField(() => Boolean)
  async isOnPlatform(
    @Parent() contact: Contact,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    const status = await this.contactsService.checkContactOnPlatform(
      contact.id,
      user.id,
      contact as PrismaContact,
    );
    return status.isRegistered;
  }

  @ResolveField(() => Boolean)
  async isSupporter(
    @Parent() contact: Contact,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    const status = await this.contactsService.checkContactOnPlatform(
      contact.id,
      user.id,
      contact as PrismaContact,
    );
    return status.registeredUser?.isSupporter ?? false;
  }

  @ResolveField(() => Boolean)
  async hasPendingInvitation(
    @Parent() contact: Contact,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    const status = await this.contactsService.checkContactOnPlatform(
      contact.id,
      user.id,
      contact as PrismaContact,
    );
    return status.hasPendingInvitation;
  }

  @Mutation(() => Contact)
  updateContact(
    @Args('updateContactInput') updateContactInput: UpdateContactInput,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.update(
      updateContactInput.id,
      updateContactInput,
      user.id,
      orgId,
    );
  }

  @Mutation(() => Contact)
  removeContact(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.remove(id, user.id, orgId);
  }

  @Mutation(() => InviteContactResponse)
  inviteContactToPlatform(
    @Args('contactId', { type: () => ID }) contactId: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.inviteContactToPlatform(
      contactId,
      user.id,
      orgId,
    );
  }

  @Mutation(() => InviteContactResponse)
  resendContactInvitation(
    @Args('contactId', { type: () => ID }) contactId: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.resendContactInvitation(
      contactId,
      user.id,
      orgId,
    );
  }

  @Query(() => ContactPlatformStatus)
  checkContactOnPlatform(
    @Args('contactId', { type: () => ID }) contactId: string,
    @CurrentUser() user: User,
    @ActiveOrg() orgId: string | null,
  ) {
    return this.contactsService.checkContactOnPlatform(
      contactId,
      user.id,
      undefined,
      orgId,
    );
  }
}
