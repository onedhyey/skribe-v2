"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pastel colors for context icons - cycles through 6 colors
const PASTEL_COLORS = [
  "bg-pastel-rose",
  "bg-pastel-lavender",
  "bg-pastel-sky",
  "bg-pastel-mint",
  "bg-pastel-peach",
  "bg-pastel-lemon",
] as const;

function getContextColor(index: number): string {
  return PASTEL_COLORS[index % PASTEL_COLORS.length];
}

interface RecentContextListProps {
  projectId: string;
  collapsed?: boolean;
}

export function RecentContextList({ projectId, collapsed = false }: RecentContextListProps) {
  const pathname = usePathname();

  const recentDocuments = useQuery(
    api.documents.getRecentByProject,
    projectId ? { projectId: projectId as Id<"projects">, limit: 10 } : "skip"
  );

  if (recentDocuments === undefined) {
    return (
      <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Context
          </h3>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "animate-pulse rounded-lg bg-muted",
                collapsed ? "h-8 w-8" : "h-8 w-full"
              )}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (recentDocuments.length === 0) {
    if (collapsed) {
      return null;
    }
    return (
      <div className="px-3 py-2">
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Context
        </h3>
        <p className="px-3 text-xs text-muted-foreground">
          No context documents yet. Start by creating one above.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
      {!collapsed && (
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Context
        </h3>
      )}
      <ul className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        {recentDocuments.map((doc, index) => {
          const docPath = `/p/${projectId}/d/${doc._id}`;
          const isActive = pathname === docPath;
          const colorClass = getContextColor(index);

          return (
            <li key={doc._id}>
              <Link
                href={docPath}
                className={cn(
                  "flex items-center rounded-lg text-sm transition-colors",
                  collapsed ? "justify-center p-1.5" : "gap-2 px-3 py-2",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={collapsed ? doc.title : undefined}
              >
                <span className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded", colorClass)}>
                  <ContextIcon className="h-3 w-3 text-foreground/70" />
                </span>
                <span
                  className={cn(
                    "truncate transition-[opacity,width] duration-300 ease-in-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                  )}
                >
                  {doc.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContextIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
