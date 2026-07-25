import { gql, type TypedDocumentNode } from "@apollo/client";
import type {
  AddWitnessMutation,
  AddWitnessMutationVariables,
  CreateTransactionMutation,
  CreateTransactionMutationVariables,
  MyContactTransactionsQuery,
  MyContactTransactionsQueryVariables,
  RemoveTransactionMutation,
  RemoveTransactionMutationVariables,
  TotalBalanceQuery,
  TotalBalanceQueryVariables,
  TransactionQuery,
  TransactionQueryVariables,
  TransactionsGroupedByContactQuery,
  TransactionsQuery,
  TransactionsQueryVariables,
  UpdateTransactionMutation,
  UpdateTransactionMutationVariables,
} from "@/types/__generated__/graphql";

export const GET_TOTAL_BALANCE: TypedDocumentNode<TotalBalanceQuery, TotalBalanceQueryVariables> =
  gql`
  query TotalBalance($currency: String, $filter: FilterTransactionInput) {
    totalBalance(currency: $currency, filter: $filter) {
      totalLoanGiven
      totalLoanReceived
      totalRepaymentMade
      totalRepaymentReceived
      totalGiftGiven
      totalGiftReceived
      totalAdvancePaid
      totalAdvanceReceived
      totalDepositPaid
      totalDepositReceived
      totalEscrowed
      totalRemitted
      netBalance
      currency
    }
  }
`;

export const GET_TRANSACTION: TypedDocumentNode<TransactionQuery, TransactionQueryVariables> = gql`
  query Transaction($id: ID!) {
    transaction(id: $id) {
      id
      amount
      category
      type
      status
      currency
      date
      description
      itemName
      quantity
      createdAt
      parentId
      orgId
      projectTransactionId
      isMirroredFromProject
      orgSourceTransactionId
      orgSourceTransaction {
        id
        organisation {
          id
          name
          slug
        }
        projectTransaction {
          id
          project {
            id
            name
          }
        }
      }
      projectTransaction {
        id
        projectId
        project {
          id
          name
        }
      }
      conversions {
        id
        amount
        type
        currency
        date
        status
      }
      contact {
        id
        name
        isSupporter
      }
      witnesses {
        id
        status
        invitedAt
        acknowledgedAt
        user {
          id
          name
          email
          isSupporter
        }
      }
      history {
        id
        changeType
        previousState
        newState
        createdAt
        user {
          id
          name
          email
          isSupporter
        }
      }
    }
  }
`;

export const REMOVE_TRANSACTION: TypedDocumentNode<
  RemoveTransactionMutation,
  RemoveTransactionMutationVariables
> = gql`
  mutation RemoveTransaction($id: ID!) {
    removeTransaction(id: $id) {
      id
    }
  }
`;

export const GET_TRANSACTIONS: TypedDocumentNode<TransactionsQuery, TransactionsQueryVariables> =
  gql`
  query Transactions($filter: FilterTransactionInput) {
    transactions(filter: $filter) {
      items {
        id
        amount
        category
        type
        status
        currency
        date
        description
        itemName
        quantity
        createdAt
        parentId
        orgId
        projectTransactionId
        isMirroredFromProject
        orgSourceTransactionId
        orgSourceTransaction {
          id
          organisation {
            id
            name
            slug
          }
          projectTransaction {
            id
            project {
              id
              name
            }
          }
        }
        projectTransaction {
          id
          projectId
          project {
            id
            name
          }
        }
        createdBy {
          id
          name
          isSupporter
        }
        contact {
          id
          name
          isSupporter
        }
        witnesses {
          id
          status
        }
      }
      total
      page
      limit
      summary {
        totalLoanGiven
        totalLoanReceived
        totalRepaymentMade
        totalRepaymentReceived
        totalGiftGiven
        totalGiftReceived
        totalAdvancePaid
        totalAdvanceReceived
        totalDepositPaid
        totalDepositReceived
        totalEscrowed
        totalRemitted
        netBalance
        currency
      }
    }
  }
`;

export const GET_MY_CONTACT_TRANSACTIONS: TypedDocumentNode<
  MyContactTransactionsQuery,
  MyContactTransactionsQueryVariables
> = gql`
  query MyContactTransactions($filter: FilterSharedHistoryInput) {
    myContactTransactions(filter: $filter) {
      items {
        id
        amount
        category
        type
        status
        currency
        date
        description
        itemName
        quantity
        createdAt
        parentId
        createdBy {
          id
          name
          email
          isSupporter
        }
        contact {
          id
          name
          isSupporter
        }
        witnesses {
          id
          status
          invitedAt
          acknowledgedAt
          user {
            id
            name
            email
            isSupporter
          }
        }
      }
      total
      page
      limit
    }
  }
`;

export const GET_TRANSACTIONS_GROUPED_BY_CONTACT: TypedDocumentNode<
  TransactionsGroupedByContactQuery,
  TransactionsQueryVariables
> = gql`
  query TransactionsGroupedByContact($filter: FilterTransactionInput) {
    transactionsGroupedByContact(filter: $filter) {
      contact {
        id
        name
        isSupporter
      }
      summary {
        totalLoanGiven
        totalLoanReceived
        totalRepaymentMade
        totalRepaymentReceived
        totalGiftGiven
        totalGiftReceived
        totalAdvancePaid
        totalAdvanceReceived
        totalDepositPaid
        totalDepositReceived
        totalEscrowed
        totalRemitted
        netBalance
        currency
      }
    }
  }
`;

export const CREATE_TRANSACTION: TypedDocumentNode<
  CreateTransactionMutation,
  CreateTransactionMutationVariables
> = gql`
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      id
      amount
      type
      currency
      description
      date
      parentId
    }
  }
`;

export const ADD_WITNESS: TypedDocumentNode<AddWitnessMutation, AddWitnessMutationVariables> = gql`
  mutation AddWitness($input: AddWitnessInput!) {
    addWitness(input: $input) {
      id
      witnesses {
        id
        status
        invitedAt
        user {
          id
          name
          email
          isSupporter
        }
      }
    }
  }
`;

export const UPDATE_TRANSACTION: TypedDocumentNode<
  UpdateTransactionMutation,
  UpdateTransactionMutationVariables
> = gql`
  mutation UpdateTransaction($input: UpdateTransactionInput!) {
    updateTransaction(input: $input) {
      id
      amount
      category
      type
      currency
      date
      description
      itemName
      quantity
      contact {
        id
        name
        isSupporter
      }
    }
  }
`;
