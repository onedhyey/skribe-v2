import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Agent types that match the schema
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

// Get all agents for a project (with ownership check)
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
      .query("agents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

// Get a single agent by ID (with ownership check)
export const getById = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    return agent;
  },
});

// Get agent with its messages (with ownership check)
export const getWithMessages = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    // Verify project ownership
    const project = await ctx.db.get(agent.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("asc")
      .collect();

    return { ...agent, messages };
  },
});

// Get agent (chat) by document ID (with ownership check)
export const getByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    // Verify document ownership via project
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    // Find agent linked to this document
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    return agent;
  },
});

// Get agent (chat) by document ID with messages (with ownership check)
export const getByDocumentWithMessages = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) {
      return null;
    }

    // Verify document ownership via project
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      return null;
    }

    const project = await ctx.db.get(document.projectId);
    if (!project || project.userId !== user._id) {
      return null;
    }

    // Find agent linked to this document
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .unique();

    if (!agent) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
      .order("asc")
      .collect();

    return { ...agent, messages };
  },
});

// Create a new agent (optionally linked to a document)
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: agentTypes,
    title: v.string(),
    systemPrompt: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    // Verify project ownership
    await verifyProjectOwnership(ctx, args.projectId, user._id);

    // If documentId provided, verify it belongs to this project
    if (args.documentId) {
      const document = await ctx.db.get(args.documentId);
      if (!document || document.projectId !== args.projectId) {
        throw new Error("Document not found or does not belong to this project");
      }
    }

    const now = Date.now();

    const agentId = await ctx.db.insert("agents", {
      projectId: args.projectId,
      documentId: args.documentId,
      type: args.type,
      title: args.title,
      systemPrompt: args.systemPrompt,
      createdAt: now,
      updatedAt: now,
    });

    return agentId;
  },
});

// Update agent title, system prompt, or document link
export const update = mutation({
  args: {
    agentId: v.id("agents"),
    title: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const { agentId, ...updates } = args;

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, agent.projectId, user._id);

    // If documentId provided, verify it belongs to this project
    if (updates.documentId) {
      const document = await ctx.db.get(updates.documentId);
      if (!document || document.projectId !== agent.projectId) {
        throw new Error("Document not found or does not belong to this project");
      }
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(agentId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Get recent agents for a project (limited for sidebar) - with ownership check
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
      .query("agents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(args.limit ?? 10);
  },
});

// Delete an agent and its messages (including images)
export const remove = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Verify project ownership
    await verifyProjectOwnership(ctx, agent.projectId, user._id);

    // Delete all messages in the agent and their associated images
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    let totalImageSize = 0;
    let totalImageCount = 0;

    for (const message of messages) {
      // Delete associated images
      if (message.imageIds && message.imageIds.length > 0) {
        for (const storageId of message.imageIds) {
          const metadata = await ctx.storage.getMetadata(storageId);
          if (metadata) {
            totalImageSize += metadata.size;
            totalImageCount++;
            await ctx.storage.delete(storageId);
          }
        }
      }
      await ctx.db.delete(message._id);
    }

    // Update user storage usage if images were deleted (on users table)
    if (totalImageCount > 0) {
      await ctx.db.patch(user._id, {
        storageTotalBytes: Math.max(0, (user.storageTotalBytes ?? 0) - totalImageSize),
        storageImageCount: Math.max(0, (user.storageImageCount ?? 0) - totalImageCount),
        updatedAt: Date.now(),
      });
    }

    // Delete the agent
    await ctx.db.delete(args.agentId);
  },
});
