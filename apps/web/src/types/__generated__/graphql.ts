export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: string; output: string; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AcceptInvitationInput = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type AccessGrant = {
  __typename: 'AccessGrant';
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  granter: Maybe<User>;
  id: Scalars['String']['output'];
  status: AccessStatus;
  token: Scalars['String']['output'];
};

export enum AccessStatus {
  Accepted = 'ACCEPTED',
  Pending = 'PENDING',
  Revoked = 'REVOKED'
}

export type AcknowledgeWitnessInput = {
  status: WitnessStatus;
  token?: InputMaybe<Scalars['String']['input']>;
  witnessId?: InputMaybe<Scalars['ID']['input']>;
};

export type AddWitnessInput = {
  transactionId: Scalars['ID']['input'];
  witnessInvites?: InputMaybe<Array<WitnessInviteInput>>;
  witnessUserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export enum AdminAction {
  DeprovisionPro = 'DEPROVISION_PRO',
  PlanCancelled = 'PLAN_CANCELLED',
  PlanCreated = 'PLAN_CREATED',
  PlanSynced = 'PLAN_SYNCED',
  PlanUpdated = 'PLAN_UPDATED',
  ProvisionPro = 'PROVISION_PRO',
  SetUserRole = 'SET_USER_ROLE'
}

export type AdminAuditLog = {
  __typename: 'AdminAuditLog';
  action: AdminAction;
  actor: Maybe<User>;
  actorId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  targetUser: Maybe<User>;
  targetUserId: Maybe<Scalars['ID']['output']>;
};

export type AdminAuditLogFilterInput = {
  action?: InputMaybe<AdminAction>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
};

export type AdminStats = {
  __typename: 'AdminStats';
  activeSubscriptions: Scalars['Int']['output'];
  adminUsers: Scalars['Int']['output'];
  freeUsers: Scalars['Int']['output'];
  newUsersLast30Days: Scalars['Int']['output'];
  proUsers: Scalars['Int']['output'];
  provisionedProUsers: Scalars['Int']['output'];
  totalUsers: Scalars['Int']['output'];
};

export type AdminUsersFilterInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  role?: InputMaybe<UserRole>;
  search?: InputMaybe<Scalars['String']['input']>;
  tier?: InputMaybe<SubscriptionTier>;
};

export enum AssetCategory {
  Funds = 'FUNDS',
  Item = 'ITEM'
}

export enum AttributionMode {
  OrgAndOperator = 'ORG_AND_OPERATOR',
  OrgOnly = 'ORG_ONLY'
}

export type AuthPayload = {
  __typename: 'AuthPayload';
  accessToken: Maybe<Scalars['String']['output']>;
  refreshToken: Maybe<Scalars['String']['output']>;
  user: User;
};

/** Billing interval for subscriptions */
export enum BillingInterval {
  Annual = 'ANNUAL',
  Monthly = 'MONTHLY'
}

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type CheckoutSession = {
  __typename: 'CheckoutSession';
  sessionId: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

export type Contact = {
  __typename: 'Contact';
  balance: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  email: Maybe<Scalars['String']['output']>;
  firstName: Scalars['String']['output'];
  hasPendingInvitation: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isOnPlatform: Scalars['Boolean']['output'];
  isSupporter: Scalars['Boolean']['output'];
  lastName: Scalars['String']['output'];
  linkedUserId: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  orgId: Maybe<Scalars['String']['output']>;
  phoneNumber: Maybe<Scalars['String']['output']>;
  sharedBy: Maybe<User>;
  sourceContactId: Maybe<Scalars['String']['output']>;
  transactions: Maybe<Array<Transaction>>;
  user: User;
  userId: Scalars['String']['output'];
};

export enum ContactBalanceStanding {
  All = 'ALL',
  IOwe = 'I_OWE',
  OwedToMe = 'OWED_TO_ME'
}

export type ContactGroupedSummary = {
  __typename: 'ContactGroupedSummary';
  contact: Maybe<Contact>;
  summary: TransactionsSummary;
};

export type ContactPlatformStatus = {
  __typename: 'ContactPlatformStatus';
  isOnPlatform: Scalars['Boolean']['output'];
  linkedUserId: Maybe<Scalars['String']['output']>;
};

export type CreateContactInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
};

export type CreateNoteInput = {
  body: Scalars['String']['input'];
  category?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type CreateOrgEventInput = {
  category: Scalars['String']['input'];
  date: Scalars['String']['input'];
  endDate?: InputMaybe<Scalars['String']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recurrence?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type CreateOrganisationInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  industry?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CreatePersonalEntryInput = {
  amount: Scalars['Float']['input'];
  category?: InputMaybe<Scalars['String']['input']>;
  currency?: Scalars['String']['input'];
  date: Scalars['DateTime']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  type: PersonalEntryType;
};

export type CreatePlanInput = {
  amount: Scalars['Float']['input'];
  currency: Scalars['String']['input'];
  duration?: InputMaybe<Scalars['Int']['input']>;
  interval: BillingInterval;
  name: Scalars['String']['input'];
  tier: SubscriptionTier;
};

export type CreateProjectInput = {
  budget?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  status?: InputMaybe<ProjectStatus>;
};

export type CreatePromiseInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  description: Scalars['String']['input'];
  dueDate: Scalars['DateTime']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Priority>;
  promiseTo: Scalars['String']['input'];
};

export type CreateSupportInput = {
  amount: Scalars['Float']['input'];
  currency?: Scalars['String']['input'];
  isAnonymous?: Scalars['Boolean']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  paymentProvider?: InputMaybe<Scalars['String']['input']>;
  supporterEmail?: InputMaybe<Scalars['String']['input']>;
  supporterName?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTransactionInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  category: AssetCategory;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  currency?: Scalars['String']['input'];
  date: Scalars['DateTime']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  recordOnPersonalLedger?: InputMaybe<Scalars['Boolean']['input']>;
  type: TransactionType;
  witnessInvites?: InputMaybe<Array<WitnessInviteInput>>;
  witnessUserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type CurrencyPricing = {
  __typename: 'CurrencyPricing';
  annual: Scalars['Float']['output'];
  currency: Scalars['String']['output'];
  monthly: Scalars['Float']['output'];
};

export type FilterContactInput = {
  balanceStanding?: InputMaybe<ContactBalanceStanding>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type FilterPersonalEntryInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  type?: InputMaybe<PersonalEntryType>;
};

export type FilterProjectInput = {
  balanceStanding?: InputMaybe<ProjectBalanceStanding>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProjectStatus>;
};

export type FilterProjectTransactionInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  type?: InputMaybe<ProjectTransactionType>;
};

export type FilterSharedHistoryInput = {
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<TransactionStatus>;
  types?: InputMaybe<Array<TransactionType>>;
};

export type FilterTransactionInput = {
  contactId?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  maxAmount?: InputMaybe<Scalars['Float']['input']>;
  minAmount?: InputMaybe<Scalars['Float']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<TransactionStatus>;
  summaryCurrency?: InputMaybe<Scalars['String']['input']>;
  types?: InputMaybe<Array<TransactionType>>;
};

export type FilterWitnessInput = {
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
};

export type ForgotPasswordInput = {
  email: Scalars['String']['input'];
};

export type GeoIpInfo = {
  __typename: 'GeoIPInfo';
  cityName: Scalars['String']['output'];
  countryCode: Scalars['String']['output'];
  countryName: Scalars['String']['output'];
  currencyCode: Maybe<Scalars['String']['output']>;
  ip: Scalars['String']['output'];
  isVpn: Scalars['Boolean']['output'];
  regionName: Scalars['String']['output'];
};

export type GrantAccessInput = {
  email: Scalars['String']['input'];
};

export type InviteContactResponse = {
  __typename: 'InviteContactResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type InviteMemberInput = {
  email: Scalars['String']['input'];
  role: OrgRole;
};

export type LogProjectTransactionInput = {
  amount: Scalars['Float']['input'];
  category?: InputMaybe<Scalars['String']['input']>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  contactTransactionType?: InputMaybe<TransactionType>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  parentTransactionId?: InputMaybe<Scalars['ID']['input']>;
  projectId: Scalars['String']['input'];
  type: ProjectTransactionType;
  witnessInvites?: InputMaybe<Array<WitnessInviteInput>>;
  witnessUserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type Mutation = {
  __typename: 'Mutation';
  acceptAccess: AccessGrant;
  acceptInvitation: AuthPayload;
  acknowledgeWitness: Witness;
  addWitness: Transaction;
  adminCancelPlan: PlanEntity;
  adminCreatePlan: PlanEntity;
  adminSyncPlans: Array<PlanEntity>;
  adminUpdatePlan: PlanEntity;
  cancelSubscription: Scalars['Boolean']['output'];
  changePassword: Scalars['Boolean']['output'];
  createCheckoutSession: CheckoutSession;
  createContact: Contact;
  createNote: Note;
  createOrgEvent: OrgEvent;
  createOrgNote: Note;
  createOrganisation: Organisation;
  createPersonalEntry: PersonalEntry;
  createProject: Project;
  createPromise: Promise;
  createSupport: Support;
  createSupportSession: CheckoutSession;
  createTransaction: Transaction;
  deletePersonalEntry: Scalars['Boolean']['output'];
  deprovisionPro: User;
  forgotPassword: Scalars['Boolean']['output'];
  grantAccess: AccessGrant;
  inviteContactToPlatform: InviteContactResponse;
  inviteMember: OrganisationMember;
  logProjectTransaction: ProjectTransaction;
  login: AuthPayload;
  logout: Scalars['Boolean']['output'];
  markAllNotificationsRead: Scalars['Boolean']['output'];
  markNotificationRead: Notification;
  markSharedHistorySeen: Scalars['Boolean']['output'];
  promoteContactToOrg: Contact;
  provisionPro: User;
  reactivateSubscription: Scalars['Boolean']['output'];
  refreshToken: AuthPayload;
  removeContact: Contact;
  removeMember: Scalars['Boolean']['output'];
  removeNote: Scalars['Boolean']['output'];
  removeOrgEvent: Scalars['Boolean']['output'];
  removeOrgNote: Scalars['Boolean']['output'];
  removeProjectTransaction: ProjectTransaction;
  removePromise: Promise;
  removeTransaction: Transaction;
  removeWitness: Witness;
  resendContactInvitation: InviteContactResponse;
  resendVerificationEmail: Scalars['Boolean']['output'];
  resendWitnessInvitation: Witness;
  resetPassword: Scalars['Boolean']['output'];
  revokeAccess: AccessGrant;
  setUserRole: User;
  signup: AuthPayload;
  switchOrgContext: AuthPayload;
  updateContact: Contact;
  updateMemberRole: OrganisationMember;
  updateNote: Note;
  updateOrgEvent: OrgEvent;
  updateOrgNote: Note;
  updateOrganisation: Organisation;
  updatePersonalEntry: PersonalEntry;
  updateProject: Project;
  updateProjectTransaction: ProjectTransaction;
  updatePromise: Promise;
  updateTransaction: Transaction;
  updateUser: User;
  verifyEmail: AuthPayload;
};


export type MutationAcceptAccessArgs = {
  token: Scalars['String']['input'];
};


export type MutationAcceptInvitationArgs = {
  acceptInvitationInput: AcceptInvitationInput;
};


export type MutationAcknowledgeWitnessArgs = {
  input: AcknowledgeWitnessInput;
};


export type MutationAddWitnessArgs = {
  input: AddWitnessInput;
};


export type MutationAdminCancelPlanArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminCreatePlanArgs = {
  input: CreatePlanInput;
};


export type MutationAdminUpdatePlanArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePlanInput;
};


export type MutationChangePasswordArgs = {
  changePasswordInput: ChangePasswordInput;
};


export type MutationCreateCheckoutSessionArgs = {
  currency?: InputMaybe<Scalars['String']['input']>;
  interval?: InputMaybe<BillingInterval>;
  tier: SubscriptionTier;
};


export type MutationCreateContactArgs = {
  createContactInput: CreateContactInput;
};


export type MutationCreateNoteArgs = {
  input: CreateNoteInput;
};


export type MutationCreateOrgEventArgs = {
  input: CreateOrgEventInput;
};


export type MutationCreateOrgNoteArgs = {
  input: CreateNoteInput;
};


export type MutationCreateOrganisationArgs = {
  input: CreateOrganisationInput;
};


export type MutationCreatePersonalEntryArgs = {
  input: CreatePersonalEntryInput;
};


export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


export type MutationCreatePromiseArgs = {
  createPromiseInput: CreatePromiseInput;
};


export type MutationCreateSupportArgs = {
  createSupportInput: CreateSupportInput;
};


export type MutationCreateSupportSessionArgs = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
};


