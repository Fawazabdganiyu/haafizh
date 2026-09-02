import { gql } from "@apollo/client";

export const PROJECT_FRAGMENT = gql`
  fragment ProjectFields on Project {
    id
    name
    description
    budget
    balance
    totalIncome
    totalExpenses
    currency
    status
    userId
    createdAt
    updatedAt
  }
`;

export const PROJECT_TRANSACTION_FRAGMENT = gql`
  fragment ProjectTransactionFields on ProjectTransaction {
    id
    amount
    type
    category
    description
    date
    projectId
    createdAt
    updatedAt
    contactId
    contactTransactionType
    isMirroredFromContact
    contact {
      id
      name
    }
    transaction {
      id
      type
      status
      remainingAmount
    }
    witnesses {
      id
      status
      userId
      user {
        id
        email
        firstName
        lastName
      }
    }
    history {
      id
      changeType
      previousState
      newState
      createdAt
    }
  }
`;

export const GET_PROJECT_CONTACT_OUTSTANDING_LOANS = gql`
  query ProjectContactOutstandingLoans(
    $projectId: ID!
    $contactId: ID!
    $contactTransactionType: TransactionType
  ) {
    projectContactOutstandingLoans(
      projectId: $projectId
      contactId: $contactId
      contactTransactionType: $contactTransactionType
    ) {
      id
      type
      amount
      currency
      remainingAmount
      date
    }
  }
`;

export const GET_MY_PROJECTS = gql`
  ${PROJECT_FRAGMENT}
  query GetMyProjects($filter: FilterProjectInput) {
    myProjects(filter: $filter) {
      items {
        ...ProjectFields
      }
      total
      page
      limit
    }
  }
`;

export const GET_PROJECT = gql`
  ${PROJECT_FRAGMENT}
  ${PROJECT_TRANSACTION_FRAGMENT}
  query GetProject($id: ID!, $filter: FilterProjectTransactionInput) {
    project(id: $id) {
      ...ProjectFields
      transactions(filter: $filter) {
        items {
          ...ProjectTransactionFields
        }
        total
        page
        limit
      }
    }
  }
`;

export const CREATE_PROJECT = gql`
  ${PROJECT_FRAGMENT}
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ...ProjectFields
    }
  }
`;

export const UPDATE_PROJECT = gql`
  ${PROJECT_FRAGMENT}
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      ...ProjectFields
    }
  }
`;

export const REMOVE_PROJECT = gql`
  mutation RemoveProject($id: ID!) {
    removeProject(id: $id) {
      id
    }
  }
`;

export const GET_PROJECT_LINKED_CONTACTS = gql`
  query GetProjectLinkedContacts($id: ID!) {
    project(id: $id) {
      id
      linkedContacts {
        id
        name
      }
    }
  }
`;

export const LOG_PROJECT_TRANSACTION = gql`
  ${PROJECT_TRANSACTION_FRAGMENT}
  mutation LogProjectTransaction($input: LogProjectTransactionInput!) {
    logProjectTransaction(input: $input) {
      ...ProjectTransactionFields
    }
  }
`;

export const UPDATE_PROJECT_TRANSACTION = gql`
  ${PROJECT_TRANSACTION_FRAGMENT}
  mutation UpdateProjectTransaction($input: UpdateProjectTransactionInput!) {
    updateProjectTransaction(input: $input) {
      ...ProjectTransactionFields
    }
  }
`;

export const REMOVE_PROJECT_TRANSACTION = gql`
  mutation RemoveProjectTransaction($id: ID!) {
    removeProjectTransaction(id: $id) {
      id
    }
  }
`;

export const PROJECT_TRANSACTION_CATEGORY_SUGGESTIONS = gql`
  query ProjectTransactionCategorySuggestions($projectId: ID!) {
    projectTransactionCategorySuggestions(projectId: $projectId)
  }
`;
