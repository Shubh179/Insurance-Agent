/**
 * Moved to internal action - queries cannot use fetch()
 * See convex/mcp/getEmailsAction.ts instead
 */
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getEmailsForPersona = query({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    // This query can only access Convex database
    // For Supabase fetching, use getEmailsAction instead
    throw new Error("Use internal action getEmailsAction instead of this query");
  },
});
