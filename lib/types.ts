export type Segmento = "VIP" | "Corporativo" | "Hospitalidades" | "General"

export type Remitente = "usuario" | "bot" | "humano" | "sistema" | "human_transfer" | "whatsapp"

export type EstatusCaso = "abierto" | "en_proceso" | "resuelto"

export interface Usuario {
  id: string
  telefono_simulado: string
  wa_id: string | null
  nombre: string
  segmento: Segmento
  ia_activa: boolean
  key: string
  created_at: string
}

export interface MensajeHistorial {
  id: number
  telefono_simulado: string
  remitente: Remitente
  mensaje: string
  created_at: string
}

export interface Caso {
  id: string
  telefono_simulado: string
  motivo: string
  estatus: EstatusCaso
  contexto: string | null
  created_at: string
  updated_at: string
}

export interface BaseConocimiento {
  id: string
  tema: string
  informacion: string
  created_at: string
}