export type MutationCreateTransactionArgs = {
  input: CreateTransactionInput;
};


export type MutationDeletePersonalEntryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeprovisionProArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationForgotPasswordArgs = {
  forgotPasswordInput: ForgotPasswordInput;
};


export type MutationGrantAccessArgs = {
  grantAccessInput: GrantAccessInput;
};


export type MutationInviteContactToPlatformArgs = {
  contactId: Scalars['ID']['input'];
};


export type MutationInviteMemberArgs = {
  input: InviteMemberInput;
};


export type MutationLogProjectTransactionArgs = {
  input: LogProjectTransactionInput;
};


export type MutationLoginArgs = {
  loginInput: LoginInput;
};


export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationPromoteContactToOrgArgs = {
  contactId: Scalars['ID']['input'];
};


export type MutationProvisionProArgs = {
  input: ProvisionProInput;
};


export type MutationRefreshTokenArgs = {
  refreshTokenInput: RefreshTokenInput;
};


export type MutationRemoveContactArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveMemberArgs = {
  memberId: Scalars['ID']['input'];
};


export type MutationRemoveNoteArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveOrgEventArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveOrgNoteArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveProjectTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemovePromiseArgs = {
  id: Scalars['String']['input'];
};


export type MutationRemoveTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveWitnessArgs = {
  witnessId: Scalars['ID']['input'];
};


export type MutationResendContactInvitationArgs = {
  contactId: Scalars['ID']['input'];
};


export type MutationResendVerificationEmailArgs = {
  email: Scalars['String']['input'];
};


export type MutationResendWitnessInvitationArgs = {
  witnessId: Scalars['ID']['input'];
};


export type MutationResetPasswordArgs = {
  resetPasswordInput: ResetPasswordInput;
};


export type MutationRevokeAccessArgs = {
  id: Scalars['String']['input'];
};


export type MutationSetUserRoleArgs = {
  input: SetUserRoleInput;
};


export type MutationSignupArgs = {
  signupInput: SignupInput;
};


