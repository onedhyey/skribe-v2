"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button, Textarea, Modal } from "@/components/ui";
import { SelectableMarkdownRenderer } from "@/components/ui/selectable-markdown-renderer";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  DocumentEditorPanel,
  DocumentAIChat,
  SelectionContext,
} from "@/components/document";

// Token estimation: ~4 chars per token on average
const CHARS_PER_TOKEN = 4;
const WARNING_THRESHOLD_TOKENS = 80000;
const WARNING_THRESHOLD_CHARS = WARNING_THRESHOLD_TOKENS * CHARS_PER_TOKEN;

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;
  useStoreUser(); // Ensure user is synced to Convex

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pushResultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI Editor Panel state
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<SelectionContext | null>(null);

  useEffect(() => {
    return () => {
      if (pushResultTimeoutRef.current) {
        clearTimeout(pushResultTimeoutRef.current);
      }
    };
  }, []);

  // Fetch document
  const document = useQuery(
    api.documents.getById,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

  // Fetch project for breadcrumb
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);

  // Calculate token estimate
  const tokenEstimate = useMemo(() => {
    if (!document) return 0;
    return Math.ceil(document.content.length / CHARS_PER_TOKEN);
  }, [document]);

  const isLongDocument = document && document.content.length > WARNING_THRESHOLD_CHARS;

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTitle("");
    setEditedContent("");
  };

  const handleSaveEdit = async () => {
    if (!documentId || !editedContent.trim()) return;

    setIsSaving(true);
    setActionError(null);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        title: editedTitle.trim() || undefined,
        content: editedContent,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save document:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to save document. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!document) return;

    const blob = new Blob([document.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!documentId) return;

    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteDocument({
        documentId: documentId as Id<"documents">,
      });
      router.push(`/p/${projectId}/documents`);
    } catch (error) {
      console.error("Failed to delete document:", error);
      setActionError(
        error instanceof Error ? error.message : "Failed to delete document. Please try again."
      );
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handlePushToGitHub = async () => {
    if (!documentId || !projectId || isPushing) return;

    setIsPushing(true);
    setPushResult(null);

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
      setIsPushing(false);
      if (pushResultTimeoutRef.current) {
        clearTimeout(pushResultTimeoutRef.current);
      }
      pushResultTimeoutRef.current = setTimeout(() => setPushResult(null), 5000);
    }
  };

  const hasGitHub = project?.githubRepoName;

  // Handle AI document update
  const handleAIDocumentUpdate = async (newContent: string) => {
    if (isEditing) {
      // If in edit mode, just update the local state
      setEditedContent(newContent);
    } else {
      // If in view mode, save directly to Convex
      try {
        await updateDocument({
          documentId: documentId as Id<"documents">,
          content: newContent,
        });
      } catch (error) {
        console.error("Failed to apply AI edit:", error);
        setActionError(
          error instanceof Error ? error.message : "Failed to apply AI edit. Please try again."
        );
      }
    }
    // Clear selection after applying
    setSelectedText(null);
  };

  // Clear selection when switching modes
  const handleEdit = () => {
    if (!document) return;
    setEditedTitle(document.title);
    setEditedContent(document.content);
    setIsEditing(true);
    setSelectedText(null); // Clear selection when entering edit mode
  };

  if (document === undefined || project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Document Not Found</h1>
        <Link href={`/p/${projectId}/documents`}>
          <Button>Back to Documents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Main content area */}
      <div
        className="flex-1 min-w-0 transition-all duration-300"
        style={{
          paddingRight: isAIPanelOpen ? "var(--ai-panel-width, 400px)" : "0",
          ["--ai-panel-width" as string]: "min(400px, 100vw - 2rem)",
        }}
      >
        {/* Header */}
        <header className="border-b border-border bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/p/${projectId}/documents`}
              className="rounded-lg p-2 hover:bg-muted"
              aria-label="Back to documents"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full font-serif text-xl font-semibold bg-transparent border-b border-primary focus:outline-none"
                  placeholder="Document title"
                />
              ) : (
                <h1 className="font-serif text-xl font-semibold truncate">
                  {document.title}
                </h1>
              )}
              <p className="text-sm text-muted-foreground truncate">
                {project?.name} &middot; Last updated{" "}
                {new Date(document.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
                {document.type}
              </span>
              <SyncStatusBadge status={document.syncStatus} />
            </div>
          </div>
        </header>

      {/* Context Length Warning */}
      {isLongDocument && (
        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <WarningIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning">Long Document Warning</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This document is approximately {tokenEstimate.toLocaleString()} tokens.
                  Very long documents may reduce the AI&apos;s ability to reference all content
                  effectively. Consider breaking it into smaller, focused documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Push Result Feedback */}
      {pushResult && (
        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div
            className={`rounded-xl border p-4 ${
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
        </div>
      )}

      {/* Action Error Feedback */}
      {actionError && (
        <div className="mx-auto max-w-4xl px-6 pt-4">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="text-sm font-medium text-destructive">{actionError}</p>
              </div>
              <button
                onClick={() => setActionError(null)}
                className="text-destructive hover:text-destructive/80"
                aria-label="Dismiss error"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="mx-auto max-w-4xl px-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            ~{tokenEstimate.toLocaleString()} tokens
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} isLoading={isSaving}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={isAIPanelOpen ? "primary" : "outline"}
                  onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                >
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  {isAIPanelOpen ? "Close AI" : "AI Editor"}
                </Button>
                {hasGitHub && (
                  <Button
                    variant="outline"
                    onClick={handlePushToGitHub}
                    isLoading={isPushing}
                    disabled={isPushing}
                  >
                    <GitHubIcon className="h-4 w-4 mr-2" />
                    Push to GitHub
                  </Button>
                )}
                <Button variant="outline" onClick={handleDownload}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={handleEdit}>
                  <EditIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-6">
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[500px] font-mono text-sm"
            placeholder="Enter markdown content..."
          />
        ) : (
          <div className="prose prose-slate max-w-none">
            <SelectableMarkdownRenderer
              content={document.content}
              onSelectionChange={setSelectedText}
              selectionEnabled={!isEditing}
            />
          </div>
        )}
      </main>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
      >
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            Delete Document
          </Button>
        </div>
      </Modal>

      {/* AI Editor Panel */}
      <DocumentEditorPanel
        isOpen={isAIPanelOpen}
        onClose={() => setIsAIPanelOpen(false)}
      >
        <DocumentAIChat
          documentId={documentId}
          projectId={projectId}
          documentContent={isEditing ? editedContent : document.content}
          selectedText={selectedText}
          onDocumentUpdate={handleAIDocumentUpdate}
          onClearSelection={() => setSelectedText(null)}
        />
      </DocumentEditorPanel>
    </div>
  );
}

// Sync Status Badge
function SyncStatusBadge({ status }: { status: "synced" | "pending" | "error" }) {
  const statusConfig = {
    synced: { label: "Synced", className: "bg-success/10 text-success" },
    pending: { label: "Pending", className: "bg-warning/10 text-warning" },
    error: { label: "Sync Error", className: "bg-destructive/10 text-destructive" },
  };

  const config = statusConfig[status];

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
