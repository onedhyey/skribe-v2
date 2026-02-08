"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, Modal, Textarea } from "@/components/ui";
import { useState } from "react";

export default function FeedbackPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // Fetch project data
  const project = useQuery(
    api.projects.getById,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch API key
  const apiKey = useQuery(
    api.feedback.getApiKey,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Fetch feedback list
  const feedbackList = useQuery(
    api.feedback.listByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Feedback count
  const feedbackCount = useQuery(
    api.feedback.getCountByProject,
    projectId ? { projectId: projectId as Id<"projects"> } : "skip"
  );

  // Mutations
  const generateApiKey = useMutation(api.feedback.generateApiKey);
  const deleteFeedback = useMutation(api.feedback.remove);
  const createManualFeedback = useMutation(api.feedback.createManual);

  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerateApiKey = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      await generateApiKey({ projectId: projectId as Id<"projects"> });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate API key");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const handleCopyWebhookUrl = async () => {
    if (!apiKey) return;
    const webhookUrl = `${window.location.origin}/api/feedback/${apiKey}`;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const handleDeleteFeedback = async (feedbackId: Id<"feedback">) => {
    try {
      await deleteFeedback({ feedbackId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete feedback");
    }
  };

  const handleAddFeedback = async () => {
    if (isSubmitting || !feedbackContent.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createManualFeedback({
        projectId: projectId as Id<"projects">,
        content: feedbackContent.trim(),
      });
      setFeedbackContent("");
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (project === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted-foreground/10">
            <XIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-serif text-xl font-bold text-foreground">
            Project Not Found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This project doesn&apos;t exist or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Feedback
        </h1>
        <p className="mt-1 text-muted-foreground">
          Collect user feedback from your app and analyze it with AI
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-destructive hover:text-destructive/80"
              aria-label="Dismiss error"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* API Key Section */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <KeyIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-foreground">Webhook Setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this webhook URL to receive feedback from your app. POST feedback to this endpoint from any form.
              </p>

              {apiKey ? (
                <div className="mt-4 space-y-4">
                  {/* Webhook URL */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Webhook URL
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                        {window.location.origin}/api/feedback/{apiKey}
                      </code>
                      <button
                        onClick={handleCopyWebhookUrl}
                        className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                      >
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      API Key
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono">
                        {apiKey}
                      </code>
                      <button
                        onClick={handleCopyApiKey}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        Copy Key
                      </button>
                    </div>
                  </div>

                  {/* Regenerate */}
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateApiKey}
                      disabled={isGenerating}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isGenerating ? "Regenerating..." : "Regenerate API Key"}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Warning: Regenerating will invalidate the current key
                    </p>
                  </div>

                  {/* Usage Example */}
                  <div className="pt-4 border-t">
                    <label className="text-xs font-medium text-muted-foreground">
                      Example Request
                    </label>
                    <pre className="mt-2 rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto">
{`curl -X POST ${window.location.origin}/api/feedback/${apiKey} \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Great app! Would love dark mode.",
    "email": "user@example.com",
    "source": "widget"
  }'`}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={isGenerating}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? "Generating..." : "Generate API Key"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-foreground">
          Submissions {feedbackCount !== undefined && `(${feedbackCount})`}
        </h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Feedback
        </button>
      </div>

      {feedbackList === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      ) : feedbackList.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <InboxIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-medium text-foreground">No feedback yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {apiKey
                ? "Feedback submitted to your webhook will appear here."
                : "Generate an API key above to start collecting feedback."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbackList.map((feedback) => (
            <Card key={feedback._id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {feedback.content}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(feedback.createdAt)}</span>
                      {feedback.email && (
                        <>
                          <span>•</span>
                          <span>{feedback.email}</span>
                        </>
                      )}
                      {feedback.source && (
                        <>
                          <span>•</span>
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            {feedback.source}
                          </span>
                        </>
                      )}
                      {feedback.category && (
                        <>
                          <span>•</span>
                          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5">
                            {feedback.category}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFeedback(feedback._id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"
                    aria-label="Delete feedback"
                  >
                    <TrashIcon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Feedback Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFeedbackContent("");
        }}
        title="Add Feedback"
        description="Manually add feedback to your project."
      >
        <div className="space-y-4">
          <Textarea
            value={feedbackContent}
            onChange={(e) => setFeedbackContent(e.target.value)}
            placeholder="Enter feedback content..."
            rows={4}
            className="w-full"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setFeedbackContent("");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddFeedback}
              disabled={isSubmitting || !feedbackContent.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Adding..." : "Add Feedback"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Icons
function KeyIcon({ className }: { className?: string }) {
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
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
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

function InboxIcon({ className }: { className?: string }) {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