export type MutationSwitchOrgContextArgs = {
  orgId?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateContactArgs = {
  updateContactInput: UpdateContactInput;
};


export type MutationUpdateMemberRoleArgs = {
  memberId: Scalars['ID']['input'];
  role: OrgRole;
};


export type MutationUpdateNoteArgs = {
  id: Scalars['ID']['input'];
  input: UpdateNoteInput;
};


export type MutationUpdateOrgEventArgs = {
  id: Scalars['ID']['input'];
  input: UpdateOrgEventInput;
};


export type MutationUpdateOrgNoteArgs = {
  id: Scalars['ID']['input'];
  input: UpdateNoteInput;
};


export type MutationUpdateOrganisationArgs = {
  input: UpdateOrganisationInput;
};


export type MutationUpdatePersonalEntryArgs = {
  input: UpdatePersonalEntryInput;
};


export type MutationUpdateProjectArgs = {
  input: UpdateProjectInput;
};


export type MutationUpdateProjectTransactionArgs = {
  input: UpdateProjectTransactionInput;
};


export type MutationUpdatePromiseArgs = {
  updatePromiseInput: UpdatePromiseInput;
};


export type MutationUpdateTransactionArgs = {
  input: UpdateTransactionInput;
};


export type MutationUpdateUserArgs = {
  updateUserInput: UpdateUserInput;
};


export type MutationVerifyEmailArgs = {
  token: Scalars['String']['input'];
};

export type Note = {
  __typename: 'Note';
  body: Scalars['String']['output'];
  category: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdById: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  orgId: Maybe<Scalars['String']['output']>;
  title: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type Notification = {
  __typename: 'Notification';
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  link: Maybe<Scalars['String']['output']>;
  read: Scalars['Boolean']['output'];
  title: Scalars['String']['output'];
  type: NotificationType;
  userId: Scalars['String']['output'];
};

export enum NotificationType {
  ProvisioningExpired = 'PROVISIONING_EXPIRED',
  ProvisioningGranted = 'PROVISIONING_GRANTED',
  ProvisioningRevoked = 'PROVISIONING_REVOKED',
  RoleDemoted = 'ROLE_DEMOTED',
  RolePromoted = 'ROLE_PROMOTED',
  WitnessAcknowledged = 'WITNESS_ACKNOWLEDGED',
  WitnessDeclined = 'WITNESS_DECLINED',
  WitnessInvited = 'WITNESS_INVITED',
  WitnessTransactionCancelled = 'WITNESS_TRANSACTION_CANCELLED',
  WitnessTransactionModified = 'WITNESS_TRANSACTION_MODIFIED'
}

export type OrgEvent = {
  __typename: 'OrgEvent';
  category: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  createdById: Scalars['String']['output'];
  date: Scalars['DateTime']['output'];
  endDate: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  isRecurring: Scalars['Boolean']['output'];
  notes: Maybe<Scalars['String']['output']>;
  orgId: Scalars['String']['output'];
  recurrence: Maybe<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export enum OrgRole {
  Admin = 'ADMIN',
  Operator = 'OPERATOR',
  Viewer = 'VIEWER'
}

export type Organisation = {
  __typename: 'Organisation';
  activeProjectCount: Scalars['Int']['output'];
  attributionMode: AttributionMode;
  contactCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  industry: Maybe<Scalars['String']['output']>;
  logoUrl: Maybe<Scalars['String']['output']>;
  members: Array<OrganisationMember>;
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  transactionCount: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type OrganisationMember = {
  __typename: 'OrganisationMember';
  id: Scalars['ID']['output'];
  joinedAt: Scalars['DateTime']['output'];
  orgId: Scalars['String']['output'];
  organisation: Organisation;
  role: OrgRole;
  user: User;
  userId: Scalars['String']['output'];
};

export type PaginatedAuditLogsResponse = {
  __typename: 'PaginatedAuditLogsResponse';
  items: Array<AdminAuditLog>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedContactsResponse = {
  __typename: 'PaginatedContactsResponse';
  items: Array<Contact>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedPersonalEntriesResponse = {
  __typename: 'PaginatedPersonalEntriesResponse';
  items: Array<PersonalEntry>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedProjectTransactionsResponse = {
  __typename: 'PaginatedProjectTransactionsResponse';
  items: Array<ProjectTransaction>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedProjectsResponse = {
  __typename: 'PaginatedProjectsResponse';
  items: Array<Project>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedSharedHistoryResponse = {
  __typename: 'PaginatedSharedHistoryResponse';
  items: Array<Transaction>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedUsersResponse = {
  __typename: 'PaginatedUsersResponse';
  items: Array<User>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PaginatedWitnessesResponse = {
  __typename: 'PaginatedWitnessesResponse';
  items: Array<Witness>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type PersonalEntry = {
  __typename: 'PersonalEntry';
  amount: Scalars['Float']['output'];
  category: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdById: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  date: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  type: PersonalEntryType;
};

export type PersonalEntrySummary = {
  __typename: 'PersonalEntrySummary';
  currency: Scalars['String']['output'];
  netCashPosition: Scalars['Float']['output'];
  totalExpenses: Scalars['Float']['output'];
  totalIncome: Scalars['Float']['output'];
};

export enum PersonalEntryType {
  Expense = 'EXPENSE',
  Income = 'INCOME'
}

export type PlanEntity = {
  __typename: 'PlanEntity';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  interval: Scalars['String']['output'];
  name: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  providerPlanId: Scalars['String']['output'];
  status: PlanStatus;
  tier: Maybe<SubscriptionTier>;
  updatedAt: Scalars['DateTime']['output'];
};

/** Local status of a Flutterwave payment plan */
export enum PlanStatus {
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
  Inactive = 'INACTIVE'
}

export enum Priority {
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM'
}

export type ProPricing = {
  __typename: 'ProPricing';
  currencies: Array<CurrencyPricing>;
  freeLimits: TierLimitsEntity;
  proLimits: TierLimitsEntity;
};

export type Project = {
  __typename: 'Project';
  balance: Scalars['Float']['output'];
  budget: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  status: ProjectStatus;
  totalExpenses: Scalars['Float']['output'];
  totalIncome: Scalars['Float']['output'];
  transactions: Maybe<PaginatedProjectTransactionsResponse>;
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};


export type ProjectTransactionsArgs = {
  filter?: InputMaybe<FilterProjectTransactionInput>;
};

export enum ProjectBalanceStanding {
  All = 'ALL',
  OverBudget = 'OVER_BUDGET',
  UnderBudget = 'UNDER_BUDGET'
}

export enum ProjectStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Completed = 'COMPLETED'
}

export type ProjectTransaction = {
  __typename: 'ProjectTransaction';
  amount: Scalars['Float']['output'];
  category: Maybe<Scalars['String']['output']>;
  contact: Maybe<Contact>;
  contactId: Maybe<Scalars['ID']['output']>;
  contactTransactionType: Maybe<TransactionType>;
  createdAt: Scalars['DateTime']['output'];
  date: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  history: Maybe<Array<ProjectTransactionHistory>>;
  id: Scalars['ID']['output'];
  isMirroredFromContact: Scalars['Boolean']['output'];
  project: Maybe<Project>;
  projectId: Scalars['String']['output'];
  transaction: Maybe<Transaction>;
  transactionId: Maybe<Scalars['ID']['output']>;
  type: ProjectTransactionType;
  updatedAt: Scalars['DateTime']['output'];
  witnesses: Maybe<Array<Witness>>;
};

export type ProjectTransactionHistory = {
  __typename: 'ProjectTransactionHistory';
  changeType: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  newState: Scalars['JSON']['output'];
  previousState: Scalars['JSON']['output'];
  projectTransactionId: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};

export enum ProjectTransactionType {
  Expense = 'EXPENSE',
  Income = 'INCOME'
}

export type Promise = {
  __typename: 'Promise';
  category: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  dueDate: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  priority: Priority;
  promiseTo: Scalars['String']['output'];
  status: PromiseStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export enum PromiseStatus {
  Fulfilled = 'FULFILLED',
  Overdue = 'OVERDUE',
  Pending = 'PENDING'
}

export type ProvisionProInput = {
  expiresAt: Scalars['DateTime']['input'];
  userId: Scalars['ID']['input'];
};

export type Query = {
  __typename: 'Query';
  adminAuditLogs: PaginatedAuditLogsResponse;
  adminPlans: Array<PlanEntity>;
  adminStats: AdminStats;
  adminUser: User;
  adminUsers: PaginatedUsersResponse;
  checkContactOnPlatform: ContactPlatformStatus;
  contact: Contact;
  contacts: PaginatedContactsResponse;
  convertCurrency: Scalars['Float']['output'];
  getGeoIPInfo: GeoIpInfo;
  getWitnessInvitation: Witness;
  me: User;
  myAccessGrants: Array<AccessGrant>;
  myContactTransactions: PaginatedSharedHistoryResponse;
  myNotifications: Array<Notification>;
  myOrganisations: Array<Organisation>;
  myProjects: PaginatedProjectsResponse;
  myPromises: Array<Promise>;
  mySubscription: SubscriptionInfo;
  mySupports: Array<Support>;
  myUnreadNotificationCount: Scalars['Int']['output'];
  myWitnessRequests: PaginatedWitnessesResponse;
  orgEventCategorySuggestions: Array<Scalars['String']['output']>;
  orgEvents: Array<OrgEvent>;
  orgNotes: Array<Note>;
  orgUpcomingEvents: Array<OrgEvent>;
  organisation: Organisation;
  personalEntries: PaginatedPersonalEntriesResponse;
  personalEntrySummary: PersonalEntrySummary;
  proPricing: ProPricing;
  project: Project;
  projectContactOutstandingLoans: Array<Transaction>;
  projectTransactionCategorySuggestions: Array<Scalars['String']['output']>;
  promise: Promise;
  receivedAccessGrants: Array<AccessGrant>;
  searchWitness: Maybe<WitnessCandidate>;
  shareableContacts: PaginatedContactsResponse;
  sharedData: SharedDataEntity;
  support: Support;
  supportOptions: Array<SupportOption>;
  supports: Array<Support>;
  totalBalance: TransactionsSummary;
  transaction: Transaction;
  transactions: TransactionsResponse;
  transactionsGroupedByContact: Array<ContactGroupedSummary>;
  user: Maybe<User>;
  userNotes: Array<Note>;
};


export type QueryAdminAuditLogsArgs = {
  filter?: InputMaybe<AdminAuditLogFilterInput>;
};


export type QueryAdminUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAdminUsersArgs = {
  filter?: InputMaybe<AdminUsersFilterInput>;
};


export type QueryCheckContactOnPlatformArgs = {
  contactId: Scalars['ID']['input'];
};


export type QueryContactArgs = {
  id: Scalars['ID']['input'];
};


export type QueryContactsArgs = {
  filter?: InputMaybe<FilterContactInput>;
};


export type QueryConvertCurrencyArgs = {
  amount: Scalars['Float']['input'];
  from: Scalars['String']['input'];
  to: Scalars['String']['input'];
};


export type QueryGetWitnessInvitationArgs = {
  token: Scalars['String']['input'];
};


export type QueryMyContactTransactionsArgs = {
  filter?: InputMaybe<FilterSharedHistoryInput>;
};


export type QueryMyProjectsArgs = {
  filter?: InputMaybe<FilterProjectInput>;
};


export type QueryMyWitnessRequestsArgs = {
  filter?: InputMaybe<FilterWitnessInput>;
  status?: InputMaybe<WitnessStatus>;
};


export type QueryOrgEventsArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
};


export type QueryOrgNotesArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
};


export type QueryOrgUpcomingEventsArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
};


export type QueryOrganisationArgs = {
  slug: Scalars['String']['input'];
};


export type QueryPersonalEntriesArgs = {
  filter?: InputMaybe<FilterPersonalEntryInput>;
};


export type QueryPersonalEntrySummaryArgs = {
  filter?: InputMaybe<FilterPersonalEntryInput>;
};


export type QueryProjectArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProjectContactOutstandingLoansArgs = {
  contactId: Scalars['ID']['input'];
  contactTransactionType?: InputMaybe<TransactionType>;
  projectId: Scalars['ID']['input'];
};


export type QueryProjectTransactionCategorySuggestionsArgs = {
  projectId: Scalars['ID']['input'];
};


export type QueryPromiseArgs = {
  id: Scalars['String']['input'];
};


export type QuerySearchWitnessArgs = {
  input: SearchWitnessInput;
};


export type QueryShareableContactsArgs = {
  filter?: InputMaybe<FilterContactInput>;
};


export type QuerySharedDataArgs = {
  grantId: Scalars['String']['input'];
};


export type QuerySupportArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySupportOptionsArgs = {
  currency?: InputMaybe<Scalars['String']['input']>;
};


export type QueryTotalBalanceArgs = {
  currency?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTransactionInput>;
};


export type QueryTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTransactionsArgs = {
  filter?: InputMaybe<FilterTransactionInput>;
};


export type QueryTransactionsGroupedByContactArgs = {
  filter?: InputMaybe<FilterTransactionInput>;
};


export type QueryUserArgs = {
  id: Scalars['String']['input'];
};


export type QueryUserNotesArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
};

export type RefreshTokenInput = {
  refreshToken?: InputMaybe<Scalars['String']['input']>;
};

export type ResetPasswordInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export enum SearchType {
  Email = 'EMAIL',
  Phone = 'PHONE'
}

export type SearchWitnessInput = {
  query: Scalars['String']['input'];
  type: SearchType;
};

export type SetUserRoleInput = {
  role: UserRole;
  userId: Scalars['ID']['input'];
};

export type SharedDataEntity = {
  __typename: 'SharedDataEntity';
  projects: Maybe<Array<Project>>;
  promises: Maybe<Array<Promise>>;
  transactions: Maybe<Array<Transaction>>;
  user: Maybe<User>;
};

export type SignupInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  token?: InputMaybe<Scalars['String']['input']>;
};

export type Subscription = {
  __typename: 'Subscription';
  notificationCreated: Notification;
  orgEventCreated: OrgEvent;
  orgEventRemoved: Scalars['ID']['output'];
  orgEventUpdated: OrgEvent;
  orgNoteCreated: Note;
  orgNoteRemoved: Scalars['ID']['output'];
  orgNoteUpdated: Note;
};

export type SubscriptionInfo = {
  __typename: 'SubscriptionInfo';
  cancelAtPeriodEnd: Maybe<Scalars['Boolean']['output']>;
  currentPeriodEnd: Maybe<Scalars['DateTime']['output']>;
  featureUsage: Maybe<Scalars['JSON']['output']>;
  limits: TierLimitsEntity;
  subscriptionStatus: Maybe<Scalars['String']['output']>;
  tier: Scalars['String']['output'];
};

/** The subscription tier of the user */
export enum SubscriptionTier {
  Free = 'FREE',
  Pro = 'PRO'
}

export type Support = {
  __typename: 'Support';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isAnonymous: Scalars['Boolean']['output'];
  message: Maybe<Scalars['String']['output']>;
  paymentProvider: Maybe<Scalars['String']['output']>;
  paymentRef: Maybe<Scalars['String']['output']>;
  status: SupportStatus;
  supporter: Maybe<User>;
  supporterEmail: Maybe<Scalars['String']['output']>;
  supporterId: Maybe<Scalars['String']['output']>;
  supporterName: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type SupportOption = {
  __typename: 'SupportOption';
  amount: Scalars['Float']['output'];
  currency: Scalars['String']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export enum SupportStatus {
  Failed = 'FAILED',
  Pending = 'PENDING',
  Successful = 'SUCCESSFUL'
}

export type TierLimitsEntity = {
  __typename: 'TierLimitsEntity';
  allowAdvancedAnalytics: Scalars['Boolean']['output'];
  allowOrganisations: Scalars['Boolean']['output'];
  allowProfessionalReports: Scalars['Boolean']['output'];
  allowSMS: Scalars['Boolean']['output'];
  contactNotificationSms: Scalars['Int']['output'];
  maxContacts: Scalars['Int']['output'];
  maxNotes: Scalars['Int']['output'];
  maxWitnessesPerMonth: Scalars['Int']['output'];
};

export type Transaction = {
  __typename: 'Transaction';
  amount: Maybe<Scalars['Float']['output']>;
  category: AssetCategory;
  contact: Maybe<Contact>;
  contactId: Maybe<Scalars['String']['output']>;
  conversions: Maybe<Array<Transaction>>;
  createdAt: Maybe<Scalars['DateTime']['output']>;
  createdBy: Maybe<User>;
  createdById: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  date: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  history: Maybe<Array<TransactionHistory>>;
  id: Scalars['ID']['output'];
  isMirroredFromProject: Scalars['Boolean']['output'];
  itemName: Maybe<Scalars['String']['output']>;
  orgId: Maybe<Scalars['String']['output']>;
  orgSourceTransaction: Maybe<Transaction>;
  orgSourceTransactionId: Maybe<Scalars['String']['output']>;
  organisation: Maybe<Organisation>;
  parent: Maybe<Transaction>;
  parentId: Maybe<Scalars['String']['output']>;
  projectTransaction: Maybe<ProjectTransaction>;
  projectTransactionId: Maybe<Scalars['String']['output']>;
  quantity: Maybe<Scalars['Int']['output']>;
  remainingAmount: Maybe<Scalars['Float']['output']>;
  status: TransactionStatus;
  type: TransactionType;
  witnesses: Maybe<Array<Witness>>;
};

export type TransactionHistory = {
  __typename: 'TransactionHistory';
  changeType: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  newState: Scalars['JSON']['output'];
  previousState: Scalars['JSON']['output'];
  transactionId: Scalars['String']['output'];
  user: Maybe<User>;
  userId: Scalars['String']['output'];
};

export enum TransactionStatus {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Pending = 'PENDING'
}

export enum TransactionType {
  AdvancePaid = 'ADVANCE_PAID',
  AdvanceReceived = 'ADVANCE_RECEIVED',
  DepositPaid = 'DEPOSIT_PAID',
  DepositReceived = 'DEPOSIT_RECEIVED',
  Escrowed = 'ESCROWED',
  GiftGiven = 'GIFT_GIVEN',
  GiftReceived = 'GIFT_RECEIVED',
  LoanGiven = 'LOAN_GIVEN',
  LoanReceived = 'LOAN_RECEIVED',
  Remitted = 'REMITTED',
  RepaymentMade = 'REPAYMENT_MADE',
  RepaymentReceived = 'REPAYMENT_RECEIVED'
}

export type TransactionsResponse = {
  __typename: 'TransactionsResponse';
  items: Array<Transaction>;
  limit: Scalars['Int']['output'];
  page: Scalars['Int']['output'];
  summary: TransactionsSummary;
  total: Scalars['Int']['output'];
};

export type TransactionsSummary = {
  __typename: 'TransactionsSummary';
  currency: Scalars['String']['output'];
  netBalance: Scalars['Float']['output'];
  totalAdvancePaid: Scalars['Float']['output'];
  totalAdvanceReceived: Scalars['Float']['output'];
  totalDepositPaid: Scalars['Float']['output'];
  totalDepositReceived: Scalars['Float']['output'];
  totalEscrowed: Scalars['Float']['output'];
  totalGiftGiven: Scalars['Float']['output'];
  totalGiftReceived: Scalars['Float']['output'];
  totalLoanGiven: Scalars['Float']['output'];
  totalLoanReceived: Scalars['Float']['output'];
  totalRemitted: Scalars['Float']['output'];
  totalRepaymentMade: Scalars['Float']['output'];
  totalRepaymentReceived: Scalars['Float']['output'];
};

export type UpdateContactInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateNoteInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOrgEventInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['String']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recurrence?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateOrganisationInput = {
  attributionMode?: InputMaybe<AttributionMode>;
  description?: InputMaybe<Scalars['String']['input']>;
  industry?: InputMaybe<Scalars['String']['input']>;
  logoUrl?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePersonalEntryInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  type?: InputMaybe<PersonalEntryType>;
};

export type UpdatePlanInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<PlanStatus>;
  tier?: InputMaybe<SubscriptionTier>;
};

export type UpdateProjectInput = {
  budget?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProjectStatus>;
};

export type UpdateProjectTransactionInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  contactTransactionType?: InputMaybe<TransactionType>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  parentTransactionId?: InputMaybe<Scalars['ID']['input']>;
  type?: InputMaybe<ProjectTransactionType>;
};

export type UpdatePromiseInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Priority>;
  promiseTo?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<PromiseStatus>;
};

export type UpdateTransactionInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<AssetCategory>;
  contactId?: InputMaybe<Scalars['ID']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  itemName?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  recordOnPersonalLedger?: InputMaybe<Scalars['Boolean']['input']>;
  type?: InputMaybe<TransactionType>;
  witnessInvites?: InputMaybe<Array<WitnessInviteInput>>;
  witnessUserIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type UpdateUserInput = {
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
  preferredCurrency?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename: 'User';
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  featureUsage: Maybe<Scalars['JSON']['output']>;
  firstName: Scalars['String']['output'];
  hasSeenSharedHistory: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isEmailVerified: Scalars['Boolean']['output'];
  isSupporter: Scalars['Boolean']['output'];
  lastName: Scalars['String']['output'];
  name: Scalars['String']['output'];
  passwordHash: Maybe<Scalars['String']['output']>;
  phoneNumber: Maybe<Scalars['String']['output']>;
  preferredCurrency: Scalars['String']['output'];
  role: UserRole;
  subscriptionStatus: Maybe<Scalars['String']['output']>;
  tier: SubscriptionTier;
};

export enum UserRole {
  Admin = 'ADMIN',
  SuperAdmin = 'SUPER_ADMIN',
  User = 'USER'
}

export type Witness = {
  __typename: 'Witness';
  acknowledgedAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  invitedAt: Scalars['DateTime']['output'];
  projectTransactionId: Maybe<Scalars['String']['output']>;
  status: WitnessStatus;
  transaction: Maybe<Transaction>;
  transactionId: Maybe<Scalars['String']['output']>;
  user: Maybe<User>;
  userId: Scalars['String']['output'];
};

export type WitnessCandidate = {
  __typename: 'WitnessCandidate';
  firstName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastName: Scalars['String']['output'];
};

export type WitnessInviteInput = {
  email: Scalars['String']['input'];
  name: Scalars['String']['input'];
  phoneNumber?: InputMaybe<Scalars['String']['input']>;
};

export enum WitnessStatus {
  Acknowledged = 'ACKNOWLEDGED',
  Declined = 'DECLINED',
  Modified = 'MODIFIED',
  Pending = 'PENDING'
}

export type RefreshTokenMutationVariables = Exact<{
  refreshTokenInput: RefreshTokenInput;
}>;


export type RefreshTokenMutation = { refreshToken: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, name: string } } };

export type AdminUserFieldsFragment = { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string };

export type AdminUsersQueryVariables = Exact<{
  filter?: InputMaybe<AdminUsersFilterInput>;
}>;


export type AdminUsersQuery = { adminUsers: { __typename: 'PaginatedUsersResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string }> } };

export type AdminUserQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AdminUserQuery = { adminUser: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string } };

export type AdminStatsQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminStatsQuery = { adminStats: { __typename: 'AdminStats', totalUsers: number, freeUsers: number, proUsers: number, provisionedProUsers: number, adminUsers: number, newUsersLast30Days: number, activeSubscriptions: number } };

export type AdminAuditLogsQueryVariables = Exact<{
  filter?: InputMaybe<AdminAuditLogFilterInput>;
}>;


export type AdminAuditLogsQuery = { adminAuditLogs: { __typename: 'PaginatedAuditLogsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'AdminAuditLog', id: string, action: AdminAction, metadata: Record<string, unknown> | null, createdAt: string, actor: { __typename: 'User', id: string, name: string, email: string } | null, targetUser: { __typename: 'User', id: string, name: string, email: string } | null }> } };

export type ProvisionProMutationVariables = Exact<{
  input: ProvisionProInput;
}>;


export type ProvisionProMutation = { provisionPro: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string } };

export type DeprovisionProMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type DeprovisionProMutation = { deprovisionPro: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string } };

export type SetUserRoleMutationVariables = Exact<{
  input: SetUserRoleInput;
}>;


export type SetUserRoleMutation = { setUserRole: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, tier: SubscriptionTier, role: UserRole, isSupporter: boolean, isEmailVerified: boolean, subscriptionStatus: string | null, createdAt: string } };

export type AdminPlanFieldsFragment = { __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string };

export type AdminPlansQueryVariables = Exact<{ [key: string]: never; }>;


export type AdminPlansQuery = { adminPlans: Array<{ __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string }> };

export type AdminSyncPlansMutationVariables = Exact<{ [key: string]: never; }>;


export type AdminSyncPlansMutation = { adminSyncPlans: Array<{ __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string }> };

export type AdminCreatePlanMutationVariables = Exact<{
  input: CreatePlanInput;
}>;


export type AdminCreatePlanMutation = { adminCreatePlan: { __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string } };

export type AdminUpdatePlanMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePlanInput;
}>;


export type AdminUpdatePlanMutation = { adminUpdatePlan: { __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string } };

export type AdminCancelPlanMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AdminCancelPlanMutation = { adminCancelPlan: { __typename: 'PlanEntity', id: string, tier: SubscriptionTier | null, interval: string, currency: string, amount: number, name: string, provider: string, providerPlanId: string, status: PlanStatus, createdAt: string, updatedAt: string } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, isSupporter: boolean, hasSeenSharedHistory: boolean, role: UserRole, tier: SubscriptionTier } };

export type LoginMutationVariables = Exact<{
  loginInput: LoginInput;
}>;


export type LoginMutation = { login: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, isSupporter: boolean, hasSeenSharedHistory: boolean, role: UserRole, tier: SubscriptionTier } } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { logout: boolean };

export type SignupMutationVariables = Exact<{
  signupInput: SignupInput;
}>;


export type SignupMutation = { signup: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, isSupporter: boolean, hasSeenSharedHistory: boolean } } };

