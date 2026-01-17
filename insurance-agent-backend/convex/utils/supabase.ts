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
