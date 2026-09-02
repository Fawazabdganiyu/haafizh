import type { ApolloCache } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useState } from "react";
import {
  CREATE_PROJECT,
  GET_MY_PROJECTS,
  GET_PROJECT,
  LOG_PROJECT_TRANSACTION,
  REMOVE_PROJECT,
  REMOVE_PROJECT_TRANSACTION,
  UPDATE_PROJECT,
} from "@/lib/apollo/queries/projects";
import type {
  CreateProjectInput,
  CreateProjectMutation,
  FilterProjectInput,
  FilterProjectTransactionInput,
  GetMyProjectsQuery,
  GetProjectQuery,
  LogProjectTransactionInput,
  LogProjectTransactionMutation,
  RemoveProjectMutation,
  RemoveProjectTransactionMutation,
  UpdateProjectInput,
  UpdateProjectMutation,
} from "@/types/__generated__/graphql";

/** Shared by useProjects and useProject's REMOVE_PROJECT mutations: drops the
 * deleted project's own cache entry plus the myProjects list so both surfaces
 * stop referencing it. */
function evictRemovedProject(cache: ApolloCache, projectId: string | undefined) {
  const cacheId = cache.identify({ __typename: "Project", id: projectId });
  if (cacheId) cache.evict({ id: cacheId });
  cache.evict({ fieldName: "myProjects" });
  cache.gc();
}

export function useProjects(filter?: FilterProjectInput) {
  const { data, loading, error, refetch } = useQuery<GetMyProjectsQuery>(GET_MY_PROJECTS, {
    variables: { filter },
    fetchPolicy: "cache-and-network",
  });

  const [createProjectMutation, { loading: creating }] = useMutation<CreateProjectMutation>(
    CREATE_PROJECT,
    {
      onCompleted: () => refetch(),
      update: (cache) => {
        cache.evict({ fieldName: "myProjects" });
        cache.gc();
      },
    },
  );

  const createProject = async (input: CreateProjectInput) => {
    const result = await createProjectMutation({ variables: { input } });
    await refetch();
    return result;
  };

  // A single useMutation instance's `loading` flag is shared by every card on
  // the page — tracking the in-flight project's own id lets each ProjectCard
  // check "is *this* project mutating" instead of every card reacting to
  // whichever one is currently being edited/deleted.
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);
  const [removingProjectId, setRemovingProjectId] = useState<string | null>(null);

  const [updateProjectMutation] = useMutation<UpdateProjectMutation>(UPDATE_PROJECT);

  const updateProject = async (input: UpdateProjectInput) => {
    setUpdatingProjectId(input.id);
    try {
      const result = await updateProjectMutation({ variables: { input } });
      await refetch();
      return result;
    } finally {
      setUpdatingProjectId(null);
    }
  };

  const [removeProjectMutation] = useMutation<RemoveProjectMutation>(REMOVE_PROJECT, {
    update: (cache, _result, { variables }) => evictRemovedProject(cache, variables?.id),
  });

  const removeProject = async (id: string) => {
    setRemovingProjectId(id);
    try {
      const result = await removeProjectMutation({ variables: { id } });
      await refetch();
      return result;
    } finally {
      setRemovingProjectId(null);
    }
  };

  return {
    projects: data?.myProjects.items || [],
    total: data?.myProjects.total ?? 0,
    page: data?.myProjects.page ?? 1,
    limit: data?.myProjects.limit ?? 25,
    loading,
    error,
    createProject,
    creating,
    updateProject,
    updatingProjectId,
    removeProject,
    removingProjectId,
    refetch,
  };
}

export function useProject(id: string, transactionFilter?: FilterProjectTransactionInput) {
  const { data, loading, error, refetch } = useQuery<GetProjectQuery>(GET_PROJECT, {
    variables: { id, filter: transactionFilter },
    skip: !id,
    fetchPolicy: "cache-and-network",
  });

  const [updateProjectMutation, { loading: updating }] = useMutation<UpdateProjectMutation>(
    UPDATE_PROJECT,
    {
      onCompleted: () => refetch(),
    },
  );

  const [logTransactionMutation, { loading: logging }] = useMutation<LogProjectTransactionMutation>(
    LOG_PROJECT_TRANSACTION,
    {
      onCompleted: () => refetch(),
      refetchQueries: ["GetMyProjects", "GetProject"],
      update: (cache) => {
        cache.evict({ fieldName: "myProjects" });
        cache.gc();
      },
    },
  );

  const updateProject = async (input: UpdateProjectInput) => {
    return updateProjectMutation({ variables: { input } });
  };

  const logTransaction = async (input: LogProjectTransactionInput) => {
    return logTransactionMutation({ variables: { input } });
  };

  const [removeTransactionMutation, { loading: removing }] =
    useMutation<RemoveProjectTransactionMutation>(REMOVE_PROJECT_TRANSACTION, {
      refetchQueries: ["GetMyProjects", "GetProject"],
    });

  const removeTransaction = async (transactionId: string) => {
    return removeTransactionMutation({ variables: { id: transactionId } });
  };

  const [removeProjectMutation, { loading: removingProject }] = useMutation<RemoveProjectMutation>(
    REMOVE_PROJECT,
    {
      update: (cache, _result, { variables }) => evictRemovedProject(cache, variables?.id),
    },
  );

  const removeProject = async (projectId: string) => {
    return removeProjectMutation({ variables: { id: projectId } });
  };

  return {
    project: data?.project,
    transactions: data?.project?.transactions?.items || [],
    transactionsTotal: data?.project?.transactions?.total ?? 0,
    transactionsPage: data?.project?.transactions?.page ?? 1,
    transactionsLimit: data?.project?.transactions?.limit ?? 25,
    loading,
    error,
    updateProject,
    updating,
    logTransaction,
    logging,
    removeTransaction,
    removing,
    removeProject,
    removingProject,
    refetch,
  };
}