export type AcceptInvitationMutationVariables = Exact<{
  acceptInvitationInput: AcceptInvitationInput;
}>;


export type AcceptInvitationMutation = { acceptInvitation: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, isSupporter: boolean, hasSeenSharedHistory: boolean } } };

export type ForgotPasswordMutationVariables = Exact<{
  forgotPasswordInput: ForgotPasswordInput;
}>;


export type ForgotPasswordMutation = { forgotPassword: boolean };

export type ResetPasswordMutationVariables = Exact<{
  resetPasswordInput: ResetPasswordInput;
}>;


export type ResetPasswordMutation = { resetPassword: boolean };

export type ChangePasswordMutationVariables = Exact<{
  changePasswordInput: ChangePasswordInput;
}>;


export type ChangePasswordMutation = { changePassword: boolean };

export type VerifyEmailMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type VerifyEmailMutation = { verifyEmail: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, name: string, firstName: string, lastName: string, phoneNumber: string | null, preferredCurrency: string, isSupporter: boolean, hasSeenSharedHistory: boolean } } };

export type ResendVerificationEmailMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type ResendVerificationEmailMutation = { resendVerificationEmail: boolean };

export type GetContactsQueryVariables = Exact<{
  filter?: InputMaybe<FilterContactInput>;
}>;


