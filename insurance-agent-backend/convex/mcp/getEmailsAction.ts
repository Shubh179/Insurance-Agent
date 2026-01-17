"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal action to fetch emails from Supabase
 * Actions support external network calls with "use node" directive
 */
export const getEmailsAction = internalAction({
  args: { user_id: v.string() },
  handler: async (ctx, { user_id }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase not configured");
    }

    const baseUrl = SUPABASE_URL.startsWith("http")
      ? SUPABASE_URL
      : `https://${SUPABASE_URL}`;
    const emailsUrl = `${baseUrl}/rest/v1/emails?select=*&user_id=eq.${user_id}&is_insurance_related=eq.true&order=received_at.desc&limit=20`;

    const response = await fetch(emailsUrl, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch emails: ${response.status} ${errorText}`);
    }

    return await response.json();
  },
});
