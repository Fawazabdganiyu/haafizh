import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganisationInput } from './dto/create-organisation.input';
import { UpdateOrganisationInput } from './dto/update-organisation.input';
import { InviteMemberInput } from './dto/invite-member.input';
import { OrgRole } from '../../generated/prisma/client';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrganisationInput, userId: string) {
    const baseSlug = toSlug(input.name);
    const slug = await this.uniqueSlug(baseSlug);

    const org = await this.prisma.organisation.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        industry: input.industry,
      },
    });

    await this.prisma.organisationMember.create({
      data: { orgId: org.id, userId, role: OrgRole.ADMIN },
    });

    return org;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 2;
    while (await this.prisma.organisation.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async findById(id: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id },
      include: { members: { include: { user: true } }, subscription: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');
    return org;
  }

  async findBySlug(slug: string, requesterId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { slug },
      include: { members: { include: { user: true } }, subscription: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');

    // Only members can see full org details
    const isMember = org.members.some((m) => m.userId === requesterId);
    if (!isMember)
      throw new ForbiddenException('You are not a member of this organisation');

    return org;
  }

  async findUserOrgs(userId: string) {
    return this.prisma.organisation.findMany({
      where: { members: { some: { userId } } },
      include: { subscription: true },
    });
  }

  async getOrgMembers(orgId: string) {
    return this.prisma.organisationMember.findMany({
      where: { orgId },
      include: { user: true },
    });
  }

  async update(id: string, input: UpdateOrganisationInput, userId: string) {
    await this.assertAdmin(id, userId);
    return this.prisma.organisation.update({ where: { id }, data: input });
  }

  async inviteMember(
    orgId: string,
    input: InviteMemberInput,
    requesterId: string,
  ) {
    await this.assertAdmin(orgId, requesterId);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user)
      throw new NotFoundException('No Wathīqah account found for that email');

    const existing = await this.prisma.organisationMember.findUnique({
      where: { orgId_userId: { orgId, userId: user.id } },
    });
    if (existing) throw new ConflictException('User is already a member');

    return this.prisma.organisationMember.create({
      data: { orgId, userId: user.id, role: input.role },
    });
  }

  async updateMemberRole(memberId: string, role: OrgRole, requesterId: string) {
    const member = await this.prisma.organisationMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.assertAdmin(member.orgId, requesterId);
    return this.prisma.organisationMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  async removeMember(memberId: string, requesterId: string) {
    const member = await this.prisma.organisationMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException('Member not found');
    await this.assertAdmin(member.orgId, requesterId);
    await this.prisma.organisationMember.delete({ where: { id: memberId } });
    return true;
  }

  /**
   * Shares a personal contact into an org: creates (or returns an existing)
   * org-owned copy linked back to the original via sourceContactId. Other
   * org members can then select, transact against, and see this copy as a
   * normal org contact (contacts.service.ts assertContactAccess grants
   * access by org membership, not by who shared it in). The personal
   * ledger/standing on the original contact is never touched — only a
   * `recordOnPersonalLedger`-flagged transaction (transactions.service.ts)
   * writes a real, separate row back onto it.
   */
  async promoteContactToOrg(contactId: string, orgId: string, userId: string) {
    // Verify caller is a member of the target org
    const membership = await this.prisma.organisationMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!membership)
      throw new ForbiddenException(
        'You do not have permission to access this organisation',
      );

    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.orgId)
      throw new BadRequestException(
        'This contact already belongs to an organisation and cannot be shared again',
      );
    if (contact.userId !== userId)
      throw new ForbiddenException(
        'You do not have permission to access this contact',
      );

    const existing = await this.prisma.contact.findUnique({
      where: { orgId_sourceContactId: { orgId, sourceContactId: contactId } },
    });
    if (existing) return existing;

    return this.prisma.contact.create({
      data: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email ?? undefined,
        phoneNumber: contact.phoneNumber ?? undefined,
        linkedUserId: contact.linkedUserId ?? undefined,
        userId,
        orgId,
        sourceContactId: contactId,
      },
    });
  }

  private async assertAdmin(orgId: string, userId: string) {
    const member = await this.prisma.organisationMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!member || member.role !== OrgRole.ADMIN) {
      throw new ForbiddenException('Only org admins can perform this action');
    }
  }
}