export type GetContactsQuery = { contacts: { __typename: 'PaginatedContactsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Contact', id: string, name: string, email: string | null, phoneNumber: string | null, balance: number, isOnPlatform: boolean, isSupporter: boolean, hasPendingInvitation: boolean, createdAt: string, orgId: string | null, sourceContactId: string | null, sharedBy: { __typename: 'User', id: string, firstName: string, lastName: string } | null }> } };

export type GetContactQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetContactQuery = { contact: { __typename: 'Contact', id: string, name: string, email: string | null, phoneNumber: string | null, balance: number, isOnPlatform: boolean, isSupporter: boolean, hasPendingInvitation: boolean, createdAt: string, orgId: string | null, sourceContactId: string | null, sharedBy: { __typename: 'User', id: string, firstName: string, lastName: string } | null } };

export type ShareableContactsQueryVariables = Exact<{
  filter?: InputMaybe<FilterContactInput>;
}>;


export type ShareableContactsQuery = { shareableContacts: { __typename: 'PaginatedContactsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Contact', id: string, name: string, email: string | null, phoneNumber: string | null }> } };

export type InviteContactMutationVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;


export type InviteContactMutation = { inviteContactToPlatform: { __typename: 'InviteContactResponse', success: boolean, message: string } };

export type ResendContactInvitationMutationVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;


export type ResendContactInvitationMutation = { resendContactInvitation: { __typename: 'InviteContactResponse', success: boolean, message: string } };

export type CreateContactMutationVariables = Exact<{
  createContactInput: CreateContactInput;
}>;


export type CreateContactMutation = { createContact: { __typename: 'Contact', id: string, name: string, email: string | null, phoneNumber: string | null, balance: number } };

export type UpdateContactMutationVariables = Exact<{
  updateContactInput: UpdateContactInput;
}>;


export type UpdateContactMutation = { updateContact: { __typename: 'Contact', id: string, name: string, email: string | null, phoneNumber: string | null } };

export type DeleteContactMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteContactMutation = { removeContact: { __typename: 'Contact', id: string } };

export type GetGeoIpInfoQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGeoIpInfoQuery = { getGeoIPInfo: { __typename: 'GeoIPInfo', ip: string, countryCode: string, countryName: string, regionName: string, cityName: string, currencyCode: string | null, isVpn: boolean } };

export type UserNoteFieldsFragment = { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string };

export type UserNotesQueryVariables = Exact<{
  category?: InputMaybe<Scalars['String']['input']>;
}>;


export type UserNotesQuery = { userNotes: Array<{ __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string }> };

export type CreateNoteMutationVariables = Exact<{
  input: CreateNoteInput;
}>;


export type CreateNoteMutation = { createNote: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type UpdateNoteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateNoteInput;
}>;


