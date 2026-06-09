import { createServiceClient } from "@/lib/supabase/server"
import type { MensajeHistorial } from "@/lib/types"

// GET /api/metricas -> KPIs para el mini-dashboard.
export async function GET() {
  const supabase = createServiceClient()

  const [
    { count: totalMensajes },
    { count: mensajesUsuario },
    { count: mensajesBot },
    { count: totalCasos },
    { count: casosAbiertos },
    { count: usuariosConHumano },
    { data: porSegmento },
    { data: recientesUsuario },
  ] = await Promise.all([
    supabase.from("chats_historial").select("*", { count: "exact", head: true }),
    supabase
      .from("chats_historial")
      .select("*", { count: "exact", head: true })
      .eq("remitente", "usuario"),
    supabase
      .from("chats_historial")
      .select("*", { count: "exact", head: true })
      .eq("remitente", "bot"),
    supabase.from("casos").select("*", { count: "exact", head: true }),
    supabase
      .from("casos")
      .select("*", { count: "exact", head: true })
      .neq("estatus", "resuelto"),
    supabase
      .from("usuarios")
      .select("*", { count: "exact", head: true })
      .eq("ia_activa", false),
    supabase.from("usuarios").select("segmento"),
    supabase
      .from("chats_historial")
      .select("mensaje")
      .eq("remitente", "usuario")
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<Pick<MensajeHistorial, "mensaje">[]>(),
  ])

  // Conteo por segmento
  const conteoSegmentos: Record<string, number> = {}
  for (const u of (porSegmento as { segmento: string }[] | null) ?? []) {
    conteoSegmentos[u.segmento] = (conteoSegmentos[u.segmento] ?? 0) + 1
  }

  // Temas más consultados (heurística por palabras clave del evento)
  const temas: Record<string, string[]> = {
    Horarios: ["hora", "horario", "abre", "empieza", "time", "schedule", "open"],
    Accesos: ["puerta", "acceso", "entrada", "gate", "access", "entry"],
    Estacionamiento: ["estacionamiento", "parking", "auto", "coche", "car"],
    Comida: ["comida", "comer", "food", "eat", "restaurant", "menu"],
    Transporte: ["transporte", "metro", "uber", "taxi", "transport", "bus"],
    Clima: ["clima", "lluvia", "weather", "rain", "frio", "calor"],
  }
  const conteoTemas: Record<string, number> = {}
  for (const { mensaje } of recientesUsuario ?? []) {
    const t = mensaje.toLowerCase()
    for (const [tema, claves] of Object.entries(temas)) {
      if (claves.some((c) => t.includes(c))) {
        conteoTemas[tema] = (conteoTemas[tema] ?? 0) + 1
      }
    }
  }
  const temasTop = Object.entries(conteoTemas)
    .map(([tema, total]) => ({ tema, total }))
    .sort((a, b) => b.total - a.total)

  const tasaAuto =
    (mensajesUsuario ?? 0) > 0
      ? Math.round(((mensajesBot ?? 0) / (mensajesUsuario ?? 1)) * 100)
      : 0

  return Response.json({
    totalMensajes: totalMensajes ?? 0,
    mensajesUsuario: mensajesUsuario ?? 0,
    mensajesBot: mensajesBot ?? 0,
    totalCasos: totalCasos ?? 0,
    casosAbiertos: casosAbiertos ?? 0,
    usuariosConHumano: usuariosConHumano ?? 0,
    tasaAuto,
    conteoSegmentos,
    temasTop,
  })
}
