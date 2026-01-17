import { getSupabaseClient } from "../utils/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export interface InsuranceSummary {
  timeframe: "last_1_year";
  total_insurance_emails: number;
  category_breakdown: {
    renewal: number;
    claim: number;
    payment: number;
    new_policy: number;
    general: number;
  };
  most_recent_email_date: string | null;
  oldest_email_date: string | null;
}

/**
 * Analyze insurance-related emails from the last 1 year (deterministic, no AI)
 */
export async function analyzeInsuranceEmails(userId: string): Promise<InsuranceSummary> {
  try {
    // Calculate cutoff date: 1 year ago from now
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const cutoffDate = oneYearAgo.toISOString();

    console.log(`[InsuranceAnalyzer] Analyzing insurance emails for user ${userId}`);
    console.log(`[InsuranceAnalyzer] Cutoff date: ${cutoffDate}`);

    // Single optimized query: insurance-only, non-spam, last 1 year
    const { data: insuranceEmails, error: queryError } = await supabase
      .from("emails")
      .select("id, category, received_at, is_insurance_related, is_spam")
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .eq("is_spam", false)
      .gte("received_at", cutoffDate)
      .order("received_at", { ascending: false });

    if (queryError) {
      console.error(`[InsuranceAnalyzer] Query error: ${queryError.message}`);
      throw new Error(`Failed to fetch insurance emails: ${queryError.message}`);
    }

    const emails = insuranceEmails || [];
    console.log(`[InsuranceAnalyzer] Found ${emails.length} insurance emails in last 1 year`);

    // Initialize category breakdown
    const categoryBreakdown = {
      renewal: 0,
      claim: 0,
      payment: 0,
      new_policy: 0,
      general: 0,
    };

    // Categorized aggregation
    for (const email of emails) {
      const category = (email.category as keyof typeof categoryBreakdown) || "general";
      if (category in categoryBreakdown) {
        categoryBreakdown[category]++;
      } else {
        categoryBreakdown.general++;
      }
    }

    // Most recent and oldest dates
    const mostRecentEmail = emails.length > 0 ? emails[0] : null;
    const oldestEmail = emails.length > 0 ? emails[emails.length - 1] : null;

    const summary: InsuranceSummary = {
      timeframe: "last_1_year",
      total_insurance_emails: emails.length,
      category_breakdown: categoryBreakdown,
      most_recent_email_date: mostRecentEmail?.received_at || null,
      oldest_email_date: oldestEmail?.received_at || null,
    };

    console.log(`[InsuranceAnalyzer] Summary:`, JSON.stringify(summary, null, 2));

    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[InsuranceAnalyzer] Analysis error: ${message}`);
    throw new Error(`Insurance email analysis failed: ${message}`);
  }
}

/**
 * Quick stat: count insurance emails with optional filters
 */
export async function countInsuranceEmails(
  userId: string,
  options?: { category?: string; daysBack?: number }
): Promise<number> {
  try {
    let query = supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_insurance_related", true)
      .eq("is_spam", false);

    if (options?.daysBack) {
      const cutoff = new Date(Date.now() - options.daysBack * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("received_at", cutoff);
    }

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    const { count, error } = await query;

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error(`[InsuranceAnalyzer] Count error: ${String(error)}`);
    return 0;
  }
}
