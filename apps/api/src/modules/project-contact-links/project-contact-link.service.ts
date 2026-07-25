import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ProjectTransactionsService } from '../projects/project-transactions.service';
import { CreateTransactionInput } from '../transactions/dto/create-transaction.input';
import { UpdateTransactionInput } from '../transactions/dto/update-transaction.input';
import { LogProjectTransactionInput } from '../projects/dto/log-project-transaction.input';
import { UpdateProjectTransactionInput } from '../projects/dto/update-project-transaction.input';
import {
  AssetCategory,
  ProjectTransactionType,
  TransactionType,
  Prisma,
  Contact,
  Project,
} from '../../generated/prisma/client';
import {
  PROJECT_INCOME_CONTACT_TRANSACTION_TYPES,
  PROJECT_EXPENSE_CONTACT_TRANSACTION_TYPES,
  MANDATORY_PARENT_CONTACT_TRANSACTION_TYPES,
} from '@wathiqah/shared-constants';

// Widened from the shared `readonly string[]` source of truth so callers can
// still pass a `TransactionType` to `.includes()` without a cast.
const INCOME_CONTACT_TYPES: readonly string[] =
  PROJECT_INCOME_CONTACT_TRANSACTION_TYPES;
const EXPENSE_CONTACT_TYPES: readonly string[] =
  PROJECT_EXPENSE_CONTACT_TRANSACTION_TYPES;

/** Must reference a parent loan/escrow — mirrors TransactionsService.createWithClient's "else if (isRepayment/isRemittance) throw" rule. */
const MANDATORY_PARENT_TYPES: readonly string[] =
  MANDATORY_PARENT_CONTACT_TRANSACTION_TYPES;

/** May optionally reference a parent loan (a partial gift-conversion) but a standalone gift is also valid. */
const OPTIONAL_PARENT_TYPES: TransactionType[] = [
  TransactionType.GIFT_GIVEN,
  TransactionType.GIFT_RECEIVED,
];

interface ValidateLinkParams {
  userId: string;
  project: Pick<Project, 'id' | 'userId' | 'orgId'>;
  contact: Pick<Contact, 'id' | 'userId' | 'orgId'>;
  contactTransactionType: TransactionType;
  projectTransactionType: ProjectTransactionType;
  parentTransactionId?: string;
  /** Only true for the project-origin path — its "which loan" picker is scoped to this project. */
  requireSameProjectParent: boolean;
}

/**
 * Orchestrates creating/updating/removing a linked (Transaction, ProjectTransaction)
 * pair from either direction. Sits above TransactionsModule and ProjectsModule so
 * neither of those services needs to depend on the other — see the "why a new
 * orchestration module" note in the approved plan for the circular-dependency
 * rationale.
 */
