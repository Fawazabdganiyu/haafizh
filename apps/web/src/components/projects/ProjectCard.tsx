import { Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, getBalanceColorClass } from "@/lib/utils/formatters";
import type { ProjectFieldsFragment, UpdateProjectInput } from "@/types/__generated__/graphql";

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30";
    case "COMPLETED":
      return "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100";
    case "ARCHIVED":
      return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700";
    default:
      return "text-zinc-500 bg-zinc-100 border-zinc-200";
  }
}

interface ProjectCardProps {
  project: ProjectFieldsFragment;
  onUpdate: (input: UpdateProjectInput) => Promise<unknown>;
  updating: boolean;
  onDelete: (id: string) => Promise<unknown>;
  removingProject: boolean;
}

export function ProjectCard({
  project,
  onUpdate,
  updating,
  onDelete,
  removingProject,
}: ProjectCardProps) {
  const totalExpenses = project.totalExpenses ?? 0;
  const totalIncome = project.totalIncome ?? 0;
  const balance = project.balance ?? 0;

  const budgetUtilization = project.budget
    ? Math.min((totalExpenses / project.budget) * 100, 100)
    : 0;

  return (
    <div className="group relative">
      {/* Edit/Delete live outside the Link's DOM subtree entirely — a
          descendant preventDefault() to stop the Link's own navigation would
          also suppress Radix's dialog-trigger open logic, since both key off
          the same event.defaultPrevented flag. Keeping them as a sibling
          overlay avoids that conflict altogether. */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity duration-300">
        <EditProjectDialog
          project={{
            id: project.id,
            name: project.name,
            description: project.description,
            budget: project.budget,
            currency: project.currency,
            status: project.status,
          }}
          onUpdate={onUpdate}
          updating={updating}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-7 sm:w-7 bg-card/80 backdrop-blur-sm"
              aria-label="Edit project"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <DeleteProjectDialog
          projectId={project.id}
          projectName={project.name}
          onDelete={() => onDelete(project.id)}
          deleting={removingProject}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-7 sm:w-7 bg-card/80 backdrop-blur-sm text-rose-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              aria-label="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          }
        />
      </div>

      <Link
        to="/projects/$projectId"
        params={{ projectId: project.id }}
        className="block no-underline"
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-[24px] border border-border/50 bg-card p-5",
            "transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-primary/30 active:scale-[0.98]",
          )}
        >
          {/* Name + status badge on same line — right-padded so the floating
              action buttons never overlap the title or badge. */}
          <div className="flex items-center gap-2 mb-1 pr-24 sm:pr-16">
            <h3 className="flex-1 min-w-0 text-base font-bold tracking-tight leading-tight truncate">
              {project.name}
            </h3>
            <span
              className={cn(
                "shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                getStatusBadgeClass(project.status),
              )}
            >
              {project.status.toLowerCase()}
            </span>
          </div>

          {project.description && (
            <p className="text-[11px] text-muted-foreground opacity-70 truncate mb-2">
              {project.description}
            </p>
          )}

          {/* Mini-stat cells */}
          <div className="grid grid-cols-3 gap-2 mb-3 mt-3">
            <div className="bg-muted/40 rounded-[10px] p-2.5 min-w-0 overflow-hidden">
              <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-0.5 truncate">
                Balance
              </p>
              <p
                className={cn(
                  "text-sm font-black tracking-tight truncate",
                  getBalanceColorClass(balance),
                )}
              >
                {formatCurrency(balance, project.currency)}
              </p>
            </div>
            <div className="bg-muted/40 rounded-[10px] p-2.5 min-w-0 overflow-hidden">
              <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-0.5 truncate">
                Income
              </p>
              <p
                className={cn(
                  "text-sm font-black tracking-tight truncate",
                  totalIncome > 0 ? "text-emerald-600" : "text-foreground",
                )}
              >
                {formatCurrency(totalIncome, project.currency)}
              </p>
            </div>
            <div className="bg-muted/40 rounded-[10px] p-2.5 min-w-0 overflow-hidden">
              <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/60 mb-0.5 truncate">
                Expenses
              </p>
              <p
                className={cn(
                  "text-sm font-black tracking-tight truncate",
                  totalExpenses > 0 ? "text-rose-600" : "text-foreground",
                )}
              >
                {formatCurrency(totalExpenses, project.currency)}
              </p>
            </div>
          </div>

          {/* Budget row */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 min-w-0">
              {project.budget ? (
                <>
                  <div className="h-[3px] rounded-full bg-secondary/50 overflow-hidden mb-1">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${budgetUtilization}%` }}
                    />
                  </div>
                  <p className="text-[9px] font-medium text-muted-foreground">
                    {Math.round(budgetUtilization)}% of{" "}
                    {formatCurrency(project.budget, project.currency)}
                  </p>
                </>
              ) : (
                <p className="text-[9px] font-medium text-muted-foreground italic">No budget set</p>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>

          {/* Decorative glow */}
          <div className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full bg-indigo-500/5 blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-500" />
        </div>
      </Link>
    </div>
  );
}
