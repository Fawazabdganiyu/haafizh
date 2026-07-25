import { gql, type TypedDocumentNode } from "@apollo/client";
import type {
  CreateContactMutation,
  CreateContactMutationVariables,
  DeleteContactMutation,
  DeleteContactMutationVariables,
  GetContactQuery,
  GetContactQueryVariables,
  GetContactsQuery,
  GetContactsQueryVariables,
  InviteContactMutation,
  InviteContactMutationVariables,
  ResendContactInvitationMutation,
  ResendContactInvitationMutationVariables,
  ShareableContactsQuery,
  ShareableContactsQueryVariables,
  UpdateContactMutation,
  UpdateContactMutationVariables,
} from "@/types/__generated__/graphql";

export const GET_CONTACTS: TypedDocumentNode<GetContactsQuery, GetContactsQueryVariables> = gql`
  query GetContacts($filter: FilterContactInput) {
    contacts(filter: $filter) {
      items {
        id
        name
        email
        phoneNumber
        balance
        isOnPlatform
        isSupporter
        hasPendingInvitation
        createdAt
        orgId
        sourceContactId
        sharedBy {
          id
          firstName
          lastName
        }
      }
      total
      page
      limit
    }
  }
`;

export const GET_CONTACT: TypedDocumentNode<GetContactQuery, GetContactQueryVariables> = gql`
  query GetContact($id: ID!) {
    contact(id: $id) {
      id
      name
      email
      phoneNumber
      balance
      isOnPlatform
      isSupporter
      hasPendingInvitation
      createdAt
      orgId
      sourceContactId
      sharedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

/** Candidates for "From my contacts" when recording an org transaction. */
export const GET_SHAREABLE_CONTACTS: TypedDocumentNode<
  ShareableContactsQuery,
  ShareableContactsQueryVariables
> = gql`
  query ShareableContacts($filter: FilterContactInput) {
    shareableContacts(filter: $filter) {
      items {
        id
        name
        email
        phoneNumber
      }
      total
      page
      limit
    }
  }
`;

export const INVITE_CONTACT: TypedDocumentNode<
  InviteContactMutation,
  InviteContactMutationVariables
> = gql`
  mutation InviteContact($contactId: ID!) {
    inviteContactToPlatform(contactId: $contactId) {
      success
      message
    }
  }
`;

export const RESEND_CONTACT_INVITATION: TypedDocumentNode<
  ResendContactInvitationMutation,
  ResendContactInvitationMutationVariables
> = gql`
  mutation ResendContactInvitation($contactId: ID!) {
    resendContactInvitation(contactId: $contactId) {
      success
      message
    }
  }
`;

export const CREATE_CONTACT: TypedDocumentNode<
  CreateContactMutation,
  CreateContactMutationVariables
> = gql`
  mutation CreateContact($createContactInput: CreateContactInput!) {
    createContact(createContactInput: $createContactInput) {
      id
      name
      email
      phoneNumber
      balance
    }
  }
`;

export const UPDATE_CONTACT: TypedDocumentNode<
  UpdateContactMutation,
  UpdateContactMutationVariables
> = gql`
  mutation UpdateContact($updateContactInput: UpdateContactInput!) {
    updateContact(updateContactInput: $updateContactInput) {
      id
      name
      email
      phoneNumber
    }
  }
`;

export const DELETE_CONTACT: TypedDocumentNode<
  DeleteContactMutation,
  DeleteContactMutationVariables
> = gql`
  mutation DeleteContact($id: ID!) {
    removeContact(id: $id) {
      id
    }
  }
`;
