"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button, Textarea } from "@/components/ui";
import { EditAgentModal } from "@/components/chat/agent";
import { DocumentCard, AgentDocumentPanel } from "@/components/chat";
import { ImageUploadButton } from "@/components/chat/ImageUploadButton";
import { ImagePreviewGrid } from "@/components/chat/ImagePreviewGrid";
import { ChatImageDisplay } from "@/components/chat/ChatImageDisplay";
import { ImageDropZone, useImagePaste } from "@/components/chat/ImageDropZone";
import { SelectionContextChip } from "@/components/document/SelectionContextChip";
import { useStoreUser } from "@/hooks/use-store-user";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useState, useRef, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { SelectionContext } from "@/hooks/use-text-selection";

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
interface WebSearchStartedEvent {
  type: "WEB_SEARCH_STARTED";
  query?: string;
}

interface WebSearchCitation {
  url: string;
  title: string;
  citedText: string;
}

interface WebSearchCitationsEvent {
  type: "WEB_SEARCH_CITATIONS";
  citations: WebSearchCitation[];
}

type StreamEvent = DocumentEvent | WebSearchStartedEvent | WebSearchCitationsEvent;

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
          continue; // Don't add this line to clean content
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

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const agentId = params.agentId as string;
  useStoreUser(); // Ensure user is synced to Convex

  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsStreaming] = useState(false);
  const [awaitingFirstChunk, setAwaitingFirstChunk] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingAgent, setIsUpdatingAgent] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Document panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<Id<"documents"> | null>(null);
  const [activeDocumentContent, setActiveDocumentContent] = useState("");
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);

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

  // Fetch documents for the project
  const projectDocuments = useQuery(
    api.documents.getByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch agent with messages
  const agentData = useQuery(
    api.agents.getWithMessages,
    agentId ? { agentId: agentId as Id<"agents"> } : "skip"
  );

  // Fetch project for breadcrumb
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const createMessage = useMutation(api.messages.create);
  const updateMessage = useMutation(api.messages.update);
  const updateAgent = useMutation(api.agents.update);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentData?.messages]);

  // Focus textarea on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle opening a document in the panel
  const handleOpenDocument = useCallback((documentId: Id<"documents">) => {
    setActiveDocumentId(documentId);
    setIsPanelOpen(true);
    setSelectionContext(null); // Clear any previous selection
  }, []);

  // Handle document content updates from the panel
  const handleDocumentContentChange = useCallback((content: string) => {
    setActiveDocumentContent(content);
  }, []);

  // Handle selection changes from the document panel
  const handleSelectionChange = useCallback((selection: SelectionContext | null) => {
    setSelectionContext(selection);
  }, []);

  // Clear selection context
  const handleClearSelection = useCallback(() => {
    setSelectionContext(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputValue.trim() && pendingImages.length === 0) || isSubmitting || !agentId) return;

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
        agentId: agentId as Id<"agents">,
        role: "user",
        content: userMessage,
        imageIds: imageIds.length > 0 ? imageIds : undefined,
      });

      // Create placeholder for assistant message
      setIsStreaming(true);
      setAwaitingFirstChunk(true);
      assistantMessageId = await createMessage({
        agentId: agentId as Id<"agents">,
        role: "assistant",
        content: "",
      });

      // Build request body with optional document context
      const requestBody: Record<string, unknown> = {
        agentId,
        projectId,
        message: userMessage,
      };

      // Include image IDs if present
      if (imageIds.length > 0) {
        requestBody.imageIds = imageIds;
      }

      // Include document context if panel is open
      if (isPanelOpen && activeDocumentId) {
        requestBody.activeDocumentId = activeDocumentId;
        requestBody.activeDocumentContent = activeDocumentContent;

        // Include selection context if text is selected
        if (selectionContext) {
          requestBody.selectionContext = {
            text: selectionContext.text,
            startOffset: selectionContext.startOffset,
            endOffset: selectionContext.endOffset,
          };
        }
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

          // Clear awaiting state on first chunk
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
      setIsStreaming(false);
      setAwaitingFirstChunk(false);
      setSelectionContext(null); // Clear selection after sending
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleUpdateAgent = async (title: string, systemPrompt: string) => {
    if (!agentId) return;

    setIsUpdatingAgent(true);
    setUpdateError(null);
    try {
      await updateAgent({
        agentId: agentId as Id<"agents">,
        title,
        systemPrompt: systemPrompt || undefined,
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Failed to update agent:", error);
      setUpdateError(error instanceof Error ? error.message : "Failed to update agent. Please try again.");
    } finally {
      setIsUpdatingAgent(false);
    }
  };

  if (agentData === undefined || project === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!agentData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="font-serif text-2xl font-bold">Agent Not Found</h1>
        <Button onClick={() => router.push(`/p/${projectId}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  // Prepare available documents for the panel
  const availableDocuments = projectDocuments?.map((doc) => ({
    _id: doc._id,
    title: doc.title,
    type: doc.type,
  })) || [];

  return (
    <div
      className="flex h-dvh flex-col bg-white transition-all duration-300 overflow-hidden"
      style={{
        marginRight: isPanelOpen ? "480px" : "0",
      }}
    >
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl font-semibold truncate">
              {agentData.title}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {project?.name}
            </p>
          </div>
          {agentData.type === "custom" && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="rounded-lg p-2 hover:bg-white/50 transition-colors"
              aria-label="Edit agent settings"
            >
              <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {agentData.messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
                <AgentIcon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-semibold mb-2">
                Start the conversation
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {agentData.type === "custom"
                  ? "Ask me anything about your project. I have access to all your project documents."
                  : `I'm ready to help you with ${agentData.title.toLowerCase()}. What would you like to explore?`}
              </p>
            </div>
          ) : (
            agentData.messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                onOpenDocument={handleOpenDocument}
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

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-4">
        <div className="mx-auto max-w-3xl">
          {/* Selection context chip */}
          {selectionContext && (
            <div className="mb-3">
              <SelectionContextChip
                selection={{
                  text: selectionContext.text,
                  startOffset: selectionContext.startOffset,
                  endOffset: selectionContext.endOffset,
                  contentSnapshot: activeDocumentContent,
                }}
                onClear={handleClearSelection}
              />
            </div>
          )}

          <ImageDropZone
            onFilesDropped={addImages}
            disabled={isSubmitting || isUploading}
          >
            <div className="bg-white rounded-2xl border border-border shadow-[0_2px_8px_-2px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.05)] p-4">
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

              <form
                onSubmit={handleSubmit}
                className="flex items-end gap-3"
              >
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
                      selectionContext
                        ? "Ask about or edit the selected text..."
                        : "Type your message..."
                    }
                    rows={1}
                    className="min-h-[44px] max-h-32 resize-none border-0 shadow-none focus:ring-0"
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={(!inputValue.trim() && pendingImages.length === 0) || isSubmitting || isUploading}
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

      {/* Edit Agent Modal */}
      {agentData.type === "custom" && (
        <EditAgentModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setUpdateError(null);
          }}
          onSubmit={handleUpdateAgent}
          isLoading={isUpdatingAgent}
          initialTitle={agentData.title}
          initialSystemPrompt={agentData.systemPrompt || ""}
          externalError={updateError}
        />
      )}

      {/* Document Panel */}
      <AgentDocumentPanel
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectionContext(null);
        }}
        documentId={activeDocumentId}
        projectId={projectId as Id<"projects">}
        availableDocuments={availableDocuments}
        onDocumentChange={handleOpenDocument}
        onSelectionChange={handleSelectionChange}
        onContentChange={handleDocumentContentChange}
      />
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

  // Parse document events and citations from assistant messages
  const { cleanContent, documentEvents, citations, hasWebSearch } = isUser
    ? { cleanContent: message.content, documentEvents: [], citations: [], hasWebSearch: false }
    : parseMessageEvents(message.content);

  // Separate document cards (created/updated) from edit notifications
  const documentCards = documentEvents.filter(
    (e) => e.type === "DOCUMENT_CREATED" || e.type === "DOCUMENT_UPDATED"
  );

  // Deduplicate citations by URL
  const uniqueCitations = citations.reduce((acc, citation) => {
    if (!acc.find((c) => c.url === citation.url)) {
      acc.push(citation);
    }
    return acc;
  }, [] as WebSearchCitation[]);

  return (
    <div className={`flex items-start ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] space-y-2 ${isUser ? "" : "font-serif"}`}>
        {/* Web search indicator */}
        {hasWebSearch && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans">
            <SearchIcon className="h-3 w-3" />
            <span>Searched the web</span>
          </div>
        )}

        {/* Display attached images (for user messages) */}
        {isUser && message.imageIds && message.imageIds.length > 0 && (
          <div
            className="rounded-2xl bg-muted-light p-3"
          >
            <ChatImageDisplay imageIds={message.imageIds} />
          </div>
        )}

        {/* Main message content */}
        {cleanContent && (
          <div
            className={`${
              isUser
                ? "rounded-2xl bg-muted-light text-foreground p-4"
                : ""
            }`}
          >
            <div className="prose prose-sm max-w-none">
              <MarkdownRenderer content={cleanContent} isUser={isUser} />
            </div>
          </div>
        )}

        {/* Render citations from web search */}
        {uniqueCitations.length > 0 && (
          <div className="rounded-xl bg-sky-50 p-3 border border-sky-100">
            <div className="flex items-center gap-2 mb-2">
              <GlobeIcon className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-medium text-sky-700">Sources</span>
            </div>
            <div className="space-y-1.5">
              {uniqueCitations.slice(0, 5).map((citation, index) => (
                <a
                  key={`${citation.url}-${index}`}
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-sky-600 hover:text-sky-800 hover:underline truncate"
                  title={citation.title || citation.url}
                >
                  {citation.title || new URL(citation.url).hostname}
                </a>
              ))}
              {uniqueCitations.length > 5 && (
                <span className="text-xs text-sky-500">
                  +{uniqueCitations.length - 5} more sources
                </span>
              )}
            </div>
          </div>
        )}

        {/* Render document cards for created/updated documents */}
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

        {/* Show placeholder if no content yet */}
        {!cleanContent && documentCards.length === 0 && (
          <div>
            <span className="text-muted-foreground italic">...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer
function MarkdownRenderer({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div>
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
          const language = match?.[1] || "";
          const code = match?.[2] || part.slice(3, -3);
          return (
            <pre
              key={index}
              className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-sm"
            >
              {language && (
                <div className="mb-2 text-xs text-muted-foreground">
                  {language}
                </div>
              )}
              <code className="text-foreground">{code.trim()}</code>
            </pre>
          );
        }

        return (
          <span key={index}>
            {part.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInlineMarkdown(line)}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.*?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm">$1</code>');

  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["strong", "em", "code"],
    ALLOWED_ATTR: ["class"],
  });

  return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

// Icons
function SettingsIcon({ className }: { className?: string }) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
