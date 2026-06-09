import { generateText } from 'ai';
import { createServiceClient } from '@/lib/supabase/server';
import type {
  BaseConocimiento,
  MensajeHistorial,
  Segmento,
  Usuario,
} from '@/lib/types';

export const maxDuration = 30;

interface ChatBody {
  telefono_simulado?: string;
  mensaje?: string;
}

interface N8nResult {
  message: string;
  humanTransfer: boolean;
}

/**
 * POST /api/chat
 *
 * Punto de entrada único del Digital Concierge.
 * Flujo:
 *  1. Valida al usuario por telefono_simulado y obtiene su segmento + ia_activa.
 *  2. Persiste el mensaje entrante del usuario.
 *  3. Si ia_activa = false -> el caso está en manos de un humano: NO responde el bot.
 *  4. Si hay N8N_WEBHOOK_URL -> reenvía a n8n como proxy.
 *  5. n8n decide vía human_transfer si escala a agente humano.
 *  6. Si no hay n8n o falla -> fallback con asistente IA integrado (sin escalamiento local).
 */
export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const telefono = body.telefono_simulado?.trim();
  const mensaje = body.mensaje?.trim();

  if (!telefono || !mensaje) {
    return Response.json(
      { error: 'Faltan telefono_simulado o mensaje' },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // 1. Validar usuario y segmento
  const { data: usuario, error: errUsuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('telefono_simulado', telefono)
    .maybeSingle<Usuario>();

  if (errUsuario) {
    return Response.json(
      { error: 'Error consultando usuario' },
      { status: 500 },
    );
  }
  if (!usuario) {
    return Response.json(
      { error: 'Usuario no registrado en el evento' },
      { status: 404 },
    );
  }

  // 2. Persistir mensaje entrante
  await supabase.from('chats_historial').insert({
    telefono_simulado: telefono,
    remitente: 'usuario',
    mensaje,
  });

  // 3. Si la IA está desactivada, un humano está atendiendo: no responde el bot.
  if (!usuario.ia_activa) {
    return Response.json({
      handoff: true,
      ia_activa: false,
      respuesta: null,
      mensaje_sistema: 'Un agente humano está atendiendo esta conversación.',
    });
  }

  // 4. Cargar base de conocimiento
  const { data: conocimiento } = await supabase
    .from('base_conocimiento')
    .select('tema, informacion')
    .returns<Pick<BaseConocimiento, 'tema' | 'informacion'>[]>();

  const kb = conocimiento ?? [];

  // 5a. Si hay webhook de n8n configurado -> actuar como proxy.
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

        return Response.json({
          handoff: true,
          ia_activa: false,
          escalado: true,
          respuesta: respuestaBot,
        });
      }
    } catch {
      // Si n8n falla, degradamos al asistente integrado para no romper el demo.
      respuestaBot = await responderConIA(usuario, kb, mensaje);
      origen = 'ia_integrada';
    }
  } else {
    // 5b. Fallback: asistente IA integrado con segmentación + KB.
    respuestaBot = await responderConIA(usuario, kb, mensaje);
    origen = 'ia_integrada';
  }

  // 6. Persistir respuesta del bot
  await supabase.from('chats_historial').insert({
    telefono_simulado: telefono,
    remitente: 'bot',
    mensaje: respuestaBot,
  });

  return Response.json({
    handoff: false,
    ia_activa: true,
    origen,
    respuesta: respuestaBot,
  });
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

  // Formato array: [{ output: { message, human_transfer } }]
  if (Array.isArray(data) && data.length > 0 && data[0]?.output) {
    return {
      message: data[0].output.message ?? '',
      humanTransfer: data[0].output.human_transfer ?? false,
    };
  }

  // Fallback a propiedades planas (respuesta, reply, output, text)
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
  // Desactivar IA para que el bot deje de responder.
  await supabase
    .from('usuarios')
    .update({ ia_activa: false })
    .eq('telefono_simulado', telefono);

  // Tomar contexto reciente para el agente humano.
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

// ── Helpers ─────────────────────

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
