import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Cliente de servidor con la service role key.
// Usado por las rutas API: opera con privilegios para leer/escribir el
// historial, segmentos y casos sin depender de una sesion de usuario.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
