import { getSupabaseClient } from "../utils/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface DeterministicAggregates {
  total_emails_last_year: number;
  total_insurance_emails: number;
  insurance_ratio: number;
  category_counts: {
    renewal: number;
    claim: number;
    payment: number;
    new_policy: number;
    general: number;
  };
  recent_activity_days: number;
  most_recent_email_date: string | null;
}

export interface EnvironmentProfile {
  insurance_activity_level: "low" | "moderate" | "high" | "none";
  renewal_responsiveness: "low" | "medium" | "high" | "none";
  claim_behavior: "low" | "medium" | "high" | "none";
  engagement_style: "reactive" | "preventive" | "none";
  risk_profile: "risk_averse" | "neutral" | "risk_prone" | "unknown";
}

export interface EnvironmentSummary {
  timeframe: "last_1_year";
  environment_summary: EnvironmentProfile;
  derived_from: "deterministic_aggregates" | "deterministic_guardrail";
  confidence: number;
}

/**
 * Step 1: Compute deterministic aggregates (NO AI, NO interpretation)
 * Strict READ-ONLY from metadata only
 */
export async function computeDeterministicAggregates(userId: string): Promise<DeterministicAggregates> {
  try {
    // Calculate 1 year ago cutoff
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const cutoffDate = oneYearAgo.toISOString();

    console.log(`[EnvironmentAgent] Computing aggregates for user ${userId}`);

    // Single query: fetch metadata only (no bodies, no attachments)
    const { data: emails, error: queryError } = await supabase
      .from("emails")
      .select("is_insurance_related, is_spam, category, received_at")
      .eq("user_id", userId)
      .gte("received_at", cutoffDate)
      .order("received_at", { ascending: false });

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    const allEmails = emails || [];
    console.log(`[EnvironmentAgent] Fetched ${allEmails.length} emails from last 1 year`);

    // Deterministic aggregation
    const totalEmails = allEmails.length;
    const insuranceEmails = allEmails.filter((e) => e.is_insurance_related && !e.is_spam);
    const totalInsurance = insuranceEmails.length;

    // Category counts (deterministic)
    const categoryCounts = {
      renewal: insuranceEmails.filter((e) => e.category === "renewal").length,
      claim: insuranceEmails.filter((e) => e.category === "claim").length,
      payment: insuranceEmails.filter((e) => e.category === "payment").length,
      new_policy: insuranceEmails.filter((e) => e.category === "new_policy").length,
      general: insuranceEmails.filter((e) => e.category === "general").length,
    };

    // Insurance ratio (deterministic)
    const insuranceRatio = totalEmails > 0 ? totalInsurance / totalEmails : 0;

    // Recent activity (days since last insurance email)
    const mostRecentInsurance = insuranceEmails[0];
    let recentActivityDays = 365; // default to max if no insurance emails
    if (mostRecentInsurance?.received_at) {
      const lastEmailDate = new Date(mostRecentInsurance.received_at);
      recentActivityDays = Math.floor((now.getTime() - lastEmailDate.getTime()) / (24 * 60 * 60 * 1000));
    }

    const aggregates: DeterministicAggregates = {
      total_emails_last_year: totalEmails,
      total_insurance_emails: totalInsurance,
      insurance_ratio: Math.round(insuranceRatio * 100) / 100,
      category_counts: categoryCounts,
      recent_activity_days: recentActivityDays,
      most_recent_email_date: mostRecentInsurance?.received_at || null,
    };

    console.log(`[EnvironmentAgent] Aggregates computed:`, JSON.stringify(aggregates, null, 2));

    return aggregates;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EnvironmentAgent] Aggregation error: ${message}`);
    throw new Error(`Failed to compute aggregates: ${message}`);
  }
}

/**
 * Step 2: Call Gemini with ONLY aggregated metrics (NO raw data)
 */
async function getEnvironmentProfileFromGemini(aggregates: DeterministicAggregates): Promise<EnvironmentProfile> {
  if (!GEMINI_API_KEY) {
    console.warn(`[EnvironmentAgent] GEMINI_API_KEY not set, using defaults`);
    return getDefaultEnvironmentProfile();
  }

  try {
    const prompt = `Given the following user activity summary, generate an environment profile.

Data:
- Total emails last year: ${aggregates.total_emails_last_year}
- Insurance emails: ${aggregates.total_insurance_emails}
- Insurance ratio: ${aggregates.insurance_ratio}
- Renewal emails: ${aggregates.category_counts.renewal}
- Claim emails: ${aggregates.category_counts.claim}
- Payment emails: ${aggregates.category_counts.payment}
- New policy emails: ${aggregates.category_counts.new_policy}
- General emails: ${aggregates.category_counts.general}
- Days since last insurance email: ${aggregates.recent_activity_days}

Output a JSON with:
- insurance_activity_level (low | moderate | high)
- renewal_responsiveness (low | medium | high)
- claim_behavior (low | medium | high)
- engagement_style (reactive | preventive)
- risk_profile (risk_averse | neutral | risk_prone)

Do NOT include explanations. Do NOT include assumptions. Output JSON only.`;

    console.log(`[EnvironmentAgent] Calling Gemini API`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EnvironmentAgent] Gemini error: ${errorText}`);
      return getDefaultEnvironmentProfile();
    }

    const data = (await response.json()) as any;
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[EnvironmentAgent] No JSON found in Gemini response`);
      return getDefaultEnvironmentProfile();
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[EnvironmentAgent] Gemini response parsed successfully`);

    return {
      insurance_activity_level: parsed.insurance_activity_level || "moderate",
      renewal_responsiveness: parsed.renewal_responsiveness || "medium",
      claim_behavior: parsed.claim_behavior || "medium",
      engagement_style: parsed.engagement_style || "reactive",
      risk_profile: parsed.risk_profile || "neutral",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EnvironmentAgent] Gemini call failed: ${message}`);
    return getDefaultEnvironmentProfile();
  }
}

/**
 * Fallback profile when Gemini is unavailable or fails
 */
function getDefaultEnvironmentProfile(): EnvironmentProfile {
  return {
    insurance_activity_level: "moderate",
    renewal_responsiveness: "medium",
    claim_behavior: "medium",
    engagement_style: "reactive",
    risk_profile: "neutral",
  };
}

/**
 * Main agent: Compute aggregates + optional Gemini call (with guardrail)
 * GUARDRAIL: Skip Gemini if zero insurance emails (deterministic > AI)
 */
export async function generateEnvironmentSummary(userId: string): Promise<EnvironmentSummary> {
  try {
    const startTime = Date.now();

    console.log(`[EnvironmentAgent] Starting environment analysis for user ${userId}`);

    // Step 1: Deterministic aggregation
    const aggregates = await computeDeterministicAggregates(userId);

    // GUARDRAIL: If no insurance data, short-circuit (NO Gemini call)
    if (aggregates.total_insurance_emails === 0) {
      console.log(`[EnvironmentAgent] Guardrail triggered: Zero insurance emails, skipping Gemini`);

      const executionTime = Date.now() - startTime;
      console.log(`[EnvironmentAgent] Analysis complete (guardrail) in ${executionTime}ms`);

      return {
        timeframe: "last_1_year",
        environment_summary: {
          insurance_activity_level: "none",
          renewal_responsiveness: "none",
          claim_behavior: "none",
          engagement_style: "none",
          risk_profile: "unknown",
        },
        derived_from: "deterministic_guardrail",
        confidence: 0.0,
      };
    }

    // Step 2: AI-assisted profile (advisory only, only if data exists)
    const environmentProfile = await getEnvironmentProfileFromGemini(aggregates);

    const executionTime = Date.now() - startTime;
    console.log(`[EnvironmentAgent] Analysis complete in ${executionTime}ms`);

    // Confidence based on data volume
    const confidence = Math.min(aggregates.total_insurance_emails / 10, 1.0);

    return {
      timeframe: "last_1_year",
      environment_summary: environmentProfile,
      derived_from: "deterministic_aggregates",
      confidence: Math.round(confidence * 100) / 100,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[EnvironmentAgent] Summary generation failed: ${message}`);
    throw new Error(`Environment summary generation failed: ${message}`);
  }
}
