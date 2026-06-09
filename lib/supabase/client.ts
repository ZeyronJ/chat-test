import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Cliente de navegador (singleton) para componentes client-side.
let browserClient: ReturnType<typeof createSupabaseClient> | undefined

export function createClient() {
  if (browserClient) return browserClient

  browserClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return browserClient
}
