import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** A Supabase client bound to a schema. */
export type Db = SupabaseClient<Database>;
