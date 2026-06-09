"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { MensajeHistorial, Usuario } from "@/lib/types"
import { horaCorta, inicial, SEGMENTO_BADGE } from "@/lib/ui-helpers"
import { Bot, Send, User, Headset, SlidersHorizontal, Trash2, CheckCircle } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Props {
  usuario: Usuario
  casoActivoId?: string | null
  onCambioEstado: () => void
}

const BURBUJA: Record<
  MensajeHistorial["remitente"],
  { lado: "izq" | "der"; clase: string; icono: typeof Bot; etiqueta: string }
> = {
  usuario: {
    lado: "der",
    clase: "bg-primary text-primary-foreground",
    icono: User,
    etiqueta: "Huésped",
  },
  bot: {
    lado: "izq",
    clase: "bg-card text-card-foreground",
    icono: Bot,
    etiqueta: "Concierge IA",
  },
  humano: {
    lado: "izq",
    clase: "bg-accent/20 text-foreground border border-accent/30",
    icono: Headset,
    etiqueta: "Agente humano",
  },
  sistema: {
    lado: "izq",
    clase: "bg-muted/60 text-muted-foreground text-xs",
    icono: SlidersHorizontal,
    etiqueta: "Sistema",
  },
  human_transfer: {
    lado: "izq",
    clase: "bg-primary/10 text-primary border border-primary/20",
    icono: Headset,
    etiqueta: "Transferencia a humano",
  },
}

export function VentanaChat({ usuario, casoActivoId, onCambioEstado }: Props) {
  const [texto, setTexto] = useState("")
  const [modoAgente, setModoAgente] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [reiniciando, setReiniciando] = useState(false)
  const [resolviendo, setResolviendo] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function resolverCaso() {
    if (!casoActivoId || resolviendo) return
    setResolviendo(true)
    try {
      await fetch("/api/casos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: casoActivoId, estatus: "resuelto" }),
      })
      onCambioEstado()
    } finally {
      setResolviendo(false)
    }
  }

  const { data, mutate, isLoading } = useSWR<{ historial: MensajeHistorial[] }>(
    `/api/historial?telefono=${encodeURIComponent(usuario.telefono_simulado)}`,
    fetcher,
  )

  const historial = data?.historial ?? []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [historial.length])

  useEffect(() => {
    setModoAgente(!usuario.ia_activa)
  }, [usuario.telefono_simulado, usuario.ia_activa])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const mensaje = texto.trim()
    if (!mensaje || enviando) return
    setTexto("")
    setEnviando(true)

    const endpoint = modoAgente ? "/api/agente" : "/api/chat"
    const optimisticMessage: MensajeHistorial = {
      id: Date.now(),
      telefono_simulado: usuario.telefono_simulado,
      remitente: modoAgente ? "humano" : "usuario",
      mensaje,
      created_at: new Date().toISOString(),
    }

    mutate(
      (current) => ({
        historial: [...(current?.historial ?? []), optimisticMessage],
      }),
      { revalidate: false },
    )

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono_simulado: usuario.telefono_simulado,
          mensaje,
        }),
      })
      if (!res.ok) throw new Error("Error al enviar")
      const responseData = await res.json()

      await mutate()

      if (responseData?.escalado) {
        setModoAgente(true)
        setTimeout(() => onCambioEstado(), 2500)
      } else {
        onCambioEstado()
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-muted text-xs font-semibold">
              {inicial(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium leading-tight text-foreground">
              {usuario.nombre}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn("h-4 px-1.5 text-[10px]", SEGMENTO_BADGE[usuario.segmento])}
              >
                {usuario.segmento}
              </Badge>
              <span
                className={cn(
                  "flex items-center gap-1 text-[11px]",
                  usuario.ia_activa ? "text-chart-4" : "text-primary",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    usuario.ia_activa ? "bg-chart-4" : "bg-primary",
                  )}
                />
                {usuario.ia_activa ? "IA activa" : "Atención humana"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!window.confirm("¿Reiniciar conversación? Se generará una nueva llave de contexto.")) return
              setReiniciando(true)
              await fetch(`/api/historial?telefono=${encodeURIComponent(usuario.telefono_simulado)}`, { method: "DELETE" })
              await mutate()
              onCambioEstado()
              setReiniciando(false)
            }}
            disabled={reiniciando}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
          </Button>
          {casoActivoId && (
            <Button
              size="sm"
              variant="default"
              onClick={resolverCaso}
              disabled={resolviendo}
              className="gap-1.5"
            >
              <CheckCircle className="size-3.5" />
              Caso resuelto
            </Button>
          )}
          <Button
            size="sm"
            variant={modoAgente ? "default" : "outline"}
            onClick={() => setModoAgente((v) => !v)}
            className="gap-1.5"
          >
            <Headset className="size-3.5" />
            {modoAgente ? "Modo agente" : "Modo huésped"}
          </Button>
        </div>
      </header>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-background/40 px-4 py-5"
      >
        {isLoading && (
          <p className="text-center text-xs text-muted-foreground">Cargando…</p>
        )}
        {!isLoading && historial.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs text-center text-sm text-muted-foreground">
            <Bot className="mx-auto mb-3 size-8 opacity-50" />
            Escribe un mensaje como {usuario.nombre} para iniciar la conversación
            con el Digital Concierge.
          </div>
        )}
        {historial.map((m) => {
          const cfg = BURBUJA[m.remitente]
          const Icono = cfg.icono
          const sistema = m.remitente === "sistema"
          return (
            <div
              key={m.id}
              className={cn(
                "flex",
                cfg.lado === "der" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-3 py-2 shadow-sm",
                  cfg.clase,
                  sistema && "mx-auto max-w-[90%] text-center",
                )}
              >
                {!sistema && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium opacity-70">
                    <Icono className="size-3" />
                    {cfg.etiqueta}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {m.mensaje}
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-60">
                  <span>{horaCorta(m.created_at)}</span>
                </div>
              </div>
            </div>
          )
        })}
        {enviando && !modoAgente && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-card px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Entrada */}
      <form
        onSubmit={enviar}
        className="flex items-center gap-2 border-t border-border bg-card/60 px-3 py-3 backdrop-blur"
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            modoAgente
              ? "Responder como agente humano…"
              : `Mensaje como ${usuario.nombre}…`
          }
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
        />
        <Button
          type="submit"
          size="icon"
          disabled={enviando || !texto.trim()}
          className="size-10 shrink-0 rounded-full"
        >
          <Send className="size-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </div>
  )
}
