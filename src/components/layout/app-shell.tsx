"use client";

import { ProjectSelector } from "./project-selector";
import { GitHubNavLink } from "./github-nav-link";
import { SidebarNav } from "./sidebar-nav";
import { RecentAgentsList } from "./recent-agents-list";
import { UserNav } from "./user-nav";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  projectId: string;
  children: React.ReactNode;
}

export function AppShell({ projectId, children }: AppShellProps) {
  const { user: storedUser } = useStoreUser();
  const [now, setNow] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  // Set current time after mount to avoid hydration issues
  // Also restore collapsed state from localStorage
  useEffect(() => {
    setNow(Date.now());
    const saved = localStorage.getItem("sidebar-collapsed");
    setCollapsed(saved === "true");
  }, []);

  // Persist collapsed state to localStorage
  const toggleCollapsed = () => {
    const newValue = !collapsed;
    setCollapsed(newValue);
    localStorage.setItem("sidebar-collapsed", String(newValue));
  };

  // Check for trial status
  const isOnTrial =
    now !== null &&
    storedUser?.subscriptionStatus === "trial" &&
    storedUser?.trialEndsAt &&
    now < storedUser.trialEndsAt;

  const trialDaysLeft = storedUser?.trialEndsAt && now !== null
    ? Math.max(0, Math.ceil((storedUser.trialEndsAt - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-30 flex flex-col bg-muted border-r border-border transition-[width,opacity] duration-300 ease-in-out",
          collapsed === null ? "opacity-0 pointer-events-none w-64" : collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo and Toggle */}
        <div className={cn("flex items-center py-4", collapsed ? "px-2 justify-center" : "px-4 justify-between")}>
          <Link href={`/p/${projectId}`} className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
            <Image src="/logo.png" alt="Skribe" width={29} height={29} className="h-[29px] w-auto flex-shrink-0" />
            <span
              className={cn(
                "logo-text text-xl text-foreground whitespace-nowrap transition-[opacity,width] duration-300 ease-in-out",
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
              )}
            >
              Skribe
            </span>
          </Link>
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftCloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle when collapsed - positioned at top */}
        {collapsed && (
          <div className="px-2 pb-2">
            <button
              onClick={toggleCollapsed}
              className="w-full p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpenIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Project Selector */}
        <ProjectSelector currentProjectId={projectId} collapsed={collapsed ?? false} />

        {/* GitHub Link */}
        <GitHubNavLink currentProjectId={projectId} collapsed={collapsed ?? false} />

        {/* Navigation */}
        <SidebarNav projectId={projectId} collapsed={collapsed ?? false} />

        {/* Recent Agents */}
        <div className="flex-1 overflow-y-auto">
          <RecentAgentsList projectId={projectId} collapsed={collapsed ?? false} />
        </div>

        {/* User Nav */}
        <UserNav collapsed={collapsed ?? false} />
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          "flex-1 transition-[padding] duration-300 ease-in-out",
          collapsed === true ? "pl-16" : "pl-64"
        )}
      >
        {/* Trial Banner */}
        {isOnTrial && trialDaysLeft > 0 && (
          <div className="mx-8">
            <div className="bg-warning/10 border border-warning/30 px-6 py-2 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-warning">
                  <span className="font-medium">{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</span>{" "}
                  left in your free trial
                </p>
                <Link
                  href="/pricing"
                  className="text-sm font-medium text-warning underline hover:no-underline"
                >
                  Upgrade now
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}

function PanelLeftCloseIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

function PanelLeftOpenIcon({ className }: { className?: string }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}
