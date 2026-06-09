import { procesarMensaje } from '@/lib/chat-processor';

export const maxDuration = 30;

export async function POST(req: Request) {
  let body: { telefono_simulado?: string; mensaje?: string };
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

  try {
    const resultado = await procesarMensaje(telefono, mensaje);

    return Response.json({
      handoff: resultado.handoff,
      ia_activa: resultado.ia_activa,
      respuesta: resultado.respuesta,
      origen: resultado.origen,
      escalado: resultado.handoff,
      mensaje_sistema: resultado.handoff
        ? 'Un agente humano está atendiendo esta conversación.'
        : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    return Response.json({ error: message }, { status: 500 });
  }
}
