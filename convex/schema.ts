import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    githubConnected: v.boolean(),
    // Encrypted GitHub access token - use lib/encryption for encrypt/decrypt
    encryptedGitHubToken: v.optional(v.string()),
    // Initialization vector for token encryption
    githubTokenIv: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("pro")
    ),
    subscriptionStatus: v.union(
      v.literal("trial"),
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("expired")
    ),
    trialEndsAt: v.optional(v.number()),
    subscriptionEndsAt: v.optional(v.number()),
    polarCustomerId: v.optional(v.string()),
    // Storage usage tracking (folded from userStorage)
    storageTotalBytes: v.optional(v.number()),
    storageImageCount: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  projects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    githubRepoId: v.optional(v.string()),
    githubRepoName: v.optional(v.string()),
    githubRepoUrl: v.optional(v.string()),
    feedbackApiKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_github_repo", ["githubRepoId"])
    .index("by_feedback_api_key", ["feedbackApiKey"]),

  documents: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("prd"),
      v.literal("persona"),
      v.literal("market"),
      v.literal("brand"),
      v.literal("business"),
      v.literal("feature"),
      v.literal("tech"),
      v.literal("gtm"),
      v.literal("landing"),
      v.literal("custom")
    ),
    syncStatus: v.union(
      v.literal("synced"),
      v.literal("pending"),
      v.literal("error")
    ),
    lastSyncedHash: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    // Link to the AI chat for this document (bidirectional with agents.documentId)
    chatId: v.optional(v.id("agents")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_type", ["projectId", "type"])
    .index("by_chat", ["chatId"]),

  agents: defineTable({
    projectId: v.id("projects"),
    // Link to the document this chat is associated with (bidirectional with documents.chatId)
    documentId: v.optional(v.id("documents")),
    type: v.union(
      v.literal("idea_refinement"),
      v.literal("market_validation"),
      v.literal("brand_strategy"),
      v.literal("customer_persona"),
      v.literal("business_model"),
      v.literal("new_features"),
      v.literal("tech_stack"),
      v.literal("create_prd"),
      v.literal("go_to_market"),
      v.literal("landing_page"),
      v.literal("feedback_analysis"),
      v.literal("custom")
    ),
    title: v.string(),
    systemPrompt: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_type", ["projectId", "type"])
    .index("by_document", ["documentId"]),

  messages: defineTable({
    agentId: v.id("agents"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    imageIds: v.optional(v.array(v.id("_storage"))),
    createdAt: v.number(),
  }).index("by_agent", ["agentId"]),

  agentTemplates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    systemPrompt: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  feedback: defineTable({
    projectId: v.id("projects"),
    content: v.string(),
    email: v.optional(v.string()),
    metadata: v.optional(v.any()),
    source: v.string(),
    category: v.optional(v.string()),
    sentiment: v.optional(v.string()),
    processed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_date", ["projectId", "createdAt"]),
});
