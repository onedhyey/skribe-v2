"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import { CreateDocumentModal, type DocumentType } from "@/components/document";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect } from "react";

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  // Menu and modal state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameModalDoc, setRenameModalDoc] = useState<{ id: string; title: string } | null>(null);
  const [deleteModalDocId, setDeleteModalDocId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPushingSingle, setIsPushingSingle] = useState<string | null>(null);

  // Create document modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Mutations
  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);
  const createDocument = useMutation(api.documents.create);

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch project documents
  const documents = useQuery(
    api.documents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Calculate pending documents count
  const pendingDocumentsCount = useMemo(() => {
    if (!documents) return 0;
    return documents.filter((doc) => doc.syncStatus === "pending").length;
  }, [documents]);

  const handlePushAllToGitHub = async () => {
    if (!documents || documents.length === 0 || isPushingAll || !projectId) return;

    setIsPushingAll(true);
    setPushResult(null);

    try {
      const documentIds = documents.map((doc) => doc._id);

      const response = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          documentIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPushResult({
          success: false,
          message: data.error || "Failed to push to GitHub",
        });
      } else {
        setPushResult({
          success: data.success,
          message: data.message,
        });
      }
    } catch (error) {
      console.error("Failed to push to GitHub:", error);
      setPushResult({
        success: false,
        message: "Failed to push to GitHub. Please try again.",
      });
    } finally {
      setIsPushingAll(false);
      setTimeout(() => setPushResult(null), 5000);
    }
  };

  const handlePushSingleToGitHub = async (documentId: string) => {
    if (isPushingSingle) return;

    setIsPushingSingle(documentId);
    setOpenMenuId(null);

    try {
      const response = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          documentIds: [documentId],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPushResult({
          success: false,
          message: data.error || "Failed to push to GitHub",
        });
      } else {
        setPushResult({
          success: true,
          message: "Document pushed to GitHub successfully",
        });
      }
    } catch (error) {
      console.error("Failed to push to GitHub:", error);
      setPushResult({
        success: false,
        message: "Failed to push to GitHub. Please try again.",
      });
    } finally {
      setIsPushingSingle(null);
      setTimeout(() => setPushResult(null), 5000);
    }
  };

  const handleRename = async () => {
    if (!renameModalDoc || !newTitle.trim() || isRenaming) return;

    setIsRenaming(true);
    try {
      await updateDocument({
        documentId: renameModalDoc.id as Id<"documents">,
        title: newTitle.trim(),
      });
      setRenameModalDoc(null);
      setNewTitle("");
    } catch (error) {
      console.error("Failed to rename document:", error);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalDocId || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteDocument({
        documentId: deleteModalDocId as Id<"documents">,
      });
      setDeleteModalDocId(null);
    } catch (error) {
      console.error("Failed to delete document:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const openRenameModal = (docId: string, currentTitle: string) => {
    setOpenMenuId(null);
    setRenameModalDoc({ id: docId, title: currentTitle });
    setNewTitle(currentTitle);
  };

  const openDeleteModal = (docId: string) => {
    setOpenMenuId(null);
    setDeleteModalDocId(docId);
  };

  const handleCreateDocument = async (title: string, type: DocumentType, content: string) => {
    setIsCreating(true);
    try {
      const defaultContent = content || `# ${title}\n\nStart writing your document here...`;
      const newDocId = await createDocument({
        projectId: projectId as Id<"projects">,
        title,
        content: defaultContent,
        type,
      });
      setIsCreateModalOpen(false);
      router.push(`/p/${projectId}/documents/${newDocId}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (project === undefined || documents === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Documents</h1>
          <p className="mt-1 text-muted-foreground">
            {documents.length === 0
              ? "Create documents or generate them during conversations"
              : `${documents.length} document${documents.length !== 1 ? "s" : ""} in this project`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingDocumentsCount > 0 && (
            <span className="text-sm text-warning">
              {pendingDocumentsCount} pending
            </span>
          )}
          {project?.githubRepoName && documents.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePushAllToGitHub}
              disabled={isPushingAll}
              isLoading={isPushingAll}
            >
              <GitHubIcon className="h-4 w-4 mr-2" />
              Push All to GitHub
            </Button>
          )}
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Push Result Feedback */}
      {pushResult && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            pushResult.success
              ? "border-success/30 bg-success/10"
              : "border-destructive/30 bg-destructive/10"
          }`}
        >
          <div className="flex items-center gap-3">
            {pushResult.success ? (
              <CheckIcon className="h-5 w-5 text-success flex-shrink-0" />
            ) : (
              <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0" />
            )}
            <p
              className={`text-sm font-medium ${
                pushResult.success ? "text-success" : "text-destructive"
              }`}
            >
              {pushResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-white p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <DocumentIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-semibold mb-2">No documents yet</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Create a blank document to start writing, or generate documents
            during your conversations with the AI advisor.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Blank Document
            </Button>
            <Button variant="outline" onClick={() => router.push(`/p/${projectId}`)}>
              Start a Conversation
            </Button>
          </div>
        </div>
      ) : (
        /* Documents Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc._id}
              doc={doc}
              projectId={projectId}
              isMenuOpen={openMenuId === doc._id}
              onMenuToggle={() => setOpenMenuId(openMenuId === doc._id ? null : doc._id)}
              onCloseMenu={() => setOpenMenuId(null)}
              onView={() => {
                setOpenMenuId(null);
                router.push(`/p/${projectId}/documents/${doc._id}`);
              }}
              onPushToGitHub={() => handlePushSingleToGitHub(doc._id)}
              onRename={() => openRenameModal(doc._id, doc.title)}
              onDelete={() => openDeleteModal(doc._id)}
              isPushing={isPushingSingle === doc._id}
              hasGitHub={!!project?.githubRepoName}
            />
          ))}
        </div>
      )}

      {/* Rename Modal */}
      <Modal
        isOpen={!!renameModalDoc}
        onClose={() => {
          setRenameModalDoc(null);
          setNewTitle("");
        }}
        title="Rename Document"
      >
        <div className="space-y-4">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Document title"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setRenameModalDoc(null);
                setNewTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newTitle.trim() || isRenaming}
              isLoading={isRenaming}
            >
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteModalDocId}
        onClose={() => setDeleteModalDocId(null)}
        title="Delete Document"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteModalDocId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Document Modal */}
      <CreateDocumentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateDocument}
        isLoading={isCreating}
      />
    </div>
  );
}

