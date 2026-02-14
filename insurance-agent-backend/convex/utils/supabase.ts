import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Types for database tables
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthProvider {
  id: string;
  user_id: string;
  provider: "google" | "github" | "microsoft";
  provider_user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id?: string;
  user_id: string;
  message_id: string;
  from: string;
  to: string;
  subject: string;
  body?: string;
  is_spam: boolean;
  is_insurance_related: boolean;
  category?: "insurance" | "spam" | "other";
  received_at: string;
  fetched_at?: string;
  created_at?: string;
}

export interface Persona {
  id?: string;
  user_id: string;
  persona_data: any; // JSON object
  generated_at: string;
  updated_at?: string;
}

export interface AgentLog {
  id?: string;
  user_id: string;
  agent_type: "environment_sense" | "spam_filter" | "persona_gen";
  status: "pending" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  started_at: string;
  completed_at?: string;
}

export interface Session {
  id: string;
  user_id: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}

// Create Supabase client with credentials
export function getSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Use native fetch in Node.js environment
      fetch: fetch.bind(globalThis),
    },
  });
}

// --- CORS Utility ---
const ALLOWED_ORIGINS = [
  "https://insurance-agent-frontend-kappa.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

/**
 * Get the allowed CORS origin for a request.
 * Returns the origin if it's in the allowlist, otherwise the production frontend URL.
 */
export function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0]; // default to production frontend
}

/**
 * Build standard CORS headers for a response.
 */
export function corsHeaders(request: Request, methods = "POST, GET, OPTIONS"): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getCorsOrigin(request),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// --- Rate Limiting Utility ---

/**
 * Check if a user has exceeded the rate limit for an endpoint.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Count recent requests
  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("requested_at", windowStart);

  if (error) {
    console.error(`[RateLimit] Error checking rate limit: ${error.message}`);
    return { allowed: true }; // fail open on DB errors
  }

  if ((count ?? 0) >= maxRequests) {
    return { allowed: false, retryAfterSeconds: windowMinutes * 60 };
  }

  // Record this request
  await supabase.from("rate_limits").insert({
    user_id: userId,
    endpoint,
    requested_at: new Date().toISOString(),
  });

  return { allowed: true };
}
