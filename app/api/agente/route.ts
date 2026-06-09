import { createServiceClient } from "@/lib/supabase/server"

// POST /api/agente -> un agente humano responde un mensaje en el chat.
// Esto persiste el mensaje como remitente "humano". Mantiene ia_activa = false.
export async function POST(req: Request) {
  let body: { telefono_simulado?: string; mensaje?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const telefono = body.telefono_simulado?.trim()
  const mensaje = body.mensaje?.trim()
  if (!telefono || !mensaje) {
    return Response.json({ error: "Faltan datos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Asegurar que la IA esté desactivada mientras el humano atiende.
  await supabase
    .from("usuarios")
    .update({ ia_activa: false })
    .eq("telefono_simulado", telefono)

  const { error } = await supabase.from("chats_historial").insert({
    telefono_simulado: telefono,
    remitente: "humano",
    mensaje,
  })

  if (error) {
    return Response.json({ error: "No se pudo enviar el mensaje" }, { status: 500 })
  }
  return Response.json({ ok: true })
}
