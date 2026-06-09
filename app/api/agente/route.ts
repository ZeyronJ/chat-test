import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { createServiceClient } from '@/lib/supabase/server';

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
    return Response.json({ error: 'Faltan datos' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from('usuarios')
    .update({ ia_activa: false })
    .eq('telefono_simulado', telefono);

  await serviceClient.from('chats_historial').insert({
    telefono_simulado: telefono,
    remitente: 'humano',
    mensaje,
  });

  // Send reply via WhatsApp if the user has a wa_id
  if (process.env.KAPSO_API_KEY && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const { data: usuario } = await serviceClient
      .from('usuarios')
      .select('wa_id')
      .eq('telefono_simulado', telefono)
      .maybeSingle<{ wa_id: string | null }>();

    if (usuario?.wa_id) {
      try {
        const client = new WhatsAppClient({
          baseUrl: 'https://api.kapso.ai/meta/whatsapp',
          kapsoApiKey: process.env.KAPSO_API_KEY,
        });
        await client.messages.sendText({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          to: usuario.wa_id,
          body: mensaje,
        });
      } catch {
        // Log but don't fail — message was already persisted
      }
    }
  }

  return Response.json({ ok: true });
}
