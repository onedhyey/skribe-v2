"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button, Textarea, Modal } from "@/components/ui";
import { SelectableMarkdownRenderer } from "@/components/ui/selectable-markdown-renderer";
import { ImageUploadButton } from "@/components/chat/ImageUploadButton";
import { ImagePreviewGrid } from "@/components/chat/ImagePreviewGrid";
import { ChatImageDisplay } from "@/components/chat/ChatImageDisplay";
import { ImageDropZone, useImagePaste } from "@/components/chat/ImageDropZone";
import { SelectionContextChip } from "@/components/document/SelectionContextChip";
import { DocumentCard } from "@/components/chat";
import { useStoreUser } from "@/hooks/use-store-user";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import type { SelectionContext } from "@/components/document";

// Token estimation: ~4 chars per token on average
const CHARS_PER_TOKEN = 4;
const WARNING_THRESHOLD_TOKENS = 80000;
const WARNING_THRESHOLD_CHARS = WARNING_THRESHOLD_TOKENS * CHARS_PER_TOKEN;

// Types for parsed document events
interface DocumentEvent {
  type: "DOCUMENT_CREATED" | "DOCUMENT_UPDATED" | "DOCUMENT_EDIT";
  documentId: string;
  title?: string;
  documentType?: string;
  content?: string;
  message?: string;
}

// Types for web search events
interface WebSearchCitation {
  url: string;
  title: string;
  citedText: string;
}

interface WebSearchCitationsEvent {
  type: "WEB_SEARCH_CITATIONS";
  citations: WebSearchCitation[];
}

type StreamEvent = DocumentEvent | { type: "WEB_SEARCH_STARTED"; query?: string } | WebSearchCitationsEvent;

// Parse JSONL markers from message content
function parseMessageEvents(content: string): {
  cleanContent: string;
  documentEvents: DocumentEvent[];
  citations: WebSearchCitation[];
  hasWebSearch: boolean;
} {
  const documentEvents: DocumentEvent[] = [];
  const citations: WebSearchCitation[] = [];
  let hasWebSearch = false;
  const lines = content.split("\n");
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as StreamEvent;
        if (
          parsed.type === "DOCUMENT_CREATED" ||
          parsed.type === "DOCUMENT_UPDATED" ||
          parsed.type === "DOCUMENT_EDIT"
        ) {
          documentEvents.push(parsed as DocumentEvent);
          continue;
        } else if (parsed.type === "WEB_SEARCH_STARTED") {
          hasWebSearch = true;
          continue;
        } else if (parsed.type === "WEB_SEARCH_CITATIONS") {
          const citationEvent = parsed as WebSearchCitationsEvent;
          citations.push(...citationEvent.citations);
          continue;
        }
      } catch {
        // Not valid JSON, treat as regular content
      }
    }
    cleanLines.push(line);
  }

  return {
    cleanContent: cleanLines.join("\n").trim(),
    documentEvents,
    citations,
    hasWebSearch,
  };
}

