"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui";
import { CustomAgentModal, CreateTemplateModal, EditTemplateModal } from "@/components/chat/agent";
import { useStoreUser } from "@/hooks/use-store-user";
import { useState, useMemo, useRef, useEffect } from "react";
import { STARTING_POINTS, AgentType } from "@/lib/starting-points";

// Pastel color palette for starting point icons
// Each entry: [background (lighter), icon color (darker)]
const PASTEL_COLORS = [
  { bg: "bg-[#FFE8ED]", icon: "text-[#C4707F]" },     // Rose
  { bg: "bg-[#EDE8FF]", icon: "text-[#8B7DC4]" },     // Lavender
  { bg: "bg-[#E8F5FF]", icon: "text-[#6BA3C4]" },     // Sky
  { bg: "bg-[#E8FFEE]", icon: "text-[#5FC47F]" },     // Mint
  { bg: "bg-[#FFEFE8]", icon: "text-[#C49070]" },     // Peach
  { bg: "bg-[#FFFBE8]", icon: "text-[#C4A85F]" },     // Lemon
] as const;

export default function NewAgentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { user: storedUser } = useStoreUser();
  const [isCreatingAgent, setIsCreatingAgent] = useState<string | null>(null);
  const [isCustomAgentModalOpen, setIsCustomAgentModalOpen] = useState(false);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Doc<"agentTemplates"> | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project agents to know which starting points are completed
  const agents = useQuery(
    api.agents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch user's templates
  const templates = useQuery(api.agentTemplates.getByUser);

  // Create agent mutation
  const createAgent = useMutation(api.agents.create);

  // Template mutations
  const createTemplate = useMutation(api.agentTemplates.create);
  const updateTemplate = useMutation(api.agentTemplates.update);
  const deleteTemplate = useMutation(api.agentTemplates.remove);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate which starting points have been completed (have agents)
  const completedStartingPoints = useMemo(() => {
    if (!agents) return new Set<string>();
    const completedTypes = new Set<string>();
    for (const agent of agents) {
      if (agent.type !== "custom") {
        completedTypes.add(agent.type);
      }
    }
    return completedTypes;
  }, [agents]);

  // Check if project is new (no agents yet)
  const isNewProject = agents !== undefined && agents.length === 0;

  const handleStartAgent = async (type: AgentType) => {
    if (isCreatingAgent) return;
    if (!storedUser?._id || !projectId) return;

    setIsCreatingAgent(type);
    setAgentError(null);
    try {
      const startingPoint = STARTING_POINTS.find((sp) => sp.id === type);
      const agentId = await createAgent({
        projectId: projectId as Id<"projects">,
        type,
        title: startingPoint?.title ?? "Custom Agent",
      });

      router.push(`/p/${projectId}/agent/${agentId}`);
    } catch (error) {
      console.error("Failed to create agent:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to create agent. Please try again.");
    } finally {
      setIsCreatingAgent(null);
    }
  };

  const handleOpenAgent = () => {
    setIsCustomAgentModalOpen(true);
  };

  const handleCreateCustomAgent = async (title: string, systemPrompt: string) => {
    if (isCreatingAgent) return;
    if (!storedUser?._id || !projectId) return;

    setIsCreatingAgent("custom");
    setAgentError(null);
    try {
      const agentId = await createAgent({
        projectId: projectId as Id<"projects">,
        type: "custom",
        title: title || "Open Agent",
        systemPrompt: systemPrompt || undefined,
      });

      setIsCustomAgentModalOpen(false);
      router.push(`/p/${projectId}/agent/${agentId}`);
    } catch (error) {
      console.error("Failed to create custom agent:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to create agent. Please try again.");
    } finally {
      setIsCreatingAgent(null);
    }
  };

  const handleCreateTemplate = async (name: string, description: string, systemPrompt: string) => {
    setAgentError(null);
    try {
      await createTemplate({ name, description: description || undefined, systemPrompt });
      setIsCreateTemplateModalOpen(false);
    } catch (error) {
      console.error("Failed to create template:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to create template. Please try again.");
    }
  };

  const handleEditTemplate = async (name: string, description: string, systemPrompt: string) => {
    if (!editingTemplate) return;
    setAgentError(null);
    try {
      await updateTemplate({
        templateId: editingTemplate._id,
        name,
        description: description || undefined,
        systemPrompt,
      });
      setEditingTemplate(null);
    } catch (error) {
      console.error("Failed to update template:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to update template. Please try again.");
    }
  };

  const handleDeleteTemplate = async (templateId: Id<"agentTemplates">) => {
    setAgentError(null);
    setOpenMenuId(null);
    try {
      await deleteTemplate({ templateId });
    } catch (error) {
      console.error("Failed to delete template:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to delete template. Please try again.");
    }
  };

  const handleUseTemplate = async (template: Doc<"agentTemplates">) => {
    if (isCreatingAgent) return;
    if (!storedUser?._id || !projectId) return;

    setIsCreatingAgent(`template-${template._id}`);
    setAgentError(null);
    try {
      const agentId = await createAgent({
        projectId: projectId as Id<"projects">,
        type: "custom",
        title: template.name,
        systemPrompt: template.systemPrompt,
      });

      router.push(`/p/${projectId}/agent/${agentId}`);
    } catch (error) {
      console.error("Failed to create agent from template:", error);
      setAgentError(error instanceof Error ? error.message : "Failed to start conversation. Please try again.");
    } finally {
      setIsCreatingAgent(null);
    }
  };

  if (project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Create new agent
        </h1>
      </div>

      {/* Error Banner */}
      {agentError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">{agentError}</p>
            <button
              onClick={() => setAgentError(null)}
              className="text-destructive hover:text-destructive/80"
              aria-label="Dismiss error"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Agent Templates Section */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-foreground">Agent templates</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Pre-configured agents with specialized prompts to guide you through common tasks
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {STARTING_POINTS.map((point, index) => {
            const isCompleted = completedStartingPoints.has(point.id);
            const isRecommended = isNewProject && point.order === 1;
            const colorScheme = PASTEL_COLORS[index % PASTEL_COLORS.length];

            return (
              <Card
                key={point.id}
                role="button"
                tabIndex={0}
                aria-label={`Start ${point.title} agent${isCompleted ? " (completed)" : ""}${isRecommended ? " (recommended)" : ""}`}
                className={`cursor-pointer transition-all hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isCompleted ? "bg-success/5 border-success/30" : ""
                } ${isRecommended ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onClick={() => handleStartAgent(point.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (e.key === " ") {
                      e.preventDefault();
                    }
                    handleStartAgent(point.id);
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        isCompleted ? "bg-success/20" : colorScheme.bg
                      }`}
                    >
                      {isCompleted ? (
                        <CheckIcon className="h-5 w-5 text-success" />
                      ) : (
                        <StartingPointIcon
                          icon={point.icon}
                          className={`h-5 w-5 ${colorScheme.icon}`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">
                          {point.title}
                        </h3>
                        {isRecommended && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                            Start here
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {point.description}
                      </p>
                    </div>
                    {isCreatingAgent === point.id && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* User's Custom Templates */}
          {templates?.map((template) => (
            <Card
              key={template._id}
              role="button"
              tabIndex={0}
              aria-label={`Use ${template.name} template`}
              className="cursor-pointer transition-all hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 relative group"
              onClick={() => handleUseTemplate(template)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (e.key === " ") {
                    e.preventDefault();
                  }
                  handleUseTemplate(template);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/20">
                    <StartingPointIcon icon="sparkles" className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">
                        {template.name}
                      </h3>
                      <span className="rounded-full bg-secondary/30 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                        Custom
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {template.description || "Custom agent template"}
                    </p>
                  </div>
                  {isCreatingAgent === `template-${template._id}` && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  )}
                </div>
                {/* Three-dot menu */}
                <div className="absolute top-2 right-2" ref={openMenuId === template._id ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === template._id ? null : template._id);
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                    aria-label="Template options"
                  >
                    <MoreVerticalIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {openMenuId === template._id && (
                    <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border bg-white shadow-lg">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setEditingTemplate(template);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted rounded-t-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template._id);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 rounded-b-lg"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Start from Scratch Section */}
      <div>
        <h2 className="text-lg font-medium text-foreground">Start from scratch</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Begin with a blank slate or create your own reusable template
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* Open Agent Card */}
          <Card
            role="button"
            tabIndex={0}
            aria-label="Start an open conversation"
            className="cursor-pointer transition-all hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-dashed"
            onClick={handleOpenAgent}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (e.key === " ") {
                  e.preventDefault();
                }
                handleOpenAgent();
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <MessageCircleIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">Open Conversation</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    Start a freeform conversation without a specific template
                  </p>
                </div>
                {isCreatingAgent === "custom" && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Create Template Card */}
          <Card
            role="button"
            tabIndex={0}
            aria-label="Create a new template"
            className="cursor-pointer transition-all hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-dashed"
            onClick={() => setIsCreateTemplateModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                if (e.key === " ") {
                  e.preventDefault();
                }
                setIsCreateTemplateModalOpen(true);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <PlusIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground">Create Template</h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    Save a custom workflow as a reusable template
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Custom Agent Modal */}
      <CustomAgentModal
        isOpen={isCustomAgentModalOpen}
        onClose={() => setIsCustomAgentModalOpen(false)}
        onSubmit={handleCreateCustomAgent}
        isLoading={isCreatingAgent === "custom"}
      />

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateTemplateModalOpen}
        onClose={() => setIsCreateTemplateModalOpen(false)}
        onSubmit={handleCreateTemplate}
      />

      {/* Edit Template Modal */}
      <EditTemplateModal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSubmit={handleEditTemplate}
        initialName={editingTemplate?.name ?? ""}
        initialDescription={editingTemplate?.description ?? ""}
        initialSystemPrompt={editingTemplate?.systemPrompt ?? ""}
      />
    </div>
  );
}

// Icon components
function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MessageCircleIcon({ className }: { className?: string }) {
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
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function StartingPointIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const icons: Record<string, React.ReactNode> = {
    lightbulb: (
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
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
    chart: (
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
        <line x1="12" x2="12" y1="20" y2="10" />
        <line x1="18" x2="18" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="16" />
      </svg>
    ),
    users: (
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
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    palette: (
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
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
    briefcase: (
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
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        <rect width="20" height="14" x="2" y="6" rx="2" />
      </svg>
    ),
    sparkles: (
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
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
    ),
    code: (
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
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    document: (
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
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    ),
    rocket: (
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
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
    layout: (
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
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    inbox: (
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
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  };

  return <>{icons[icon] || icons.document}</>;
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
