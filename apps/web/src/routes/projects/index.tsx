import { createFileRoute, Link } from "@tanstack/react-router";
import { Filter, FolderKanban, Plus, Search } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/ui/page-loader";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectFilters } from "@/hooks/useProjectFilters";
import { useProjects } from "@/hooks/useProjects";
import type { ProjectFieldsFragment } from "@/types/__generated__/graphql";
import { authGuard } from "@/utils/auth";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
  beforeLoad: (ctx) => authGuard({ location: ctx.location }),
});

function ProjectsPage() {
  const {
    search,
    setSearch,
    status,
    setStatus,
    balanceStanding,
    setBalanceStanding,
    page,
    setPage,
    limit,
    setLimit,
    variables,
  } = useProjectFilters();

  const {
    projects,
    total,
    loading,
    updateProject,
    updatingProjectId,
    removeProject,
    removingProjectId,
  } = useProjects(variables.filter);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground font-medium opacity-70">
            Manage your project funds and expenses.
          </p>
        </div>
        <Button
          asChild
          className="shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <Link to="/projects/new">
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="sm:w-[160px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={balanceStanding}
          onValueChange={(v) => setBalanceStanding(v as typeof balanceStanding)}
        >
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Budget Standing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            <SelectItem value="UNDER_BUDGET">Under Budget</SelectItem>
            <SelectItem value="OVER_BUDGET">Over Budget</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <BrandLoader size="md" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border/40 py-20 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-primary/5 rounded-full flex items-center justify-center">
              <FolderKanban className="w-7 h-7 text-primary/40" />
            </div>
          </div>
          <h3 className="text-lg font-semibold tracking-tight">No projects found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            {search || status !== "ALL" || balanceStanding !== "ALL"
              ? "Try adjusting your filters."
              : "Create a project to start tracking funds."}
          </p>
          {!search && status === "ALL" && balanceStanding === "ALL" && (
            <Button asChild variant="outline">
              <Link to="/projects/new">Create Project</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: ProjectFieldsFragment) => (
              <ProjectCard
                key={project.id}
                project={project}
                onUpdate={updateProject}
                updating={updatingProjectId === project.id}
                onDelete={removeProject}
                removingProject={removingProjectId === project.id}
              />
            ))}
          </div>
          <Pagination
            total={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />
        </>
      )}
    </div>
  );
}
