import { createServiceClient } from "@/lib/supabase/server"
import type { MensajeHistorial } from "@/lib/types"

// GET /api/historial?telefono=... -> historial completo de un usuario.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefono = searchParams.get("telefono")?.trim()

  if (!telefono) {
    return Response.json({ error: "Falta el parámetro telefono" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("chats_historial")
    .select("*")
    .eq("telefono_simulado", telefono)
    .order("created_at", { ascending: true })
    .returns<MensajeHistorial[]>()

  if (error) {
    return Response.json({ error: "Error consultando historial" }, { status: 500 })
  }
  return Response.json({ historial: data ?? [] })
}

// DELETE /api/historial?telefono=... -> reinicia el chat: borra mensajes,
// genera nueva key, reactiva IA y resuelve casos abiertos.
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefono = searchParams.get("telefono")?.trim()

  if (!telefono) {
    return Response.json({ error: "Falta el parámetro telefono" }, { status: 400 })
  }

  const supabase = createServiceClient()

  await supabase.from("chats_historial").delete().eq("telefono_simulado", telefono)

  await supabase
    .from("usuarios")
    .update({ ia_activa: true, key: crypto.randomUUID() })
    .eq("telefono_simulado", telefono)

  await supabase
    .from("casos")
    .update({ estatus: "resuelto", updated_at: new Date().toISOString() })
    .eq("telefono_simulado", telefono)
    .neq("estatus", "resuelto")

  return Response.json({ ok: true })
}
