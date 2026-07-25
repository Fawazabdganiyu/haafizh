/**
 * Minimal in-memory Prisma double for the personal-mirror ledger scenario
 * eval (personal-mirror-scenario.spec.ts). Real, not mocked-per-call: state
 * written by one service call (e.g. ContactsService.create) is actually read
 * back by the next (TransactionsService.create, then ContactsService.getBalance),
 * which is the whole point of a cross-service scenario test — per-call jest
 * mocks can't prove the pieces agree with each other once wired together.
 *
 * Implements only the subset of the Prisma Client surface the three services
 * exercised by the scenario (ContactsService, OrganisationsService,
 * TransactionsService) actually call. Not a general-purpose fake — extend
 * deliberately if a new query shape is needed, don't paper over gaps with a
 * permissive default.
 */

type Row = Record<string, unknown>;

function matchesCondition(rowValue: unknown, condition: unknown): boolean {
  if (condition === null || typeof condition !== 'object') {
    return rowValue === condition;
  }
  const cond = condition as Record<string, unknown>;
  if ('not' in cond) return rowValue !== cond.not;
  if ('in' in cond) return (cond.in as unknown[]).includes(rowValue);
  // Unsupported nested operator — fail loudly rather than silently matching
  // everything, so a future query shape gets an explicit fake-Prisma update
  // instead of a scenario that quietly proves nothing.
  throw new Error(
    `fake-prisma: unsupported where operator ${JSON.stringify(cond)}`,
  );
}

export class FakePrisma {
  contacts = new Map<string, Row>();
  transactions = new Map<string, Row>();
  members = new Map<string, Row>(); // key: `${orgId}:${userId}`
  users = new Map<string, Row>();
  private nextId = 1;

  private genId(prefix: string): string {
    return `${prefix}-${this.nextId++}`;
  }

  private matchesTransactionWhere(row: Row, where: Row | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') {
        return (condition as Row[]).some((clause) =>
          this.matchesTransactionWhere(row, clause),
        );
      }
      if (key === 'AND') {
        return (condition as Row[]).every((clause) =>
          this.matchesTransactionWhere(row, clause),
        );
      }
      if (key === 'contact') {
        const contact = row.contactId
          ? this.contacts.get(row.contactId as string)
          : null;
        return this.matchesContactWhere(contact ?? {}, condition as Row);
      }
      return matchesCondition(row[key], condition);
    });
  }

  private matchesContactWhere(row: Row, where: Row | undefined): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'derivedContacts') {
        const cond = condition as { none?: Row };
        if (!cond.none) {
          throw new Error(
            'fake-prisma: only derivedContacts.none is supported',
          );
        }
        const hasDerived = [...this.contacts.values()].some(
          (c) =>
            c.sourceContactId === row.id &&
            this.matchesContactWhere(c, cond.none),
        );
        return !hasDerived;
      }
      return matchesCondition(row[key], condition);
    });
  }

  contact = {
    create: async ({ data }: { data: Row }) => {
      const id = this.genId('contact');
      const row: Row = { linkedUserId: null, orgId: null, ...data, id };
      this.contacts.set(id, row);
      return row;
    },
    findUnique: async ({
      where,
    }: {
      where: {
        id?: string;
        orgId_sourceContactId?: { orgId: string; sourceContactId: string };
      };
      select?: Row;
    }) => {
      if (where.id) return this.contacts.get(where.id) ?? null;
      if (where.orgId_sourceContactId) {
        const { orgId, sourceContactId } = where.orgId_sourceContactId;
        return (
          [...this.contacts.values()].find(
            (c) => c.orgId === orgId && c.sourceContactId === sourceContactId,
          ) ?? null
        );
      }
      throw new Error(
        `fake-prisma: unsupported contact.findUnique where ${JSON.stringify(where)}`,
      );
    },
    findMany: async ({ where }: { where?: Row }) =>
      [...this.contacts.values()].filter((c) =>
        this.matchesContactWhere(c, where),
      ),
    count: async ({ where }: { where?: Row }) =>
      (await this.contact.findMany({ where })).length,
  };

  transaction = {
    create: async ({ data }: { data: Row }) => {
      const id = this.genId('tx');
      const row: Row = { status: 'COMPLETED', ...data, id };
      this.transactions.set(id, row);
      return row;
    },
    findUnique: async ({
      where,
      include,
    }: {
      where: { id?: string; orgSourceTransactionId?: string };
      include?: Row;
      select?: Row;
    }) => {
      let row: Row | null = null;
      if (where.id) row = this.transactions.get(where.id) ?? null;
      else if (where.orgSourceTransactionId) {
        row =
          [...this.transactions.values()].find(
            (t) => t.orgSourceTransactionId === where.orgSourceTransactionId,
          ) ?? null;
      } else {
        throw new Error(
          `fake-prisma: unsupported transaction.findUnique where ${JSON.stringify(where)}`,
        );
      }
      if (!row) return null;
      if (include?.createdBy) {
        row = { ...row, createdBy: this.users.get(row.createdById as string) };
      }
      if (include?.contact) {
        row = {
          ...row,
          contact: row.contactId
            ? this.contacts.get(row.contactId as string)
            : null,
        };
      }
      return row;
    },
    findMany: async ({ where }: { where?: Row }) =>
      [...this.transactions.values()].filter((t) =>
        this.matchesTransactionWhere(t, where),
      ),
    count: async ({ where }: { where?: Row }) =>
      (await this.transaction.findMany({ where })).length,
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = this.transactions.get(where.id);
      if (!row) throw new Error(`fake-prisma: no transaction ${where.id}`);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const row = this.transactions.get(where.id);
      this.transactions.delete(where.id);
      return row;
    },
    groupBy: async ({
      where,
      by,
    }: {
      where: Row;
      by: string[];
      _sum: { amount: true };
    }) => {
      const rows = await this.transaction.findMany({ where });
      const groups = new Map<string, { key: Row; sum: number }>();
      for (const row of rows) {
        const keyObj = Object.fromEntries(by.map((k) => [k, row[k]]));
        const key = JSON.stringify(keyObj);
        const existing = groups.get(key) ?? { key: keyObj, sum: 0 };
        existing.sum += Number(row.amount) || 0;
        groups.set(key, existing);
      }
      return [...groups.values()].map((g) => ({
        ...g.key,
        _sum: { amount: g.sum },
      }));
    },
  };

  organisationMember = {
    findUnique: async ({
      where,
    }: {
      where: { orgId_userId: { orgId: string; userId: string } };
    }) => {
      const { orgId, userId } = where.orgId_userId;
      return this.members.get(`${orgId}:${userId}`) ?? null;
    },
  };

  user = {
    findUnique: async ({
      where,
    }: {
      where: { id?: string; email?: string };
    }) => {
      if (where.id) return this.users.get(where.id) ?? null;
      if (where.email) {
        return (
          [...this.users.values()].find((u) => u.email === where.email) ?? null
        );
      }
      return null;
    },
  };

  transactionHistory = { create: async () => ({}) };
  witness = { updateMany: async () => ({ count: 0 }) };

  $transaction = async <T>(arg: unknown): Promise<T> => {
    if (Array.isArray(arg)) return Promise.all(arg) as Promise<T>;
    return (arg as (p: FakePrisma) => Promise<T>)(this);
  };

  seedUser(user: { id: string } & Row) {
    this.users.set(user.id, user);
  }

  seedOrgMembership(orgId: string, userId: string, role = 'OPERATOR') {
    this.members.set(`${orgId}:${userId}`, { orgId, userId, role });
  }
}
