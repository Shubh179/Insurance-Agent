"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getSupabaseClient } from "../utils/supabase";

/**
 * MCP Prompt 5: Conversation Simulator
 * Simulates AI customer service conversations about insurance
 */
export const conversationSimulatorAction = internalAction({
  args: { 
    userId: v.string(), 
    userMessage: v.string(), 
    conversationHistory: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))) 
  },
  handler: async (_ctx, { userId, userMessage, conversationHistory }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase not configured");
    }

    if (!GEMINI_API_KEY) {
      throw new Error("Gemini API key not configured");
    }

    const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch ALL user insurance data for context
    const { data: emails, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .order("received_at", { ascending: false });

    if (emailError) {
      throw new Error(`Failed to fetch user context: ${emailError.message}`);
    }

    const userContext = emails
      ?.map((e: any) => `- ${e.category}: ${e.subject}\nBody: ${e.body || ''}\nSnippet: ${e.raw_snippet}`)
      .join("\n") || "No insurance context";

    const conversationContext =
      conversationHistory
        ?.map((m) => `${m.role}: ${m.content}`)
        .join("\n") || "Start of conversation";

    const prompt = `You are a helpful insurance agent assistant. Respond to the user's message with empathy and expertise.

User's Insurance Context:
${userContext}

Conversation History:
${conversationContext}

Current User Message: "${userMessage}"

Respond ONLY with valid JSON in this exact format:
{
  "agent_response": "string",
  "suggested_actions": ["action1", "action2"],
  "sentiment_detected": "neutral",
  "requires_escalation": false,
  "confidence_score": 0.8
}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            ],
          }),
        }
      );

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Gemini API error: ${res.status} - ${errorBody}`);
      }

      const data = (await res.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());

      return {
        status: "success",
        agent_response: result.agent_response || "I'm here to help with your insurance questions.",
        suggested_actions: result.suggested_actions || [],
        sentiment: result.sentiment_detected || "neutral",
      };
    } catch (error) {
      throw new Error(`Conversation simulation failed: ${String(error)}`);
    }
  },
});
