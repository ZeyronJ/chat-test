"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Usuario } from "@/lib/types"
import { inicial, SEGMENTO_BADGE } from "@/lib/ui-helpers"

interface Props {
  usuarios: Usuario[]
  seleccionado?: Usuario
  onSelect: (u: Usuario) => void
}

export function ListaUsuarios({ usuarios, seleccionado, onSelect }: Props) {
  return (
    <div className="flex flex-col">
      {usuarios.map((u) => {
        const activo = u.telefono_simulado === seleccionado?.telefono_simulado
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u)}
            className={cn(
              "flex items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/60",
              activo && "bg-secondary",
            )}
          >
            <Avatar className="size-10 shrink-0">
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                {inicial(u.nombre)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {u.nombre}
                </p>
                {!u.ia_activa && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" title="Atendido por humano" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn("h-5 px-1.5 text-[10px]", SEGMENTO_BADGE[u.segmento])}
                >
                  {u.segmento}
                </Badge>
                <span className="truncate text-xs text-muted-foreground">
                  {u.telefono_simulado}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
