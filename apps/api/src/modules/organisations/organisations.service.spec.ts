import { Test } from '@nestjs/testing';
import { OrganisationsService } from './organisations.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole } from '../../generated/prisma/client';

describe('OrganisationsService', () => {
  let service: OrganisationsService;
  let prisma: {
    organisation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    organisationMember: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    contact: { create: jest.Mock; findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      organisation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      organisationMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      contact: { create: jest.fn(), findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrganisationsService);
  });

  describe('create', () => {
    it('creates an org and sets creator as ADMIN', async () => {
      const org = { id: 'org1', name: 'Akanors', slug: 'akanors' };
      prisma.organisation.findUnique.mockResolvedValue(null); // slug not taken
      prisma.organisation.create.mockResolvedValue(org);
      prisma.organisationMember.create.mockResolvedValue({});

      const result = await service.create({ name: 'Akanors' }, 'user1');

      expect(prisma.organisation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'akanors' }),
        }),
      );
      expect(prisma.organisationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: OrgRole.ADMIN,
            userId: 'user1',
          }),
        }),
      );
      expect(result).toEqual(org);
    });

    it('appends a suffix when slug is already taken', async () => {
      prisma.organisation.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // 'akanors' taken
        .mockResolvedValueOnce(null); // 'akanors-2' free
      prisma.organisation.create.mockResolvedValue({
        id: 'org1',
        slug: 'akanors-2',
      });
      prisma.organisationMember.create.mockResolvedValue({});

      const result = await service.create({ name: 'Akanors' }, 'user1');
      expect(result.slug).toBe('akanors-2');
    });
  });

  describe('findBySlug', () => {
    const orgWithMembers = {
      id: 'org1',
      slug: 'akanors',
      members: [{ id: 'mem1', userId: 'user1', role: OrgRole.ADMIN, user: {} }],
      subscription: null,
    };

    it('returns the org when the requester is a member', async () => {
      prisma.organisation.findUnique.mockResolvedValue(orgWithMembers);
      const result = await service.findBySlug('akanors', 'user1');
      expect(result).toEqual(orgWithMembers);
    });

    it('throws NotFoundException when the org does not exist', async () => {
      prisma.organisation.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('unknown', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the requester is not a member', async () => {
      prisma.organisation.findUnique.mockResolvedValue(orgWithMembers);
      await expect(service.findBySlug('akanors', 'outsider')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('inviteMember', () => {
    it('throws NotFoundException when user email is not found', async () => {
      prisma.organisationMember.findUnique.mockResolvedValueOnce({
        id: 'admin-mem',
        role: OrgRole.ADMIN,
      }); // assertAdmin passes
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.inviteMember(
          'org1',
          { email: 'nobody@test.com', role: OrgRole.OPERATOR },
          'admin1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when user is already a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      prisma.organisationMember.findUnique
        .mockResolvedValueOnce({ id: 'existing-admin', role: OrgRole.ADMIN }) // assertAdmin check
        .mockResolvedValueOnce({ id: 'existing-member' }); // already member check
      await expect(
        service.inviteMember(
          'org1',
          { email: 'existing@test.com', role: OrgRole.OPERATOR },
          'admin1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the member when everything is valid', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      prisma.organisationMember.findUnique
        .mockResolvedValueOnce({ role: OrgRole.ADMIN }) // assertAdmin: admin1 is ADMIN
        .mockResolvedValueOnce(null); // u2 not yet a member
      prisma.organisationMember.create.mockResolvedValue({
        id: 'mem1',
        role: OrgRole.OPERATOR,
      });

      const result = await service.inviteMember(
        'org1',
        { email: 'new@test.com', role: OrgRole.OPERATOR },
        'admin1',
      );
      expect(result.role).toBe(OrgRole.OPERATOR);
    });
  });

  describe('promoteContactToOrg', () => {
    it('creates a new org-scoped contact from a personal contact, carrying linkedUserId and sourceContactId', async () => {
      prisma.organisationMember.findUnique.mockResolvedValueOnce({
        id: 'mem1',
        role: OrgRole.OPERATOR,
      }); // membership check passes
      prisma.contact.findUnique
        .mockResolvedValueOnce({
          id: 'c1',
          firstName: 'Ali',
          lastName: 'B',
          email: 'ali@b.com',
          phoneNumber: null,
          userId: 'user1',
          orgId: null,
          linkedUserId: 'linked-user-1',
        }) // fetch the contact being shared
        .mockResolvedValueOnce(null); // dedupe check: no existing copy yet
      prisma.contact.create.mockResolvedValue({ id: 'c2', orgId: 'org1' });

      const result = await service.promoteContactToOrg('c1', 'org1', 'user1');
      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org1',
            firstName: 'Ali',
            linkedUserId: 'linked-user-1',
            sourceContactId: 'c1',
          }),
        }),
      );
      expect(result.orgId).toBe('org1');
    });

    it('returns the existing org copy instead of creating a second one when re-promoted', async () => {
      prisma.organisationMember.findUnique.mockResolvedValueOnce({
        id: 'mem1',
        role: OrgRole.OPERATOR,
      });
      const existingCopy = { id: 'c2', orgId: 'org1', sourceContactId: 'c1' };
      prisma.contact.findUnique
        .mockResolvedValueOnce({
          id: 'c1',
          firstName: 'Ali',
          lastName: 'B',
          userId: 'user1',
          orgId: null,
        })
        .mockResolvedValueOnce(existingCopy); // dedupe check finds the prior copy

      const result = await service.promoteContactToOrg('c1', 'org1', 'user1');
      expect(prisma.contact.create).not.toHaveBeenCalled();
      expect(result).toBe(existingCopy);
    });

    it('throws BadRequestException when the contact already belongs to an organisation', async () => {
      prisma.organisationMember.findUnique.mockResolvedValueOnce({
        id: 'mem1',
        role: OrgRole.OPERATOR,
      });
      prisma.contact.findUnique.mockResolvedValueOnce({
        id: 'c1',
        userId: 'user1',
        orgId: 'other-org',
      });
      await expect(
        service.promoteContactToOrg('c1', 'org1', 'user1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.contact.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when contact does not belong to user', async () => {
      prisma.organisationMember.findUnique.mockResolvedValueOnce({
        id: 'mem1',
        role: OrgRole.OPERATOR,
      }); // membership check passes
      prisma.contact.findUnique.mockResolvedValueOnce({
        id: 'c1',
        userId: 'other',
        orgId: null,
      });
      await expect(
        service.promoteContactToOrg('c1', 'org1', 'user1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when caller is not a member of the org', async () => {
      prisma.organisationMember.findUnique.mockResolvedValue(null); // not a member
      await expect(
        service.promoteContactToOrg('c1', 'org1', 'user1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