export default function UnifiedDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const documentId = params.documentId as string;
  useStoreUser();

  // Document editor state
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

  // Chat state
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingFirstChunk, setAwaitingFirstChunk] = useState(false);
  const [selectedText, setSelectedText] = useState<SelectionContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // System prompt editor state
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
  const [editedSystemPrompt, setEditedSystemPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // Image upload state
  const {
    pendingImages,
    isUploading,
    uploadError,
    addImages,
    removeImage,
    clearImages,
    uploadAllImages,
  } = useImageUpload();

  // Enable clipboard paste for images
  useImagePaste(
    useCallback((files: File[]) => addImages(files), [addImages]),
    !isSubmitting
  );

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

  // Fetch project
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch chat (agent) linked to document with messages
  const chatData = useQuery(
    api.agents.getByDocumentWithMessages,
    documentId ? { documentId: documentId as Id<"documents"> } : "skip"
  );

  // Mutations
  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);
  const createMessage = useMutation(api.messages.create);
  const updateMessage = useMutation(api.messages.update);
  const createChatForDocument = useMutation(api.documents.createChatForDocument);
  const updateAgent = useMutation(api.agents.update);

  // Calculate token estimate
  const tokenEstimate = useMemo(() => {
    if (!document) return 0;
    return Math.ceil(document.content.length / CHARS_PER_TOKEN);
  }, [document]);

  const isLongDocument = document && document.content.length > WARNING_THRESHOLD_CHARS;
  const hasGitHub = project?.githubRepoName;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatData?.messages]);

  // Focus textarea on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Create chat if document doesn't have one
  useEffect(() => {
    async function ensureChat() {
      if (document && chatData === null) {
        try {
          await createChatForDocument({ documentId: documentId as Id<"documents"> });
        } catch (error) {
          console.error("Failed to create chat for document:", error);
        }
      }
    }
    ensureChat();
  }, [document, chatData, documentId, createChatForDocument]);

  // Document editing handlers
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

  const handleEdit = () => {
    if (!document) return;
    setEditedTitle(document.title);
    setEditedContent(document.content);
    setIsEditing(true);
    setSelectedText(null);
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

  // Chat handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && pendingImages.length === 0) || isSubmitting || !chatData) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsSubmitting(true);

    let assistantMessageId: Id<"messages"> | null = null;

    try {
      // Upload any pending images first
      let imageIds: Id<"_storage">[] = [];
      if (pendingImages.length > 0) {
        imageIds = await uploadAllImages();
        clearImages();
      }

      // Create user message with images
      await createMessage({
        agentId: chatData._id,
        role: "user",
        content: userMessage,
        imageIds: imageIds.length > 0 ? imageIds : undefined,
      });

      // Create placeholder for assistant message
      setAwaitingFirstChunk(true);
      assistantMessageId = await createMessage({
        agentId: chatData._id,
        role: "assistant",
        content: "",
      });

      // Build request body
      const requestBody: Record<string, unknown> = {
        agentId: chatData._id,
        projectId,
        message: userMessage,
        // Include document context
        activeDocumentId: documentId,
        activeDocumentContent: isEditing ? editedContent : document?.content,
      };

      // Include image IDs if present
      if (imageIds.length > 0) {
        requestBody.imageIds = imageIds;
      }

      // Include selection context if text is selected
      if (selectedText) {
        requestBody.selectionContext = {
          text: selectedText.text,
          startOffset: selectedText.startOffset,
          endOffset: selectedText.endOffset,
        };
      }

      // Call the AI API
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get AI response");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        let isFirstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          if (isFirstChunk) {
            setAwaitingFirstChunk(false);
            isFirstChunk = false;
          }

          await updateMessage({
            messageId: assistantMessageId,
            content: fullContent,
          });
        }

        const remaining = decoder.decode();
        if (remaining) {
          fullContent += remaining;
          await updateMessage({
            messageId: assistantMessageId,
            content: fullContent,
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (assistantMessageId) {
        try {
          await updateMessage({
            messageId: assistantMessageId,
            content: "Sorry, I encountered an error and couldn't respond. Please try again.",
          });
        } catch {
          // Ignore update error
        }
      }
    } finally {
      setIsSubmitting(false);
      setAwaitingFirstChunk(false);
      setSelectedText(null);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle AI document update
  const handleAIDocumentUpdate = async (newContent: string) => {
    if (isEditing) {
      setEditedContent(newContent);
    } else {
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
    setSelectedText(null);
  };

  // System prompt handlers
  const handleOpenSystemPrompt = () => {
    if (chatData?.systemPrompt) {
      setEditedSystemPrompt(chatData.systemPrompt);
    } else {
      setEditedSystemPrompt("");
    }
    setIsSystemPromptOpen(true);
  };

  const handleSaveSystemPrompt = async () => {
    if (!chatData) return;

    setIsSavingPrompt(true);
    try {
      await updateAgent({
        agentId: chatData._id,
        systemPrompt: editedSystemPrompt || undefined,
      });
      setIsSystemPromptOpen(false);
    } catch (error) {
      console.error("Failed to save system prompt:", error);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  if (document === undefined || project === undefined || chatData === undefined) {
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
    <div className="flex h-screen bg-white">
      {/* Left Panel - Document Editor */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* Document Header */}
        <header className="flex-shrink-0 border-b border-border bg-white px-6 py-4">
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
                {project?.name} &middot; ~{tokenEstimate.toLocaleString()} tokens
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SyncStatusBadge status={document.syncStatus} />
            </div>
          </div>
        </header>

        {/* Warnings and Errors */}
        <div className="flex-shrink-0 px-6">
          {isLongDocument && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <WarningIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning">Long Document</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ~{tokenEstimate.toLocaleString()} tokens. Consider breaking into smaller documents.
                  </p>
                </div>
              </div>
            </div>
          )}

          {pushResult && (
            <div className={`mt-4 rounded-xl border p-4 ${
              pushResult.success
                ? "border-success/30 bg-success/10"
                : "border-destructive/30 bg-destructive/10"
            }`}>
              <div className="flex items-center gap-3">
                {pushResult.success ? (
                  <CheckIcon className="h-5 w-5 text-success flex-shrink-0" />
                ) : (
                  <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
                <p className={`text-sm font-medium ${
                  pushResult.success ? "text-success" : "text-destructive"
                }`}>
                  {pushResult.message}
                </p>
              </div>
            </div>
          )}

          {actionError && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
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
          )}
        </div>

        {/* Actions Bar */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-end gap-2">
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
                {hasGitHub && (
                  <Button
                    variant="outline"
                    onClick={handlePushToGitHub}
                    isLoading={isPushing}
                    disabled={isPushing}
                  >
                    <GitHubIcon className="h-4 w-4 mr-2" />
                    Push
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
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
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
        </div>
      </div>

      {/* Right Panel - AI Chat */}
      <div className="w-1/2 max-w-xl flex flex-col min-w-0 bg-neutral-50">
        {/* Chat Header */}
        <header className="flex-shrink-0 border-b border-border bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-semibold">AI Assistant</h2>
              <p className="text-sm text-muted-foreground">
                {chatData?.type ? chatData.type.replace(/_/g, " ") : "Chat"}
              </p>
            </div>
            <button
              onClick={handleOpenSystemPrompt}
              className="rounded-lg p-2 hover:bg-muted transition-colors"
              aria-label="Edit system prompt"
            >
              <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {!chatData || chatData.messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
                  <SparklesIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold mb-2">
                  Start editing with AI
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Select text in the document to edit it, or ask questions about the content.
                </p>
              </div>
            ) : (
              chatData.messages.map((message) => (
                <MessageBubble
                  key={message._id}
                  message={message}
                  onOpenDocument={() => {}}
                />
              ))
            )}

            {/* Typing indicator */}
            {awaitingFirstChunk && (
              <div className="flex items-start justify-start">
                <div className="font-serif">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }}></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }}></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="flex-shrink-0 px-6 pb-4">
          {/* Selection context chip */}
          {selectedText && (
            <div className="mb-3">
              <SelectionContextChip
                selection={{
                  text: selectedText.text,
                  startOffset: selectedText.startOffset,
                  endOffset: selectedText.endOffset,
                  contentSnapshot: isEditing ? editedContent : document.content,
                }}
                onClear={() => setSelectedText(null)}
              />
            </div>
          )}

          <ImageDropZone
            onFilesDropped={addImages}
            disabled={isSubmitting || isUploading}
          >
            <div className="bg-white rounded-2xl border border-border shadow-sm p-4">
              {/* Image preview grid */}
              {pendingImages.length > 0 && (
                <ImagePreviewGrid
                  images={pendingImages}
                  onRemove={removeImage}
                  className="mb-3 border-b border-neutral-100 pb-3"
                />
              )}

              {/* Upload error message */}
              {uploadError && (
                <p className="mb-2 text-xs text-red-500">{uploadError}</p>
              )}

              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <ImageUploadButton
                  onFilesSelected={addImages}
                  disabled={isSubmitting || isUploading}
                />
                <div className="flex-1">
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      selectedText
                        ? "Ask about or edit the selected text..."
                        : "Type your message..."
                    }
                    rows={1}
                    className="min-h-[44px] max-h-32 resize-none border-0 shadow-none focus:ring-0"
                    disabled={isSubmitting || !chatData}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={(!inputValue.trim() && pendingImages.length === 0) || isSubmitting || isUploading || !chatData}
                  isLoading={isSubmitting || isUploading}
                  className="rounded-full w-11 h-11 p-0 flex-shrink-0"
                >
                  <SendIcon className="h-5 w-5" />
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </ImageDropZone>
        </div>
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

      {/* System Prompt Editor Modal */}
      <Modal
        isOpen={isSystemPromptOpen}
        onClose={() => setIsSystemPromptOpen(false)}
        title="Edit System Prompt"
        description="Customize how the AI assistant behaves for this document."
      >
        <div className="space-y-4">
          <Textarea
            value={editedSystemPrompt}
            onChange={(e) => setEditedSystemPrompt(e.target.value)}
            placeholder="Enter custom instructions for the AI..."
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsSystemPromptOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSystemPrompt}
              isLoading={isSavingPrompt}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Message bubble component
function MessageBubble({
  message,
  onOpenDocument,
}: {
  message: {
    _id: string;
    role: "user" | "assistant" | "system";
    content: string;
    imageIds?: Id<"_storage">[];
    createdAt: number;
  };
  onOpenDocument?: (documentId: Id<"documents">) => void;
}) {
  const isUser = message.role === "user";

  if (message.role === "system") {
    return null;
  }

  const { cleanContent, documentEvents, citations } = isUser
    ? { cleanContent: message.content, documentEvents: [], citations: [] }
    : parseMessageEvents(message.content);

  const documentCards = documentEvents.filter(
    (e) => e.type === "DOCUMENT_CREATED" || e.type === "DOCUMENT_UPDATED"
  );

  const uniqueCitations = citations.reduce((acc, citation) => {
    if (!acc.find((c) => c.url === citation.url)) {
      acc.push(citation);
    }
    return acc;
  }, [] as WebSearchCitation[]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3"
            : "font-serif"
        }`}
      >
        {/* User images */}
        {isUser && message.imageIds && message.imageIds.length > 0 && (
          <div className="mb-2">
            <ChatImageDisplay imageIds={message.imageIds} />
          </div>
        )}

        {/* Message content */}
        {isUser ? (
          <p className="whitespace-pre-wrap">{cleanContent}</p>
        ) : (
          <div
            className="prose prose-slate prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                cleanContent
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                  .replace(/\n/g, "<br />")
              ),
            }}
          />
        )}

        {/* Document cards */}
        {documentCards.length > 0 && (
          <div className="mt-3 space-y-2">
            {documentCards.map((event, index) => (
              <DocumentCard
                key={`${event.documentId}-${index}`}
                documentId={event.documentId as Id<"documents">}
                title={event.title || "Document"}
                documentType={event.documentType || "custom"}
                action={event.type === "DOCUMENT_CREATED" ? "created" : "updated"}
                onClick={() => onOpenDocument?.(event.documentId as Id<"documents">)}
              />
            ))}
          </div>
        )}

        {/* Citations */}
        {uniqueCitations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Sources</p>
            <div className="space-y-1">
              {uniqueCitations.slice(0, 3).map((citation, index) => (
                <a
                  key={index}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-primary hover:underline truncate"
                >
                  {citation.title || citation.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
