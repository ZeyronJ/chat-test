import { generateText } from 'ai';
import { createServiceClient } from '@/lib/supabase/server';
import type {
  BaseConocimiento,
  MensajeHistorial,
  Segmento,
  Usuario,
} from '@/lib/types';

export interface ProcesarResultado {
  respuesta: string | null;
  handoff: boolean;
  ia_activa: boolean;
  origen: 'n8n' | 'ia_integrada' | null;
}

export async function procesarMensaje(
  telefono: string,
  mensaje: string,
): Promise<ProcesarResultado> {
  const supabase = createServiceClient();

  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('telefono_simulado', telefono)
    .maybeSingle<Usuario>();

  if (errUsuario || !usuario) {
    throw new Error(errUsuario ? 'Error consultando usuario' : 'Usuario no encontrado');
  }

  await supabase.from('chats_historial').insert({
    telefono_simulado: telefono,
    remitente: 'usuario',
    mensaje,
  });

  if (!usuario.ia_activa) {
    return { handoff: true, ia_activa: false, respuesta: null, origen: null };
  }

  const { data: conocimiento } = await supabase
    .from('base_conocimiento')
    .select('tema, informacion')
    .returns<Pick<BaseConocimiento, 'tema' | 'informacion'>[]>();

  const kb = conocimiento ?? [];
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  let respuestaBot: string;
  let origen: 'n8n' | 'ia_integrada';

  if (n8nUrl) {
    try {
      const n8nRes = await proxyN8n(n8nUrl, {
        telefono_simulado: telefono,
        mensaje,
        segmento: usuario.segmento,
        nombre: usuario.nombre,
        key: usuario.key,
      });
      respuestaBot = n8nRes.message;
      origen = 'n8n';

      if (n8nRes.humanTransfer) {
        await supabase.from('chats_historial').insert({
          telefono_simulado: telefono,
          remitente: 'bot',
          mensaje: respuestaBot,
        });
        await escalarAHumano(supabase, telefono, mensaje);

        return { handoff: true, ia_activa: false, respuesta: respuestaBot, origen };
      }
    } catch {
      respuestaBot = await responderConIA(usuario, kb, mensaje);
      origen = 'ia_integrada';
    }
  } else {
    respuestaBot = await responderConIA(usuario, kb, mensaje);
    origen = 'ia_integrada';
  }

  await supabase.from('chats_historial').insert({
    telefono_simulado: telefono,
    remitente: 'bot',
    mensaje: respuestaBot,
  });

  return { handoff: false, ia_activa: true, respuesta: respuestaBot, origen };
}

// ── Helpers ──

interface N8nResult {
  message: string;
  humanTransfer: boolean;
}

async function responderConIA(
  usuario: Usuario,
  kb: { tema: string; informacion: string }[],
  mensaje: string,
): Promise<string> {
  try {
    const { text } = await generateText({
      model: 'openai/gpt-5-mini',
      system: construirSystemPrompt(usuario.segmento, kb),
      prompt: mensaje,
    });
    return text.trim();
  } catch {
    return 'Lo siento, tengo problemas en este momento. Inténtalo de nuevo en un instante.';
  }
}

async function proxyN8n(
  url: string,
  payload: Record<string, unknown>,
): Promise<N8nResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`n8n respondió ${res.status}`);
  const data = await res.json();

  if (Array.isArray(data) && data.length > 0 && data[0]?.output) {
    return {
      message: data[0].output.message ?? '',
      humanTransfer: data[0].output.human_transfer ?? false,
    };
  }

  return {
    message:
      data.respuesta ??
      data.reply ??
      data.output ??
      data.text ??
      JSON.stringify(data),
    humanTransfer: false,
  };
}

async function escalarAHumano(
  supabase: ReturnType<typeof createServiceClient>,
  telefono: string,
  mensaje: string,
) {
  await supabase
    .from('usuarios')
    .update({ ia_activa: false })
    .eq('telefono_simulado', telefono);

  const { data: recientes } = await supabase
    .from('chats_historial')
    .select('remitente, mensaje')
    .eq('telefono_simulado', telefono)
    .order('created_at', { ascending: false })
    .limit(6)
    .returns<Pick<MensajeHistorial, 'remitente' | 'mensaje'>[]>();

  const contexto = (recientes ?? [])
    .reverse()
    .map((m) => `${m.remitente}: ${m.mensaje}`)
    .join('\n');

  await supabase.from('casos').insert({
    telefono_simulado: telefono,
    motivo: mensaje.slice(0, 240),
    estatus: 'abierto',
    contexto,
  });
}

const PERFIL_SEGMENTO: Record<
  Segmento,
  { etiqueta: string; tono: string; beneficios: string }
> = {
  VIP: {
    etiqueta: 'VIP / Paddock Club',
    tono: 'Trato exclusivo y muy personalizado. Ofrece asistencia premium proactiva.',
    beneficios:
      'Acceso por Puerta 6, Paddock Club con catering gourmet, grid walk, estacionamiento VIP zona norte y atención prioritaria.',
  },
  Corporativo: {
    etiqueta: 'Corporativo',
    tono: 'Profesional y eficiente. Enfócate en logística de grupos e invitados.',
    beneficios:
      'Suites corporativas, coordinación de grupos, facturación y accesos para invitados de empresa.',
  },
  Hospitalidades: {
    etiqueta: 'Hospitalidades',
    tono: 'Cálido y atento. Resalta la experiencia gastronómica y de confort.',
    beneficios:
      'Suites de hospitalidad en Foro Sol y recta principal, alimentos y bebidas incluidos, pantallas con telemetría.',
  },
  General: {
    etiqueta: 'General',
    tono: 'Amable y claro. Prioriza información práctica de accesos y servicios.',
    beneficios:
      'Acceso por Puertas 1, 2 y 4, zonas gastronómicas con foodtrucks y recomendaciones de transporte público.',
  },
};

function construirSystemPrompt(
  segmento: Segmento,
  conocimiento: { tema: string; informacion: string }[],
): string {
  const perfil = PERFIL_SEGMENTO[segmento];
  const kb = conocimiento
    .map((k) => `- ${k.tema}: ${k.informacion}`)
    .join('\n');

  return `Eres el "Digital Concierge" oficial del Gran Premio de México de Fórmula 1, en el Autódromo Hermanos Rodríguez. Atiendes por un canal tipo WhatsApp. Responde SOLO en español.

PERFIL DEL HUÉSPED:
- Segmento: ${perfil.etiqueta}
- Tono a usar: ${perfil.tono}
- Beneficios de su segmento: ${perfil.beneficios}

BASE DE CONOCIMIENTO DEL EVENTO (única fuente de verdad):
${kb}

REGLAS:
1. Responde de forma breve, cálida y útil, como un mensaje de chat (1-3 frases). No uses markdown ni listas largas.
2. Personaliza según el segmento del huésped y sus beneficios.
3. Usa SOLO la información de la base de conocimiento. Si no sabes algo, dilo con honestidad y ofrece escalar con un agente humano.
4. Nunca inventes horarios, precios ni datos que no estén en la base de conocimiento.
5. Si el huésped pide hablar con una persona o tiene una queja seria, indícale que lo conectarás con un agente humano.`;
}
