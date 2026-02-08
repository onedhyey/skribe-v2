import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Document types that match the schema
const documentTypes = v.union(
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
);

const syncStatuses = v.union(
  v.literal("synced"),
  v.literal("pending"),
  v.literal("error")
);

/**
 * Helper to get authenticated user from context.
 */
async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user;
}

/**
 * Helper to require authenticated user.
 */
async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: You must be logged in");
  }
  return user;
}

/**
 * Helper to verify project ownership.
 */
async function verifyProjectOwnership(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  userId: Id<"users">
) {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found");
  }
  if (project.userId !== userId) {
    throw new Error("Unauthorized: You do not own this project");
  }
  return project;
}

// Get all documents for a project (with ownership check)
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single document by ID (with ownership check)
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      return null;
    }

    // Verify ownership through project
    const project = await ctx.db.get(doc.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return doc;
  },
});

// Get documents by type for a project (with ownership check)
export const getByType = query({
  args: {
    projectId: v.id("projects"),
    type: documentTypes,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", args.type)
      )
      .collect();
  },
});

// Agent types that match the schema (for createWithChat)
const agentTypes = v.union(
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
);

// Create a new document
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
    type: documentTypes,
    chatId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project ownership
    await verifyProjectOwnership(ctx, args.projectId, user._id);

    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      title: args.title,
      content: args.content,
      type: args.type,
      chatId: args.chatId,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return documentId;
  },
});

// Create a document with a linked chat (agent) atomically
export const createWithChat = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    content: v.string(),
    documentType: documentTypes,
    agentType: agentTypes,
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project ownership
    await verifyProjectOwnership(ctx, args.projectId, user._id);

    const now = Date.now();

    // Create the document first
    const documentId = await ctx.db.insert("documents", {
      projectId: args.projectId,
      title: args.title,
      content: args.content,
      type: args.documentType,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create the linked agent/chat
    const agentId = await ctx.db.insert("agents", {
      projectId: args.projectId,
      documentId: documentId,
      type: args.agentType,
      title: args.title,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    // Update document with the chat link
    await ctx.db.patch(documentId, {
      chatId: agentId,
    });

    return { documentId, agentId };
  },
});

// Update a document
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    type: v.optional(documentTypes),
    chatId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { documentId, ...updates } = args;

    const doc = await ctx.db.get(documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify ownership through project
    await verifyProjectOwnership(ctx, doc.projectId, user._id);

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    // If content changed, mark as pending sync
    const shouldUpdateSyncStatus =
      updates.content !== undefined && updates.content !== doc.content;

    await ctx.db.patch(documentId, {
      ...filteredUpdates,
      ...(shouldUpdateSyncStatus ? { syncStatus: "pending" as const } : {}),
      updatedAt: Date.now(),
    });
  },
});

// Get recent documents for a project (for sidebar) - with ownership check
export const getRecentByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

// Update sync status
export const updateSyncStatus = mutation({
  args: {
    documentId: v.id("documents"),
    syncStatus: syncStatuses,
    lastSyncedHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify ownership through project
    await verifyProjectOwnership(ctx, doc.projectId, user._id);

    await ctx.db.patch(args.documentId, {
      syncStatus: args.syncStatus,
      lastSyncedHash: args.lastSyncedHash,
      lastSyncedAt: args.syncStatus === "synced" ? Date.now() : doc.lastSyncedAt,
      updatedAt: Date.now(),
    });
  },
});

// Delete a document
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify ownership through project
    await verifyProjectOwnership(ctx, doc.projectId, user._id);

    await ctx.db.delete(args.documentId);
  },
});

// Create a chat for an existing document (lazy migration)
export const createChatForDocument = mutation({
  args: {
    documentId: v.id("documents"),
    agentType: v.optional(agentTypes),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new Error("Document not found");
    }

    // Verify ownership through project
    await verifyProjectOwnership(ctx, doc.projectId, user._id);

    // If document already has a chat, return that
    if (doc.chatId) {
      return doc.chatId;
    }

    const now = Date.now();

    // Map document type to default agent type
    const docTypeToAgentType: Record<string, string> = {
      prd: "create_prd",
      persona: "customer_persona",
      market: "market_validation",
      brand: "brand_strategy",
      business: "business_model",
      feature: "new_features",
      tech: "tech_stack",
      gtm: "go_to_market",
      landing: "landing_page",
      custom: "custom",
    };

    const agentType = args.agentType ?? docTypeToAgentType[doc.type] ?? "custom";

    // Create the linked agent/chat
    const agentId = await ctx.db.insert("agents", {
      projectId: doc.projectId,
      documentId: args.documentId,
      type: agentType as "idea_refinement" | "market_validation" | "brand_strategy" | "customer_persona" | "business_model" | "new_features" | "tech_stack" | "create_prd" | "go_to_market" | "landing_page" | "feedback_analysis" | "custom",
      title: doc.title,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    // Update document with the chat link
    await ctx.db.patch(args.documentId, {
      chatId: agentId,
      updatedAt: now,
    });

    return agentId;
  },
});

// Get all documents for a project formatted for AI context (with ownership check)
export const getContextForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return [];
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== user._id) {
      return [];
    }

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Format documents for context injection
    return documents.map((doc) => ({
      title: doc.title,
      type: doc.type,
      content: doc.content,
      updatedAt: doc.updatedAt,
    }));
  },
});

