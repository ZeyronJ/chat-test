import { createServiceClient } from "@/lib/supabase/server"
import type { Usuario } from "@/lib/types"

// GET /api/usuarios -> lista de usuarios semilla para el simulador.
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<Usuario[]>()

  if (error) {
    return Response.json({ error: "Error consultando usuarios" }, { status: 500 })
  }
  return Response.json({ usuarios: data ?? [] })
}
