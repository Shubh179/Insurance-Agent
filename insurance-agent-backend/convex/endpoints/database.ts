import { httpAction } from "../_generated/server";
import { getSupabaseClient } from "../utils/supabase";

// Test Supabase connection
export const testConnection = httpAction(async (ctx) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    // Test database connection by querying Supabase
    const { data, error } = await supabase
      .from("users")
      .select("count")
      .limit(1);

    if (error) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Database connection failed",
          error: error.message,
          hint: "Make sure tables are created in Supabase. Run supabase_schema.sql",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "connected",
        message: "Supabase connection successful",
        database: "postgresql",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Create a test user
export const createTestUser = httpAction(async (ctx, request) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    const body = (await request.json()) as { email?: string; googleId?: string };
    const { email, googleId } = body;

    if (!email || !googleId) {
      return new Response(
        JSON.stringify({
          error: "Email and googleId are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        email,
        google_id: googleId,
        access_token: "test_token_" + Date.now(),
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: error.message,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: "User created successfully",
        data,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

// Get all users
export const getUsers = httpAction(async (ctx) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("users")
      .select("id, email, google_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        count: data?.length || 0,
        users: data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
