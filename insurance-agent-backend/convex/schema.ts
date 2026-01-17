import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - stores user information and tokens
  users: defineTable({
    email: v.string(),
    googleId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_googleId", ["googleId"]),

  // Emails table - stores fetched emails from Gmail
  emails: defineTable({
    userId: v.id("users"),
    gmailMessageId: v.string(),
    sender: v.string(),
    subject: v.string(),
    rawSnippet: v.optional(v.string()),
    isSpam: v.boolean(),
    isInsuranceRelated: v.boolean(),
    category: v.optional(v.string()), // "insurance", "spam", "other"
    confidence: v.optional(v.number()),
    classifiedBy: v.optional(v.string()), // "rules", "rules+ai"
    receivedAt: v.number(),
    fetchedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_gmailMessageId", ["gmailMessageId"])
    .index("by_isInsuranceRelated", ["isInsuranceRelated"]),

  // Agent logs - stores agent execution logs
  agentLogs: defineTable({
    userId: v.id("users"),
    agentType: v.string(), // "environment_sense", "spam_filter", "persona_gen"
    status: v.string(), // "pending", "running", "completed", "failed"
    result: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  // Personas table - stores generated personas
  personas: defineTable({
    userId: v.id("users"),
    personaData: v.string(), // JSON stringified persona
    generatedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Health check logs - for monitoring
  healthChecks: defineTable({
    timestamp: v.number(),
    status: v.string(), // "healthy", "degraded", "unhealthy"
    message: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),
});