// Get first 150 characters of document content as preview
function getDocumentPreview(content: string): string {
  // Remove markdown headers and extra whitespace
  const cleaned = content
    .replace(/^#+\s+.+$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return cleaned.slice(0, 150) + (cleaned.length > 150 ? "..." : "");
}

// Components
function SyncStatusBadge({ status }: { status: "synced" | "pending" | "error" }) {
  const config = {
    synced: { label: "Synced", className: "bg-success/10 text-success" },
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    error: { label: "Error", className: "bg-destructive/10 text-destructive" },
  };

  const { label, className } = config[status];

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

interface DocumentCardProps {
  doc: {
    _id: string;
    title: string;
    content: string;
    type: string;
    syncStatus: "synced" | "pending" | "error";
    updatedAt: number;
  };
  projectId: string;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onCloseMenu: () => void;
  onView: () => void;
  onPushToGitHub: () => void;
  onRename: () => void;
  onDelete: () => void;
  isPushing: boolean;
  hasGitHub: boolean;
}

function DocumentCard({
  doc,
  projectId,
  isMenuOpen,
  onMenuToggle,
  onCloseMenu,
  onView,
  onPushToGitHub,
  onRename,
  onDelete,
  isPushing,
  hasGitHub,
}: DocumentCardProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseMenu();
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen, onCloseMenu]);

  return (
    <Card className="h-full transition-all hover:border-primary/30 relative">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <DocumentTypeIcon type={doc.type} className="h-5 w-5 flex-shrink-0" />
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {doc.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusBadge status={doc.syncStatus} />
            {/* Three dots menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMenuToggle();
                }}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Document actions"
              >
                <MoreVerticalIcon className="h-4 w-4 text-muted-foreground" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-white shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onView();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View
                    </button>
                    {hasGitHub && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onPushToGitHub();
                        }}
                        disabled={isPushing}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                      >
                        <GitHubIcon className="h-4 w-4" />
                        {isPushing ? "Pushing..." : "Push to GitHub"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRename();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <PencilIcon className="h-4 w-4" />
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <Link href={`/p/${projectId}/documents/${doc._id}`} className="block">
          <h3 className="font-medium text-foreground mb-1 line-clamp-2 hover:text-primary transition-colors">
            {doc.title}
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Last edited {new Date(doc.updatedAt).toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {getDocumentPreview(doc.content)}
          </p>
        </Link>
      </CardContent>
    </Card>
  );
}

function DocumentTypeIcon({ type, className }: { type: string; className?: string }) {
  const typeColors: Record<string, string> = {
    prd: "text-blue-500",
    persona: "text-purple-500",
    market: "text-green-500",
    brand: "text-pink-500",
    business: "text-amber-500",
    feature: "text-cyan-500",
    tech: "text-indigo-500",
    gtm: "text-orange-500",
    custom: "text-muted-foreground",
  };

  const color = typeColors[type] || typeColors.custom;

  return (
    <svg
      className={`${className} ${color}`}
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
  );
}

// Icons
function DocumentIcon({ className }: { className?: string }) {
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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

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

function WarningIcon({ className }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
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

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
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
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}
