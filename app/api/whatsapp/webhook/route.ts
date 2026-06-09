import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { procesarMensaje } from '@/lib/chat-processor';
import { createServiceClient } from '@/lib/supabase/server';
import type { Usuario } from '@/lib/types';

export const maxDuration = 30;

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;

function getClient() {
  return new WhatsAppClient({
    baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    kapsoApiKey: process.env.KAPSO_API_KEY!,
  });
}

async function encontrarOCrearUsuario(waId: string): Promise<Usuario> {
  const supabase = createServiceClient();

  const { data: existente } = await supabase
    .from('usuarios')
    .select('*')
    .eq('wa_id', waId)
    .maybeSingle<Usuario>();

  if (existente) return existente;

  const { data: nuevo, error } = await supabase
    .from('usuarios')
    .insert({
      telefono_simulado: waId,
      wa_id: waId,
      nombre: 'WhatsApp User',
      segmento: 'General',
      key: crypto.randomUUID(),
    })
    .select()
    .maybeSingle<Usuario>();

  if (error || !nuevo) {
    throw new Error('No se pudo crear el usuario de WhatsApp');
  }

  return nuevo;
}

interface ParsedMessage {
  from: string;
  text: string;
  name?: string;
}

function parseMessagePayload(payload: Record<string, unknown>): ParsedMessage | null {
  // Kapso actual: { message: { from, text: { body } }, conversation: { contact_name? } }
  const msg = payload.message as Record<string, unknown> | undefined;
  if (msg?.from && msg?.text) {
    const from = msg.from as string;
    const textBody = msg.text as Record<string, unknown> | undefined;
    const text = (textBody?.body as string | undefined) ?? textBody as unknown as string;
    const conv = payload.conversation as Record<string, unknown> | undefined;
    const name = conv?.contact_name as string | undefined;
    if (text) return { from, text, name };
  }

  // Kapso v2 envelope (test): { event: "whatsapp.message.received", data: { message, contacts } }
  if (payload.event === 'whatsapp.message.received') {
    const data = payload.data as Record<string, unknown> | undefined;
    if (!data) return null;
    const msgK = data.message as Record<string, unknown> | undefined;
    if (!msgK) return null;
    const from = msgK.from as string | undefined;
    const textBody = msgK.text as Record<string, unknown> | undefined;
    const text = textBody?.body as string | undefined ?? msgK.text as string | undefined;
    const contacts = data.contacts as Array<Record<string, unknown>> | undefined;
    const profile = contacts?.[0]?.profile as Record<string, unknown> | undefined;
    if (from && text) return { from, text, name: profile?.name as string | undefined };
  }

  // Meta raw forwarding
  const entry = payload.entry as Array<Record<string, unknown>> | undefined;
  if (entry?.[0]) {
    const changes = entry[0].changes as Array<Record<string, unknown>> | undefined;
    const value = changes?.[0]?.value as Record<string, unknown> | undefined;
    const messages = value?.messages as Array<Record<string, unknown>> | undefined;
    if (messages?.[0]) {
      const m = messages[0];
      const from = m.from as string | undefined;
      const textBody = m.text as Record<string, unknown> | undefined;
      const text = textBody?.body as string | undefined;
      const contacts = value?.contacts as Array<Record<string, unknown>> | undefined;
      const profile = contacts?.[0]?.profile as Record<string, unknown> | undefined;
      if (from && text) return { from, text, name: profile?.name as string | undefined };
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log('[WEBHOOK RAW]', raw);

    const payload = JSON.parse(raw);
    console.log('[WEBHOOK PARSED] event:', payload.event, '| keys:', Object.keys(payload));

    const parsed = parseMessagePayload(payload);
    console.log('[WEBHOOK PARSE RESULT]', parsed ? JSON.stringify(parsed) : 'null');

    if (!parsed) {
      console.log('[WEBHOOK] No se pudo parsear el payload, OK');
      return new Response('OK', { status: 200 });
    }

    const { from, text, name } = parsed;
    console.log(`[WEBHOOK] Procesando: from=${from}, text="${text}", name=${name}`);

    const usuario = await encontrarOCrearUsuario(from);
    console.log(`[WEBHOOK] Usuario: id=${usuario.id}, telefono=${usuario.telefono_simulado}, wa_id=${usuario.wa_id}`);

    if (name && usuario.nombre === 'WhatsApp User') {
      await createServiceClient()
        .from('usuarios')
        .update({ nombre: name })
        .eq('id', usuario.id);
      console.log(`[WEBHOOK] Nombre actualizado a: ${name}`);
    }

    console.log('[WEBHOOK] Llamando procesarMensaje...');
    const resultado = await procesarMensaje(usuario.telefono_simulado, text);
    console.log('[WEBHOOK] procesarMensaje resultado:', JSON.stringify(resultado));

    if (resultado.respuesta) {
      console.log(`[WEBHOOK] Enviando respuesta por WhatsApp a ${from}: "${resultado.respuesta.slice(0, 100)}..."`);
      try {
        const client = getClient();
        await client.messages.sendText({
          phoneNumberId: PHONE_NUMBER_ID,
          to: from,
          body: resultado.respuesta,
        });
        console.log('[WEBHOOK] Mensaje enviado exitosamente');
      } catch (sendErr) {
        console.error('[WEBHOOK] Error al enviar mensaje WhatsApp:', sendErr);
      }
    } else {
      console.log('[WEBHOOK] No se envía respuesta: sin respuesta');
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err);
    return new Response('OK', { status: 200 });
  }
}
