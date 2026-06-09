import type { Segmento } from "@/lib/types"

export const SEGMENTOS: Segmento[] = [
  "VIP",
  "Corporativo",
  "Hospitalidades",
  "General",
]

// Clases de color por segmento (badges / etiquetas).
export const SEGMENTO_BADGE: Record<Segmento, string> = {
  VIP: "bg-primary/15 text-primary border-primary/30",
  Corporativo: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  Hospitalidades: "bg-accent/15 text-accent border-accent/30",
  General: "bg-muted text-muted-foreground border-border",
}

export function inicial(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
