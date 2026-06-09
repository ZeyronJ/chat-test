"use client"

import useSWR from "swr"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { SEGMENTO_BADGE } from "@/lib/ui-helpers"
import type { Caso, EstatusCaso } from "@/lib/types"
import {
  MessageSquare,
  Bot,
  Headset,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Metricas {
  totalMensajes: number
  mensajesUsuario: number
  mensajesBot: number
  totalCasos: number
  casosAbiertos: number
  usuariosConHumano: number
  tasaAuto: number
  conteoSegmentos: Record<string, number>
  temasTop: { tema: string; total: number }[]
}

type CasoConUsuario = Caso & {
  usuarios?: { id: string; nombre: string; segmento: keyof typeof SEGMENTO_BADGE; ia_activa: boolean }
}

const ESTATUS_LABEL: Record<EstatusCaso, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
}

const ESTATUS_CLASE: Record<EstatusCaso, string> = {
  abierto: "bg-primary/15 text-primary border-primary/30",
  en_proceso: "bg-accent/15 text-accent border-accent/30",
  resuelto: "bg-chart-4/15 text-chart-4 border-chart-4/30",
}

export function Dashboard({ onCambio }: { onCambio: () => void }) {
  const router = useRouter()
  const { data: m } = useSWR<Metricas>("/api/metricas", fetcher)
  const { data: casosData, mutate: mutateCasos } = useSWR<{ casos: CasoConUsuario[] }>(
    "/api/casos",
    fetcher,
  )

  const casos = casosData?.casos ?? []

  async function actualizarCaso(id: string, estatus: EstatusCaso) {
    await fetch("/api/casos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estatus }),
    })
    await mutateCasos()
    onCambio()
  }

  const kpis = [
    {
      label: "Mensajes totales",
      valor: m?.totalMensajes ?? 0,
      icono: MessageSquare,
      color: "text-chart-3",
    },
    {
      label: "Respuestas del bot",
      valor: m?.mensajesBot ?? 0,
      icono: Bot,
      color: "text-chart-4",
    },
    {
      label: "Resolución automática",
      valor: `${m?.tasaAuto ?? 0}%`,
      icono: TrendingUp,
      color: "text-accent",
    },
    {
      label: "Casos abiertos",
      valor: m?.casosAbiertos ?? 0,
      icono: TicketCheck,
      color: "text-primary",
    },
    {
      label: "En atención humana",
      valor: m?.usuariosConHumano ?? 0,
      icono: Headset,
      color: "text-primary",
    },
    {
      label: "Escalamientos totales",
      valor: m?.totalCasos ?? 0,
      icono: Users,
      color: "text-chart-3",
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => {
          const Icono = k.icono
          return (
            <Card key={k.label} className="gap-0 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <Icono className={cn("size-4", k.color)} />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {k.valor}
              </p>
            </Card>
          )
        })}
      </div>

        {/* Casos / escalamientos */}
        <Card className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Casos escalados a humano
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Gestiona y resuelve las conversaciones que requieren un agente
          </p>
          <div className="space-y-3">
            {casos.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay casos escalados todavía.
              </p>
            )}
            {casos.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border bg-background/50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.usuarios?.nombre ?? c.telefono_simulado}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {c.motivo}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 text-[10px]", ESTATUS_CLASE[c.estatus])}
                  >
                    {ESTATUS_LABEL[c.estatus]}
                  </Badge>
                </div>
                {c.estatus === "abierto" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 text-xs"
                    onClick={async () => {
                      await actualizarCaso(c.id, "en_proceso")
                      router.push(`/chat/${c.usuarios?.id}`)
                    }}
                  >
                    Tomar caso
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
    </div>
  )
}