export type UpdateNoteMutation = { updateNote: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type RemoveNoteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveNoteMutation = { removeNote: boolean };

export type NotificationFieldsFragment = { __typename: 'Notification', id: string, type: NotificationType, title: string, body: string, link: string | null, read: boolean, createdAt: string };

export type MyNotificationsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyNotificationsQuery = { myNotifications: Array<{ __typename: 'Notification', id: string, type: NotificationType, title: string, body: string, link: string | null, read: boolean, createdAt: string }> };

export type MyUnreadNotificationCountQueryVariables = Exact<{ [key: string]: never; }>;


export type MyUnreadNotificationCountQuery = { myUnreadNotificationCount: number };

export type MarkNotificationReadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkNotificationReadMutation = { markNotificationRead: { __typename: 'Notification', id: string, type: NotificationType, title: string, body: string, link: string | null, read: boolean, createdAt: string } };

export type MarkAllNotificationsReadMutationVariables = Exact<{ [key: string]: never; }>;


export type MarkAllNotificationsReadMutation = { markAllNotificationsRead: boolean };

export type NotificationCreatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type NotificationCreatedSubscription = { notificationCreated: { __typename: 'Notification', id: string, type: NotificationType, title: string, body: string, link: string | null, read: boolean, createdAt: string } };

export type OrganisationFieldsFragment = { __typename: 'Organisation', id: string, name: string, slug: string, description: string | null, industry: string | null, logoUrl: string | null, attributionMode: AttributionMode, createdAt: string, transactionCount: number, contactCount: number, activeProjectCount: number };

export type MyOrganisationsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyOrganisationsQuery = { myOrganisations: Array<{ __typename: 'Organisation', id: string, name: string, slug: string, description: string | null, industry: string | null, logoUrl: string | null, attributionMode: AttributionMode, createdAt: string, transactionCount: number, contactCount: number, activeProjectCount: number, members: Array<{ __typename: 'OrganisationMember', id: string, userId: string, role: OrgRole, joinedAt: string, user: { __typename: 'User', id: string, firstName: string, lastName: string, email: string } }> }> };

export type SwitchOrgContextMutationVariables = Exact<{
  orgId?: InputMaybe<Scalars['String']['input']>;
}>;


export type SwitchOrgContextMutation = { switchOrgContext: { __typename: 'AuthPayload', accessToken: string | null, refreshToken: string | null, user: { __typename: 'User', id: string, email: string, firstName: string, lastName: string } } };

export type CreateOrganisationMutationVariables = Exact<{
  input: CreateOrganisationInput;
}>;


export type CreateOrganisationMutation = { createOrganisation: { __typename: 'Organisation', id: string, name: string, slug: string, description: string | null, industry: string | null, logoUrl: string | null, attributionMode: AttributionMode, createdAt: string, transactionCount: number, contactCount: number, activeProjectCount: number } };

export type UpdateOrganisationMutationVariables = Exact<{
  input: UpdateOrganisationInput;
}>;


export type UpdateOrganisationMutation = { updateOrganisation: { __typename: 'Organisation', id: string, name: string, slug: string, description: string | null, industry: string | null, logoUrl: string | null, attributionMode: AttributionMode, createdAt: string, transactionCount: number, contactCount: number, activeProjectCount: number } };

export type InviteMemberMutationVariables = Exact<{
  input: InviteMemberInput;
}>;


export type InviteMemberMutation = { inviteMember: { __typename: 'OrganisationMember', id: string, userId: string, role: OrgRole, joinedAt: string } };

export type UpdateMemberRoleMutationVariables = Exact<{
  memberId: Scalars['ID']['input'];
  role: OrgRole;
}>;


export type UpdateMemberRoleMutation = { updateMemberRole: { __typename: 'OrganisationMember', id: string, role: OrgRole } };

export type RemoveMemberMutationVariables = Exact<{
  memberId: Scalars['ID']['input'];
}>;


export type RemoveMemberMutation = { removeMember: boolean };

export type PromoteContactToOrgMutationVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;


export type PromoteContactToOrgMutation = { promoteContactToOrg: { __typename: 'Contact', id: string, firstName: string, lastName: string } };

export type OrgEventFieldsFragment = { __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string };

export type OrgUpcomingEventsQueryVariables = Exact<{
  category?: InputMaybe<Scalars['String']['input']>;
}>;


export type OrgUpcomingEventsQuery = { orgUpcomingEvents: Array<{ __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string }> };

export type OrgEventsQueryVariables = Exact<{
  category?: InputMaybe<Scalars['String']['input']>;
}>;


export type OrgEventsQuery = { orgEvents: Array<{ __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string }> };

export type OrgEventCategorySuggestionsQueryVariables = Exact<{ [key: string]: never; }>;


export type OrgEventCategorySuggestionsQuery = { orgEventCategorySuggestions: Array<string> };

export type CreateOrgEventMutationVariables = Exact<{
  input: CreateOrgEventInput;
}>;


export type CreateOrgEventMutation = { createOrgEvent: { __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type UpdateOrgEventMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateOrgEventInput;
}>;


export type UpdateOrgEventMutation = { updateOrgEvent: { __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type RemoveOrgEventMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveOrgEventMutation = { removeOrgEvent: boolean };

export type OrgEventCreatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgEventCreatedSubscription = { orgEventCreated: { __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type OrgEventUpdatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgEventUpdatedSubscription = { orgEventUpdated: { __typename: 'OrgEvent', id: string, orgId: string, title: string, date: string, endDate: string | null, category: string, notes: string | null, isRecurring: boolean, recurrence: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type OrgEventRemovedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgEventRemovedSubscription = { orgEventRemoved: string };

export type OrgNoteFieldsFragment = { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string };

export type OrgNotesQueryVariables = Exact<{
  category?: InputMaybe<Scalars['String']['input']>;
}>;


export type OrgNotesQuery = { orgNotes: Array<{ __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string }> };

export type CreateOrgNoteMutationVariables = Exact<{
  input: CreateNoteInput;
}>;


export type CreateOrgNoteMutation = { createOrgNote: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type UpdateOrgNoteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateNoteInput;
}>;


export type UpdateOrgNoteMutation = { updateOrgNote: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type RemoveOrgNoteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveOrgNoteMutation = { removeOrgNote: boolean };

export type OrgNoteCreatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgNoteCreatedSubscription = { orgNoteCreated: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type OrgNoteUpdatedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgNoteUpdatedSubscription = { orgNoteUpdated: { __typename: 'Note', id: string, orgId: string | null, title: string | null, body: string, category: string | null, createdById: string, createdAt: string, updatedAt: string } };

export type OrgNoteRemovedSubscriptionVariables = Exact<{ [key: string]: never; }>;


export type OrgNoteRemovedSubscription = { orgNoteRemoved: string };

export type CreateCheckoutSessionMutationVariables = Exact<{
  tier: SubscriptionTier;
  currency: Scalars['String']['input'];
  interval?: InputMaybe<BillingInterval>;
}>;


export type CreateCheckoutSessionMutation = { createCheckoutSession: { __typename: 'CheckoutSession', url: string } };

export type CreateSupportSessionMutationVariables = Exact<{
  amount?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateSupportSessionMutation = { createSupportSession: { __typename: 'CheckoutSession', url: string } };

export type CancelSubscriptionMutationVariables = Exact<{ [key: string]: never; }>;


export type CancelSubscriptionMutation = { cancelSubscription: boolean };

export type ReactivateSubscriptionMutationVariables = Exact<{ [key: string]: never; }>;


export type ReactivateSubscriptionMutation = { reactivateSubscription: boolean };

export type PersonalEntryFieldsFragment = { __typename: 'PersonalEntry', id: string, type: PersonalEntryType, amount: number, currency: string, category: string | null, date: string, description: string | null, createdAt: string, createdById: string };

export type GetPersonalEntriesQueryVariables = Exact<{
  filter?: InputMaybe<FilterPersonalEntryInput>;
}>;


export type GetPersonalEntriesQuery = { personalEntries: { __typename: 'PaginatedPersonalEntriesResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'PersonalEntry', id: string, type: PersonalEntryType, amount: number, currency: string, category: string | null, date: string, description: string | null, createdAt: string, createdById: string }> } };

export type GetPersonalEntrySummaryQueryVariables = Exact<{
  filter?: InputMaybe<FilterPersonalEntryInput>;
}>;


export type GetPersonalEntrySummaryQuery = { personalEntrySummary: { __typename: 'PersonalEntrySummary', totalIncome: number, totalExpenses: number, netCashPosition: number, currency: string } };

export type CreatePersonalEntryMutationVariables = Exact<{
  input: CreatePersonalEntryInput;
}>;


export type CreatePersonalEntryMutation = { createPersonalEntry: { __typename: 'PersonalEntry', id: string, type: PersonalEntryType, amount: number, currency: string, category: string | null, date: string, description: string | null, createdAt: string, createdById: string } };

export type UpdatePersonalEntryMutationVariables = Exact<{
  input: UpdatePersonalEntryInput;
}>;


export type UpdatePersonalEntryMutation = { updatePersonalEntry: { __typename: 'PersonalEntry', id: string, type: PersonalEntryType, amount: number, currency: string, category: string | null, date: string, description: string | null, createdAt: string, createdById: string } };

export type DeletePersonalEntryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeletePersonalEntryMutation = { deletePersonalEntry: boolean };

export type ProjectFieldsFragment = { __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, totalIncome: number, totalExpenses: number, currency: string, status: ProjectStatus, userId: string, createdAt: string, updatedAt: string };

export type ProjectTransactionFieldsFragment = { __typename: 'ProjectTransaction', id: string, amount: number, type: ProjectTransactionType, category: string | null, description: string | null, date: string, projectId: string, createdAt: string, updatedAt: string, contactId: string | null, contactTransactionType: TransactionType | null, isMirroredFromContact: boolean, contact: { __typename: 'Contact', id: string, name: string } | null, transaction: { __typename: 'Transaction', id: string, type: TransactionType, status: TransactionStatus, remainingAmount: number | null } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, userId: string, user: { __typename: 'User', id: string, email: string, firstName: string, lastName: string } | null }> | null, history: Array<{ __typename: 'ProjectTransactionHistory', id: string, changeType: string, previousState: Record<string, unknown>, newState: Record<string, unknown>, createdAt: string }> | null };

export type ProjectContactOutstandingLoansQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
  contactId: Scalars['ID']['input'];
  contactTransactionType?: InputMaybe<TransactionType>;
}>;


export type ProjectContactOutstandingLoansQuery = { projectContactOutstandingLoans: Array<{ __typename: 'Transaction', id: string, type: TransactionType, amount: number | null, currency: string, remainingAmount: number | null, date: string }> };

export type GetMyProjectsQueryVariables = Exact<{
  filter?: InputMaybe<FilterProjectInput>;
}>;


export type GetMyProjectsQuery = { myProjects: { __typename: 'PaginatedProjectsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, totalIncome: number, totalExpenses: number, currency: string, status: ProjectStatus, userId: string, createdAt: string, updatedAt: string }> } };

export type GetProjectQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  filter?: InputMaybe<FilterProjectTransactionInput>;
}>;


export type GetProjectQuery = { project: { __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, totalIncome: number, totalExpenses: number, currency: string, status: ProjectStatus, userId: string, createdAt: string, updatedAt: string, transactions: { __typename: 'PaginatedProjectTransactionsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'ProjectTransaction', id: string, amount: number, type: ProjectTransactionType, category: string | null, description: string | null, date: string, projectId: string, createdAt: string, updatedAt: string, contactId: string | null, contactTransactionType: TransactionType | null, isMirroredFromContact: boolean, contact: { __typename: 'Contact', id: string, name: string } | null, transaction: { __typename: 'Transaction', id: string, type: TransactionType, status: TransactionStatus, remainingAmount: number | null } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, userId: string, user: { __typename: 'User', id: string, email: string, firstName: string, lastName: string } | null }> | null, history: Array<{ __typename: 'ProjectTransactionHistory', id: string, changeType: string, previousState: Record<string, unknown>, newState: Record<string, unknown>, createdAt: string }> | null }> } | null } };

export type CreateProjectMutationVariables = Exact<{
  input: CreateProjectInput;
}>;


export type CreateProjectMutation = { createProject: { __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, totalIncome: number, totalExpenses: number, currency: string, status: ProjectStatus, userId: string, createdAt: string, updatedAt: string } };

export type UpdateProjectMutationVariables = Exact<{
  input: UpdateProjectInput;
}>;


export type UpdateProjectMutation = { updateProject: { __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, totalIncome: number, totalExpenses: number, currency: string, status: ProjectStatus, userId: string, createdAt: string, updatedAt: string } };

export type LogProjectTransactionMutationVariables = Exact<{
  input: LogProjectTransactionInput;
}>;


export type LogProjectTransactionMutation = { logProjectTransaction: { __typename: 'ProjectTransaction', id: string, amount: number, type: ProjectTransactionType, category: string | null, description: string | null, date: string, projectId: string, createdAt: string, updatedAt: string, contactId: string | null, contactTransactionType: TransactionType | null, isMirroredFromContact: boolean, contact: { __typename: 'Contact', id: string, name: string } | null, transaction: { __typename: 'Transaction', id: string, type: TransactionType, status: TransactionStatus, remainingAmount: number | null } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, userId: string, user: { __typename: 'User', id: string, email: string, firstName: string, lastName: string } | null }> | null, history: Array<{ __typename: 'ProjectTransactionHistory', id: string, changeType: string, previousState: Record<string, unknown>, newState: Record<string, unknown>, createdAt: string }> | null } };

export type UpdateProjectTransactionMutationVariables = Exact<{
  input: UpdateProjectTransactionInput;
}>;


export type UpdateProjectTransactionMutation = { updateProjectTransaction: { __typename: 'ProjectTransaction', id: string, amount: number, type: ProjectTransactionType, category: string | null, description: string | null, date: string, projectId: string, createdAt: string, updatedAt: string, contactId: string | null, contactTransactionType: TransactionType | null, isMirroredFromContact: boolean, contact: { __typename: 'Contact', id: string, name: string } | null, transaction: { __typename: 'Transaction', id: string, type: TransactionType, status: TransactionStatus, remainingAmount: number | null } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, userId: string, user: { __typename: 'User', id: string, email: string, firstName: string, lastName: string } | null }> | null, history: Array<{ __typename: 'ProjectTransactionHistory', id: string, changeType: string, previousState: Record<string, unknown>, newState: Record<string, unknown>, createdAt: string }> | null } };

export type RemoveProjectTransactionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveProjectTransactionMutation = { removeProjectTransaction: { __typename: 'ProjectTransaction', id: string } };

export type ProjectTransactionCategorySuggestionsQueryVariables = Exact<{
  projectId: Scalars['ID']['input'];
}>;


export type ProjectTransactionCategorySuggestionsQuery = { projectTransactionCategorySuggestions: Array<string> };

export type MyPromisesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyPromisesQuery = { myPromises: Array<{ __typename: 'Promise', id: string, description: string, promiseTo: string, dueDate: string, priority: Priority, status: PromiseStatus, category: string | null, notes: string | null, createdAt: string, updatedAt: string }> };

export type CreatePromiseMutationVariables = Exact<{
  input: CreatePromiseInput;
}>;


export type CreatePromiseMutation = { createPromise: { __typename: 'Promise', id: string, description: string, promiseTo: string, dueDate: string, priority: Priority, status: PromiseStatus } };

export type UpdatePromiseMutationVariables = Exact<{
  input: UpdatePromiseInput;
}>;


export type UpdatePromiseMutation = { updatePromise: { __typename: 'Promise', id: string, description: string, priority: Priority, status: PromiseStatus } };

export type RemovePromiseMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type RemovePromiseMutation = { removePromise: { __typename: 'Promise', id: string } };

export type MyAccessGrantsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyAccessGrantsQuery = { myAccessGrants: Array<{ __typename: 'AccessGrant', id: string, email: string, token: string, status: AccessStatus, createdAt: string, expiresAt: string | null }> };

export type GrantAccessMutationVariables = Exact<{
  input: GrantAccessInput;
}>;


export type GrantAccessMutation = { grantAccess: { __typename: 'AccessGrant', id: string, email: string, status: AccessStatus } };

export type RevokeAccessMutationVariables = Exact<{
  id: Scalars['String']['input'];
}>;


export type RevokeAccessMutation = { revokeAccess: { __typename: 'AccessGrant', id: string, status: AccessStatus } };

export type ReceivedAccessGrantsQueryVariables = Exact<{ [key: string]: never; }>;


export type ReceivedAccessGrantsQuery = { receivedAccessGrants: Array<{ __typename: 'AccessGrant', id: string, email: string, token: string, status: AccessStatus, createdAt: string, granter: { __typename: 'User', id: string, firstName: string, lastName: string, email: string } | null }> };

export type AcceptAccessMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type AcceptAccessMutation = { acceptAccess: { __typename: 'AccessGrant', id: string, status: AccessStatus } };

export type SharedDataQueryVariables = Exact<{
  grantId: Scalars['String']['input'];
}>;


export type SharedDataQuery = { sharedData: { __typename: 'SharedDataEntity', user: { __typename: 'User', id: string, firstName: string, lastName: string, email: string } | null, transactions: Array<{ __typename: 'Transaction', id: string, amount: number | null, currency: string, type: TransactionType, date: string, description: string | null, category: AssetCategory, itemName: string | null, quantity: number | null, contact: { __typename: 'Contact', name: string } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, user: { __typename: 'User', name: string } | null }> | null }> | null, promises: Array<{ __typename: 'Promise', id: string, description: string, promiseTo: string, dueDate: string, priority: Priority, status: PromiseStatus, notes: string | null }> | null, projects: Array<{ __typename: 'Project', id: string, name: string, description: string | null, budget: number | null, balance: number, currency: string, createdAt: string, updatedAt: string }> | null } };

export type MySubscriptionQueryVariables = Exact<{ [key: string]: never; }>;


export type MySubscriptionQuery = { mySubscription: { __typename: 'SubscriptionInfo', tier: string, featureUsage: Record<string, unknown> | null, subscriptionStatus: string | null, cancelAtPeriodEnd: boolean | null, currentPeriodEnd: string | null, limits: { __typename: 'TierLimitsEntity', maxContacts: number, maxWitnessesPerMonth: number, maxNotes: number, contactNotificationSms: number, allowSMS: boolean, allowAdvancedAnalytics: boolean, allowProfessionalReports: boolean, allowOrganisations: boolean } } };

export type ProPricingQueryVariables = Exact<{ [key: string]: never; }>;


export type ProPricingQuery = { proPricing: { __typename: 'ProPricing', currencies: Array<{ __typename: 'CurrencyPricing', currency: string, monthly: number, annual: number }>, freeLimits: { __typename: 'TierLimitsEntity', maxContacts: number, maxWitnessesPerMonth: number, maxNotes: number, contactNotificationSms: number, allowSMS: boolean, allowAdvancedAnalytics: boolean, allowProfessionalReports: boolean, allowOrganisations: boolean }, proLimits: { __typename: 'TierLimitsEntity', maxContacts: number, maxWitnessesPerMonth: number, maxNotes: number, contactNotificationSms: number, allowSMS: boolean, allowAdvancedAnalytics: boolean, allowProfessionalReports: boolean, allowOrganisations: boolean } } };

export type TotalBalanceQueryVariables = Exact<{
  currency?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<FilterTransactionInput>;
}>;


export type TotalBalanceQuery = { totalBalance: { __typename: 'TransactionsSummary', totalLoanGiven: number, totalLoanReceived: number, totalRepaymentMade: number, totalRepaymentReceived: number, totalGiftGiven: number, totalGiftReceived: number, totalAdvancePaid: number, totalAdvanceReceived: number, totalDepositPaid: number, totalDepositReceived: number, totalEscrowed: number, totalRemitted: number, netBalance: number, currency: string } };

export type TransactionQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type TransactionQuery = { transaction: { __typename: 'Transaction', id: string, amount: number | null, category: AssetCategory, type: TransactionType, status: TransactionStatus, currency: string, date: string, description: string | null, itemName: string | null, quantity: number | null, createdAt: string | null, parentId: string | null, orgId: string | null, projectTransactionId: string | null, isMirroredFromProject: boolean, orgSourceTransactionId: string | null, orgSourceTransaction: { __typename: 'Transaction', id: string, organisation: { __typename: 'Organisation', id: string, name: string, slug: string } | null, projectTransaction: { __typename: 'ProjectTransaction', id: string, project: { __typename: 'Project', id: string, name: string } | null } | null } | null, projectTransaction: { __typename: 'ProjectTransaction', id: string, projectId: string, project: { __typename: 'Project', id: string, name: string } | null } | null, conversions: Array<{ __typename: 'Transaction', id: string, amount: number | null, type: TransactionType, currency: string, date: string, status: TransactionStatus }> | null, contact: { __typename: 'Contact', id: string, name: string, isSupporter: boolean } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, invitedAt: string, acknowledgedAt: string | null, user: { __typename: 'User', id: string, name: string, email: string, isSupporter: boolean } | null }> | null, history: Array<{ __typename: 'TransactionHistory', id: string, changeType: string, previousState: Record<string, unknown>, newState: Record<string, unknown>, createdAt: string, user: { __typename: 'User', id: string, name: string, email: string, isSupporter: boolean } | null }> | null } };

export type RemoveTransactionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RemoveTransactionMutation = { removeTransaction: { __typename: 'Transaction', id: string } };

export type TransactionsQueryVariables = Exact<{
  filter?: InputMaybe<FilterTransactionInput>;
}>;


export type TransactionsQuery = { transactions: { __typename: 'TransactionsResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Transaction', id: string, amount: number | null, category: AssetCategory, type: TransactionType, status: TransactionStatus, currency: string, date: string, description: string | null, itemName: string | null, quantity: number | null, createdAt: string | null, parentId: string | null, orgId: string | null, projectTransactionId: string | null, isMirroredFromProject: boolean, orgSourceTransactionId: string | null, orgSourceTransaction: { __typename: 'Transaction', id: string, organisation: { __typename: 'Organisation', id: string, name: string, slug: string } | null, projectTransaction: { __typename: 'ProjectTransaction', id: string, project: { __typename: 'Project', id: string, name: string } | null } | null } | null, projectTransaction: { __typename: 'ProjectTransaction', id: string, projectId: string, project: { __typename: 'Project', id: string, name: string } | null } | null, createdBy: { __typename: 'User', id: string, name: string, isSupporter: boolean } | null, contact: { __typename: 'Contact', id: string, name: string, isSupporter: boolean } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus }> | null }>, summary: { __typename: 'TransactionsSummary', totalLoanGiven: number, totalLoanReceived: number, totalRepaymentMade: number, totalRepaymentReceived: number, totalGiftGiven: number, totalGiftReceived: number, totalAdvancePaid: number, totalAdvanceReceived: number, totalDepositPaid: number, totalDepositReceived: number, totalEscrowed: number, totalRemitted: number, netBalance: number, currency: string } } };

export type MyContactTransactionsQueryVariables = Exact<{
  filter?: InputMaybe<FilterSharedHistoryInput>;
}>;


export type MyContactTransactionsQuery = { myContactTransactions: { __typename: 'PaginatedSharedHistoryResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Transaction', id: string, amount: number | null, category: AssetCategory, type: TransactionType, status: TransactionStatus, currency: string, date: string, description: string | null, itemName: string | null, quantity: number | null, createdAt: string | null, parentId: string | null, createdBy: { __typename: 'User', id: string, name: string, email: string, isSupporter: boolean } | null, contact: { __typename: 'Contact', id: string, name: string, isSupporter: boolean } | null, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, invitedAt: string, acknowledgedAt: string | null, user: { __typename: 'User', id: string, name: string, email: string, isSupporter: boolean } | null }> | null }> } };

export type TransactionsGroupedByContactQueryVariables = Exact<{
  filter?: InputMaybe<FilterTransactionInput>;
}>;


export type TransactionsGroupedByContactQuery = { transactionsGroupedByContact: Array<{ __typename: 'ContactGroupedSummary', contact: { __typename: 'Contact', id: string, name: string, isSupporter: boolean } | null, summary: { __typename: 'TransactionsSummary', totalLoanGiven: number, totalLoanReceived: number, totalRepaymentMade: number, totalRepaymentReceived: number, totalGiftGiven: number, totalGiftReceived: number, totalAdvancePaid: number, totalAdvanceReceived: number, totalDepositPaid: number, totalDepositReceived: number, totalEscrowed: number, totalRemitted: number, netBalance: number, currency: string } }> };

export type CreateTransactionMutationVariables = Exact<{
  input: CreateTransactionInput;
}>;


export type CreateTransactionMutation = { createTransaction: { __typename: 'Transaction', id: string, amount: number | null, type: TransactionType, currency: string, description: string | null, date: string, parentId: string | null } };

export type AddWitnessMutationVariables = Exact<{
  input: AddWitnessInput;
}>;


export type AddWitnessMutation = { addWitness: { __typename: 'Transaction', id: string, witnesses: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, invitedAt: string, user: { __typename: 'User', id: string, name: string, email: string, isSupporter: boolean } | null }> | null } };

export type UpdateTransactionMutationVariables = Exact<{
  input: UpdateTransactionInput;
}>;


export type UpdateTransactionMutation = { updateTransaction: { __typename: 'Transaction', id: string, amount: number | null, category: AssetCategory, type: TransactionType, currency: string, date: string, description: string | null, itemName: string | null, quantity: number | null, contact: { __typename: 'Contact', id: string, name: string, isSupporter: boolean } | null } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { updateUser: { __typename: 'User', id: string, firstName: string, lastName: string, phoneNumber: string | null, email: string, preferredCurrency: string } };

export type MarkSharedHistorySeenMutationVariables = Exact<{ [key: string]: never; }>;


export type MarkSharedHistorySeenMutation = { markSharedHistorySeen: boolean };

export type SearchWitnessQueryVariables = Exact<{
  input: SearchWitnessInput;
}>;


export type SearchWitnessQuery = { searchWitness: { __typename: 'WitnessCandidate', id: string, firstName: string, lastName: string } | null };

export type MyWitnessRequestsQueryVariables = Exact<{
  status?: InputMaybe<WitnessStatus>;
  filter?: InputMaybe<FilterWitnessInput>;
}>;


export type MyWitnessRequestsQuery = { myWitnessRequests: { __typename: 'PaginatedWitnessesResponse', total: number, page: number, limit: number, items: Array<{ __typename: 'Witness', id: string, status: WitnessStatus, invitedAt: string, acknowledgedAt: string | null, transaction: { __typename: 'Transaction', id: string, amount: number | null, currency: string, type: TransactionType, category: AssetCategory, itemName: string | null, description: string | null, date: string, createdBy: { __typename: 'User', name: string, email: string, isSupporter: boolean } | null, contact: { __typename: 'Contact', id: string, firstName: string, lastName: string, name: string, isSupporter: boolean } | null } | null }> } };

export type ResendWitnessInvitationMutationVariables = Exact<{
  witnessId: Scalars['ID']['input'];
}>;


export type ResendWitnessInvitationMutation = { resendWitnessInvitation: { __typename: 'Witness', id: string, status: WitnessStatus, invitedAt: string } };

export type RemoveWitnessMutationVariables = Exact<{
  witnessId: Scalars['ID']['input'];
}>;


export type RemoveWitnessMutation = { removeWitness: { __typename: 'Witness', id: string } };

export type AcknowledgeWitnessRequestMutationVariables = Exact<{
  input: AcknowledgeWitnessInput;
}>;


export type AcknowledgeWitnessRequestMutation = { acknowledgeWitness: { __typename: 'Witness', id: string, status: WitnessStatus, acknowledgedAt: string | null } };

export type GetWitnessInvitationQueryVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type GetWitnessInvitationQuery = { getWitnessInvitation: { __typename: 'Witness', id: string, status: WitnessStatus, transaction: { __typename: 'Transaction', id: string, amount: number | null, currency: string, type: TransactionType, category: AssetCategory, itemName: string | null, description: string | null, date: string, createdBy: { __typename: 'User', name: string, isSupporter: boolean } | null, contact: { __typename: 'Contact', id: string, firstName: string, lastName: string, name: string, isSupporter: boolean } | null } | null, user: { __typename: 'User', id: string, email: string, name: string, passwordHash: string | null, isSupporter: boolean } | null } };
