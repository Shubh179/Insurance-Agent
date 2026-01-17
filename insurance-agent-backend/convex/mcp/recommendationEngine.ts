"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getSupabaseClient } from "../utils/supabase";

/**
 * MCP Prompt 4: Recommendation Engine
 * Generates personalized insurance recommendations
 */
export const recommendationEngineAction = internalAction({
  args: { userId: v.string(), context: v.optional(v.string()) },
  handler: async (_ctx, { userId, context }) => {
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

    // Fetch ALL user's existing policies and claims
    const { data: emails, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .order("received_at", { ascending: false });

    if (emailError) {
      throw new Error(`Failed to fetch emails: ${emailError.message}`);
    }

    const userContext = emails
      ?.map((e: any) => `${e.category}: ${e.subject}\nBody: ${e.body || ''}\nSnippet: ${e.raw_snippet}`)
      .join("\n") || "No insurance data available";

    const prompt = `Based on the user's insurance portfolio and profile, generate actionable recommendations.

Current Portfolio:
${userContext}

Additional Context: ${context || "General recommendation"}

Respond with JSON:
{
  "recommendations": [
    {
      "title": "string",
      "category": "coverage|optimization|savings|compliance",
      "description": "string",
      "estimated_benefit": "string (e.g., '15-20% savings')",
      "priority": "high|medium|low",
      "action_items": ["list of specific actions"],
      "expected_timeline": "string"
    }
  ],
  "overall_priority": "urgent|high|medium|low",
  "estimated_total_impact": "string (e.g., 'Save 20-30% on premiums')",
  "confidence_level": "number 0-1"
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
            ],
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Gemini API error: ${res.status} - ${JSON.stringify(errorData)}`);
      }

      const data = (await res.json()) as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());

      return {
        status: "success",
        recommendations: result.recommendations || [],
        priority: result.overall_priority || "medium",
        estimated_impact: result.estimated_total_impact || "Unknown",
      };
    } catch (error) {
      throw new Error(`Recommendation generation failed: ${String(error)}`);
    }
  },
});
