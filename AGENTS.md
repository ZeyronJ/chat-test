## Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (MCP)
- **Frameworks**: `ai` + `@ai-sdk/react` (integración IA), `swr` (data fetching), `tailwindcss` v4
- **Analytics**: `@vercel/analytics`
- **UI**: shadcn components (`/components/ui`)

## Supabase (MCP)

- **Project ID**: `hbpcweqviwxjignqylqj`
- **URL**: `https://hbpcweqviwxjignqylqj.supabase.co`
- Herramientas MCP: `supabase_execute_sql`, `supabase_apply_migration`, `supabase_list_tables`, `supabase_generate_typescript_types`, etc.
- Para consultas usar `supabase_execute_sql` con `project_id: hbpcweqviwxjignqylqj`

## Clientes Supabase

- `lib/supabase/client.ts` — cliente browser (NEXT_PUBLIC_SUPABASE_URL + anon key)
- `lib/supabase/server.ts` — cliente servidor con service role key (para rutas API)

## Tablas (public)

- `usuarios` — id (uuid), telefono_simulado (varchar, unique), nombre, segmento, ia_activa (bool), created_at
- `chats_historial` — id (bigint), telefono_simulado, remitente, mensaje (text), created_at
- `casos` — id (uuid), telefono_simulado, motivo, estatus, contexto, created_at, updated_at
- `base_conocimiento` — id (uuid), tema, informacion (text), created_at

## Tipos principales

Definidos en `lib/types.ts`:

- `Segmento`: `"VIP" | "Corporativo" | "Hospitalidades" | "General"`
- `Remitente`: `"usuario" | "bot" | "humano" | "sistema"`
- `EstatusCaso`: `"abierto" | "en_proceso" | "resuelto"`
- `Usuario`, `MensajeHistorial`, `Caso`, `BaseConocimiento`

## API Routes

- `POST /api/chat` — endpoint principal del concierge (procesa mensaje, persiste, responde vía n8n o IA integrada)
- `GET /api/usuarios` — listar usuarios
- `GET/POST /api/historial` — historial de chat por teléfono
- `GET /api/metricas` — métricas del dashboard
- `GET/POST /api/casos` — casos de escalamiento
- `GET /api/agente` — datos del agente (pendiente)

## Concierge

- `requiereEscalamiento(texto)` — detecta intención de hablar con humano
- `PERFIL_SEGMENTO` — tono y beneficios por segmento
- `construirSystemPrompt(segmento, kb)` — prompt segmentado para la IA (inline en `app/api/chat/route.ts`)

## Commands

```bash
npm run dev       # Next.js dev server
npm run build     # Build producción
npm run lint      # ESLint
```

## Agent Rules

- Respuestas en español
- Minimal responses, technical precision
- No usar tipo `any`
- Usar componentes shadcn (`/components/ui`)
- No hacer build al finalizar
