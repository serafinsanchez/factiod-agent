import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase environment variables are not configured. " +
        "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });
}

export function getSupabaseServerClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createServerClient();
  }
  return cachedClient;
}

/**
 * Checks if a Supabase error is a schema cache error (PGRST205).
 * Returns a helpful message if it is, or null otherwise.
 */
export function getSchemaCacheErrorMessage(error: {
  code?: string;
  message?: string;
}): string | null {
  if (error.code === "PGRST205") {
    return (
      "Schema cache error: The 'projects' table is not found in Supabase's schema cache. " +
      "This usually happens when:\n" +
      "1. The table doesn't exist - Run the migration SQL from 'supabase/migrations/001_create_projects_table.sql'\n" +
      "2. The schema cache needs refreshing - Go to Supabase Dashboard > Settings > API > 'Rebuild Schema Cache'\n" +
      "See README.md for detailed setup instructions."
    );
  }
  return null;
}