@Injectable()
export class ProjectContactLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly projectTransactionsService: ProjectTransactionsService,
  ) {}

  /** Shared guard: `type` determines cash-flow direction on both sides of a
   * link, so it's immutable once either side is linked — used by both
   * updateProjectOriginated (ProjectTransactionType) and
   * updateContactOriginated (TransactionType). */
  private assertTypeUnchanged<
    T extends TransactionType | ProjectTransactionType,
  >(
    existingType: T,
    newType: T | undefined,
    linkedToLabel: 'a contact' | 'a project',
  ): void {
    if (newType !== undefined && newType !== existingType) {
      throw new BadRequestException(
        `Cannot change transaction type once linked to ${linkedToLabel}`,
      );
    }
  }

  private deriveProjectDirection(
    contactTransactionType: TransactionType,
  ): ProjectTransactionType {
    if (INCOME_CONTACT_TYPES.includes(contactTransactionType)) {
      return ProjectTransactionType.INCOME;
    }
    if (EXPENSE_CONTACT_TYPES.includes(contactTransactionType)) {
      return ProjectTransactionType.EXPENSE;
    }
    // Neither list matches — e.g. a legacy EXPENSE/INCOME TransactionType
    // still present on old rows. Fail loudly instead of silently defaulting
    // to EXPENSE, which would misclassify the project-balance direction.
    throw new BadRequestException(
      `${contactTransactionType} cannot be linked to a project`,
    );
  }

  private async validateLink(
    prisma: Prisma.TransactionClient | PrismaService,
    params: ValidateLinkParams,
  ): Promise<void> {
    const {
      userId,
      project,
      contact,
      contactTransactionType,
      projectTransactionType,
      parentTransactionId,
      requireSameProjectParent,
    } = params;

    // 1. Direction consistency — reuses deriveProjectDirection so the
    // pairing is defined once, not re-derived here as a second code path.
    if (
      this.deriveProjectDirection(contactTransactionType) !==
      projectTransactionType
    ) {
      throw new BadRequestException(
        `${contactTransactionType} is not valid for a ${projectTransactionType} project transaction`,
      );
    }

    // 2. Project ownership (obscuring existence, matching existing convention)
    if (project.userId !== userId) {
      throw new NotFoundException(`Project with ID ${project.id} not found`);
    }

    // 3. Contact ownership
    if (contact.userId !== userId) {
      throw new ForbiddenException('Cannot link a contact you do not own');
    }

    // 4. Tenant match
    if (contact.orgId !== project.orgId) {
      throw new BadRequestException(
        'Contact must belong to the same organisation as the project',
      );
    }

    // 5. Parent requirement
    const requiresParent = MANDATORY_PARENT_TYPES.includes(
      contactTransactionType,
    );
    const allowsParent =
      requiresParent || OPTIONAL_PARENT_TYPES.includes(contactTransactionType);
    if (requiresParent && !parentTransactionId) {
      throw new BadRequestException(
        `${contactTransactionType} requires parentTransactionId`,
      );
    }
    if (!allowsParent && parentTransactionId) {
      throw new BadRequestException(
        'parentTransactionId is only valid for repayment, remittance, or gift-conversion contact transaction types',
      );
    }

    if (parentTransactionId) {
      const parent = await prisma.transaction.findUnique({
        where: { id: parentTransactionId },
        include: { projectTransaction: true },
      });
      if (!parent) {
        throw new NotFoundException(
          `Transaction with ID ${parentTransactionId} not found`,
        );
      }
      if (
        requireSameProjectParent &&
        parent.projectTransaction?.projectId !== project.id
      ) {
        throw new BadRequestException(
          'The selected loan must have originated from this same project',
        );
      }
    }
  }

  private buildMirrorTransactionInput(params: {
    amount: number;
    contactTransactionType: TransactionType;
    currency: string;
    date?: Date;
    description?: string;
    projectName: string;
    contactId: string;
    parentTransactionId?: string;
  }): CreateTransactionInput {
    const {
      amount,
      contactTransactionType,
      currency,
      date,
      description,
      projectName,
      contactId,
      parentTransactionId,
    } = params;

    return {
      category: AssetCategory.FUNDS,
      amount,
      type: contactTransactionType,
      currency,
      date: date ?? new Date(),
      description: description
        ? `${description} (Project: ${projectName})`
        : `Project: ${projectName}`,
      contactId,
      parentId: parentTransactionId,
    } as CreateTransactionInput;
  }

  private buildMirrorProjectTransactionInput(params: {
    projectId: string;
    amount: number;
    projectTransactionType: ProjectTransactionType;
    date?: Date;
    description?: string;
    contactName: string;
    contactId: string;
    contactTransactionType: TransactionType;
  }): LogProjectTransactionInput {
    const {
      projectId,
      amount,
      projectTransactionType,
      date,
      description,
      contactName,
      contactId,
      contactTransactionType,
    } = params;

    return {
      projectId,
      amount,
      type: projectTransactionType,
      date,
      description: description
        ? `${description} (Contact: ${contactName})`
        : `Contact: ${contactName}`,
      contactId,
      contactTransactionType,
    } as LogProjectTransactionInput;
  }

  /** Used by ProjectsResolver.logProjectTransaction */
  async createProjectOriginated(
    userId: string,
    input: LogProjectTransactionInput,
  ) {
    const { contactId, contactTransactionType, parentTransactionId } = input;

    if (!contactId && !contactTransactionType) {
      return this.projectTransactionsService.create(userId, input);
    }
    if (!!contactId !== !!contactTransactionType) {
      throw new BadRequestException(
        'contactId and contactTransactionType must be provided together',
      );
    }

    const [project, contact] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: input.projectId } }),
      this.prisma.contact.findUnique({ where: { id: contactId } }),
    ]);
    if (!project || project.userId !== userId) {
      throw new NotFoundException(
        `Project with ID ${input.projectId} not found`,
      );
    }
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    let notifications: Awaited<
      ReturnType<ProjectTransactionsService['createWithClient']>
    >['notifications'] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const txClient = tx as Prisma.TransactionClient;

      await this.validateLink(txClient, {
        userId,
        project,
        contact,
        contactTransactionType: contactTransactionType!,
        projectTransactionType: input.type,
        parentTransactionId,
        requireSameProjectParent: true,
      });

      const ptResult = await this.projectTransactionsService.createWithClient(
        txClient,
        input,
      );
      notifications = ptResult.notifications;

      const mirrorInput = this.buildMirrorTransactionInput({
        amount: input.amount,
        contactTransactionType: contactTransactionType!,
        currency: project.currency,
        date: input.date,
        description: input.description,
        projectName: project.name,
        contactId: contactId!,
        parentTransactionId,
      });

      await this.transactionsService.createWithClient(
        txClient,
        mirrorInput,
        userId,
        project.orgId,
        {
          projectTransactionId: ptResult.transaction.id,
          isMirroredFromProject: true,
        },
      );

      return ptResult.transaction;
    });

    await this.projectTransactionsService.notifyWitnesses(notifications);

    return result;
  }

  /** Used by TransactionsResolver.createTransaction */
  async createContactOriginated(
    userId: string,
    input: CreateTransactionInput,
    orgId: string | null,
  ) {
    const { projectId } = input;

    if (!projectId) {
      return this.transactionsService.create(input, userId, orgId);
    }
    if (input.category === AssetCategory.ITEM) {
      throw new BadRequestException(
        'Only funds transactions can be linked to a project',
      );
    }
    if (!input.contactId) {
      throw new BadRequestException(
        'A project link requires a contact — this transaction has no contactId',
      );
    }

    const [project, contact] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.contact.findUnique({ where: { id: input.contactId } }),
    ]);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (!contact) {
      throw new NotFoundException(
        `Contact with ID ${input.contactId} not found`,
      );
    }

    const projectTransactionType = this.deriveProjectDirection(input.type);

    let notifications: Awaited<
      ReturnType<TransactionsService['createWithClient']>
    >['notifications'] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const txClient = tx as Prisma.TransactionClient;

      await this.validateLink(txClient, {
        userId,
        project,
        contact,
        contactTransactionType: input.type,
        projectTransactionType,
        parentTransactionId: input.parentId,
        requireSameProjectParent: false,
      });

      const txResult = await this.transactionsService.createWithClient(
        txClient,
        input,
        userId,
        orgId,
      );
      notifications = txResult.notifications;

      const mirrorProjectInput = this.buildMirrorProjectTransactionInput({
        projectId,
        amount: input.amount!,
        projectTransactionType,
        date: input.date,
        description: input.description,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactId: input.contactId!,
        contactTransactionType: input.type,
      });

      const ptResult = await this.projectTransactionsService.createWithClient(
        txClient,
        mirrorProjectInput,
        { isMirroredFromContact: true },
      );

      // The FK lives on Transaction, and the ProjectTransaction mirror didn't
      // exist yet when the Transaction row above was created — link it now.
      // Return this (not the pre-link txResult.transaction) so the mutation
      // response reflects projectTransactionId immediately, not just after a refetch.
      return txClient.transaction.update({
        where: { id: txResult.transaction.id },
        data: { projectTransactionId: ptResult.transaction.id },
      });
    });

    await this.transactionsService
      .notifyWitnesses(notifications)
      .catch((err) => {
        console.error('Failed to send witness notifications:', err);
      });

    return result;
  }

  /** Used by ProjectsResolver.updateProjectTransaction */
  async updateProjectOriginated(
    userId: string,
    input: UpdateProjectTransactionInput,
  ) {
    const { contactId, contactTransactionType, parentTransactionId } = input;

    const existing = await this.prisma.projectTransaction.findUnique({
      where: { id: input.id },
      include: { project: true, transaction: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Project transaction with ID ${input.id} not found`,
      );
    }
    if (existing.project.userId !== userId) {
      // Obscures existence for non-owners, matching validateLink's convention.
      throw new NotFoundException(
        `Project transaction with ID ${input.id} not found`,
      );
    }

    const isAlreadyLinked = !!existing.contactId;

    // Only a genuinely unlinked row (no existing link, and no link fields in
    // this request) can take the plain-update shortcut. Checking isAlreadyLinked
    // BEFORE this shortcut matters: the frontend never resends contactId/
    // contactTransactionType once a row is already linked (they're immutable,
    // rendered read-only), so a plain amount edit on an already-linked row
    // arrives with both fields absent — the same shape as a never-linked row.
    // Without the isAlreadyLinked check, every real amount edit to an
    // already-linked project transaction would silently skip the mirror sync
    // below.
    if (!isAlreadyLinked && !contactId && !contactTransactionType) {
      return this.projectTransactionsService.update(userId, input);
    }

    if (isAlreadyLinked) {
      if (contactId !== undefined && contactId !== existing.contactId) {
        throw new BadRequestException(
          'Contact link cannot be changed once set',
        );
      }
      if (
        contactTransactionType !== undefined &&
        contactTransactionType !== existing.contactTransactionType
      ) {
        throw new BadRequestException(
          'Contact transaction type cannot be changed once linked',
        );
      }
      this.assertTypeUnchanged(existing.type, input.type, 'a contact');

      // Already linked — only an amount edit can reach here (no retroactive
      // link work needed); delegate to the plain update + sync the mirror.
      const updateResult = await this.prisma.$transaction(async (tx) => {
        const txClient = tx as Prisma.TransactionClient;
        const result = await this.projectTransactionsService.updateWithClient(
          txClient,
          userId,
          input,
        );
        if (result.amountChanged && existing.transaction) {
          await this.transactionsService.syncMirroredAmount(
            txClient,
            existing.transaction.id,
            result.newAmount,
            userId,
          );
        }
        return result.transaction;
      });
      return updateResult;
    }

    // Retroactive linking
    if (!!contactId !== !!contactTransactionType) {
      throw new BadRequestException(
        'contactId and contactTransactionType must be provided together',
      );
    }

    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    let mirrorNotifications: Awaited<
      ReturnType<TransactionsService['createWithClient']>
    >['notifications'] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      const txClient = tx as Prisma.TransactionClient;

      await this.validateLink(txClient, {
        userId,
        project: existing.project,
        contact,
        contactTransactionType: contactTransactionType!,
        projectTransactionType: input.type ?? existing.type,
        parentTransactionId,
        requireSameProjectParent: true,
      });

      const ptResult = await this.projectTransactionsService.updateWithClient(
        txClient,
        userId,
        input,
        { contactId, contactTransactionType },
      );

      const newAmount =
        input.amount !== undefined ? input.amount : Number(existing.amount);

      const mirrorInput = this.buildMirrorTransactionInput({
        amount: newAmount,
        contactTransactionType: contactTransactionType!,
        currency: existing.project.currency,
        date: input.date ?? existing.date,
        description: input.description ?? existing.description ?? undefined,
        projectName: existing.project.name,
        contactId: contactId!,
        parentTransactionId,
      });

      const txResult = await this.transactionsService.createWithClient(
        txClient,
        mirrorInput,
        userId,
        existing.project.orgId,
        { projectTransactionId: input.id, isMirroredFromProject: true },
      );
      mirrorNotifications = txResult.notifications;

      return ptResult.transaction;
    });

    // Fired after commit — never hold DB locks open for the duration of
    // outbound email/SMS/Redis calls (matches every other create/update path).
    await this.transactionsService
      .notifyWitnesses(mirrorNotifications)
      .catch((err) => {
        console.error('Failed to send witness notifications:', err);
      });

    return result;
  }

  /**
   * Used by TransactionsResolver.updateTransaction for retroactive project
   * linking. Documented trade-off (see approved plan §4): runs as two
   * sequential transactions rather than one atomic transaction, since
   * TransactionsService.update() has pre-transaction side effects (witness
   * notification fetch) that make a clean tx-composable extraction riskier
   * for this pass. Every other path in this feature is fully atomic.
   */
  async updateContactOriginated(
    userId: string,
    input: UpdateTransactionInput,
    orgId: string | null = null,
  ) {
    const { projectId } = input;
    const existing = await this.transactionsService.findOne(
      input.id,
      userId,
      orgId,
    );

    if (existing.projectTransactionId) {
      // Already linked. The frontend always resends the current (locked)
      // projectId on every edit, so only reject when the caller is actually
      // trying to point it at a DIFFERENT project — a same-value resend is a
      // no-op, not an attempted change, and every other field must remain
      // editable.
      if (projectId !== undefined) {
        const currentMirror = await this.prisma.projectTransaction.findUnique({
          where: { id: existing.projectTransactionId },
          select: { projectId: true },
        });
        if (currentMirror?.projectId !== projectId) {
          throw new BadRequestException(
            'Project link cannot be changed once set',
          );
        }
      }

      // Changing `type` across the INCOME/EXPENSE boundary would silently
      // desync the mirrored ProjectTransaction's direction — block it.
      this.assertTypeUnchanged(existing.type, input.type, 'a project');

      const updated = await this.transactionsService.update(
        input.id,
        input,
        userId,
        orgId,
      );

      // Keep the mirrored ProjectTransaction's amount and project.balance in
      // sync. Runs as its own transaction, sequential with the update above
      // — the same documented trade-off as the retroactive-link path below,
      // since transactionsService.update() opens its own transaction and
      // isn't composable with an external client.
      if (
        input.amount !== undefined &&
        Number(input.amount) !== Number(existing.amount)
      ) {
        await this.prisma.$transaction((tx) =>
          this.projectTransactionsService.syncMirroredAmount(
            tx as Prisma.TransactionClient,
            existing.projectTransactionId!,
            Number(input.amount),
            userId,
          ),
        );
      }

      return updated;
    }

    if (!projectId) {
      return this.transactionsService.update(input.id, input, userId, orgId);
    }

    if (!existing.contactId) {
      throw new BadRequestException(
        'A project link requires a contact — this transaction has no contactId',
      );
    }

    // Matches the equivalent guard in createContactOriginated — ProjectTransaction
    // is funds-only, so an ITEM-category transaction can't be linked.
    if (existing.category === AssetCategory.ITEM) {
      throw new BadRequestException(
        'Only funds transactions can be linked to a project',
      );
    }

    const [project, contact] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.contact.findUnique({ where: { id: existing.contactId } }),
    ]);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (!contact) {
      throw new NotFoundException(
        `Contact with ID ${existing.contactId} not found`,
      );
    }

    const effectiveType = input.type ?? existing.type;
    const projectTransactionType = this.deriveProjectDirection(effectiveType);

    // Read-only checks against a live PrismaService connection are fine here —
    // this call makes no writes, so no transaction-scoped client is needed.
    await this.validateLink(this.prisma, {
      userId,
      project,
      contact,
      contactTransactionType: effectiveType,
      projectTransactionType,
      parentTransactionId: input.parentId ?? existing.parentId ?? undefined,
      requireSameProjectParent: false,
    });

    // Step 1: unchanged, existing update path (its own atomic transaction).
    await this.transactionsService.update(input.id, input, userId, orgId);

    // Step 2: separate transaction creating the mirror + linking back.
    // Documented trade-off (see approved plan §4): not atomic with Step 1.
    const effectiveAmount =
      input.amount !== undefined ? input.amount : Number(existing.amount);

    const linked = await this.prisma.$transaction(async (tx) => {
      const txClient = tx as Prisma.TransactionClient;
      const mirrorProjectInput = this.buildMirrorProjectTransactionInput({
        projectId,
        amount: effectiveAmount,
        projectTransactionType,
        date: input.date ?? existing.date,
        description: input.description ?? existing.description ?? undefined,
        contactName: `${contact.firstName} ${contact.lastName}`,
        contactId: existing.contactId!,
        contactTransactionType: effectiveType,
      });

      const ptResult = await this.projectTransactionsService.createWithClient(
        txClient,
        mirrorProjectInput,
        { isMirroredFromContact: true },
      );

      // Return the post-link row (not Step 1's pre-link result) so the
      // mutation response reflects projectTransactionId immediately.
      return txClient.transaction.update({
        where: { id: input.id },
        data: { projectTransactionId: ptResult.transaction.id },
      });
    });

    return linked;
  }

  /** Used by ProjectsResolver.removeProjectTransaction */
  async removeProjectOriginated(userId: string, id: string) {
    const existing = await this.prisma.projectTransaction.findUnique({
      where: { id },
      include: {
        project: true,
        transaction: { include: { witnesses: true, conversions: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(
        `Project transaction with ID ${id} not found`,
      );
    }

    if (!existing.transaction) {
      return this.projectTransactionsService.remove(userId, id);
    }

    if (existing.project.userId !== userId) {
      throw new ForbiddenException(
        'Only the project owner can delete this transaction',
      );
    }

    // This ProjectTransaction is itself the passive mirror of a real,
    // contact-originated Transaction — existing.transaction is the
    // authoritative record, not a disposable copy. Fail fast here instead of
    // relying on removeWithClient's own guard (further below, in the same
    // transaction) to force a rollback after deleteMirroredTransaction has
    // already been asked to delete the real row.
    if (existing.isMirroredFromContact) {
      throw new BadRequestException(
        'This entry was synced from your contact ledger. Delete it from the contact page instead.',
      );
    }

    if (existing.transaction.witnesses.length > 0) {
      throw new ForbiddenException(
        'The linked contact transaction has witnesses and cannot be deleted.',
      );
    }
    if (existing.transaction.conversions.length > 0) {
      throw new ForbiddenException(
        'The linked contact transaction has repayment history recorded against it and cannot be deleted.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const txClient = tx as Prisma.TransactionClient;
      await this.transactionsService.deleteMirroredTransaction(
        txClient,
        existing.transaction!.id,
        userId,
      );
      return this.projectTransactionsService.removeWithClient(
        txClient,
        userId,
        id,
      );
    });
  }
}
