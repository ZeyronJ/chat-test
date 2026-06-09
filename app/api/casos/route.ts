import { createServiceClient } from "@/lib/supabase/server"
import type { Caso, EstatusCaso } from "@/lib/types"

// GET /api/casos -> lista de casos (escalamientos a humano) con datos del usuario.
// Query params opcionales: ?telefono=XXX (filtra por usuario, excluye resueltos)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefono = searchParams.get("telefono")

  const supabase = createServiceClient()

  let query = supabase
    .from("casos")
    .select("*, usuarios(id, nombre, segmento, ia_activa)")

  if (telefono) {
    query = query.eq("telefono_simulado", telefono).neq("estatus", "resuelto")
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return Response.json({ error: "Error consultando casos" }, { status: 500 })
  }
  return Response.json({ casos: data ?? [] })
}

// PATCH /api/casos -> actualizar estatus de un caso.
// Si se marca como "resuelto", se reactiva la IA del usuario.
export async function PATCH(req: Request) {
  let body: { id?: string; estatus?: EstatusCaso }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!body.id || !body.estatus) {
    return Response.json({ error: "Faltan id o estatus" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: caso, error } = await supabase
    .from("casos")
    .update({ estatus: body.estatus, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select()
    .maybeSingle<Caso>()

  if (error || !caso) {
    return Response.json({ error: "No se pudo actualizar el caso" }, { status: 500 })
  }

  // Al resolver, devolvemos el control al bot (reactivamos la IA).
  if (body.estatus === "resuelto") {
    await supabase
      .from("usuarios")
      .update({ ia_activa: true })
      .eq("telefono_simulado", caso.telefono_simulado)

    await supabase.from("chats_historial").insert({
      telefono_simulado: caso.telefono_simulado,
      remitente: "sistema",
      mensaje:
        "Caso resuelto. El asistente automático vuelve a estar disponible.",
    })
  }

  return Response.json({ caso })
}
