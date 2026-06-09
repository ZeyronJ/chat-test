# Digital Concierge — GP de México F1

Asistente conversacional tipo WhatsApp para atender asistentes premium (Hospitalidades y Paddock Club) del Gran Premio de México. Demo funcional con IA, segmentación por perfil, escalamiento humano y dashboard de KPIs.

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TailwindCSS v4 + shadcn/ui
- **Base de datos**: Supabase (Postgres)
- **IA**: Vercel AI SDK (`ai` + `@ai-sdk/react`) con OpenAI o proveedor compatible
- **Data fetching**: SWR
- **Analytics**: @vercel/analytics

## Requisitos

- Node.js 22+
- pnpm 10+
- Una cuenta de Supabase (proyecto con Postgres)
- Una API key de OpenAI (o proveedor compatible)

## Empezar

```bash
# 1. Clonar e instalar
pnpm install

# 2. Agregar variables de entorno (enviadas por correo)
.env

# 3. Iniciar dev server
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Variables de entorno

| Variable                        | Descripción                                         |
| ------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key del proyecto Supabase                      |
| `SUPABASE_URL`                  | URL del proyecto Supabase                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key (para rutas API)                   |
| `N8N_WEBHOOK_URL`               | (Opcional) Webhook de n8n para orquestación externa |

## Arquitectura

```
app/
├── api/
│   ├── chat/route.ts     → POST: procesa mensaje, IA + escalamiento
│   ├── usuarios/route.ts → GET: listar huéspedes
│   ├── historial/route.ts → GET/DELETE: historial de conversación
│   ├── casos/route.ts     → GET/PATCH: CRUD de casos
│   ├── metricas/route.ts  → GET: KPIs del dashboard
│   └── agente/route.ts    → POST: agente humano responde
├── page.tsx               → UI principal (chat + dashboard)
├── layout.tsx             → Root layout con dark mode
└── globals.css            → Tailwind v4 + shadcn tokens
components/
├── ventana-chat.tsx       → Chat conversacional (simula WhatsApp)
├── lista-usuarios.tsx     → Sidebar con huéspedes
├── dashboard.tsx          → KPIs y lista de casos
└── ui/                    → Componentes shadcn
lib/
├── types.ts               → Tipos compartidos
├── utils.ts               → cn() helper
├── ui-helpers.ts          → Constantes de UI
└── supabase/
    ├── client.ts          → Cliente browser
    └── server.ts          → Cliente servidor (service role)
```

### Flujo del chat

1. El usuario se identifica por `telefono_simulado` → se obtiene su segmento
2. El mensaje se persiste en `chats_historial`
3. Si `ia_activa = false` → un agente humano está atendiendo, el bot no responde
4. Si hay webhook de n8n → se envía el mensaje a n8n como proxy (n8n decide si escalar)
5. Si no hay n8n o falla → fallback con IA integrada (`generateText` + prompt segmentado)
6. Si n8n señala `humanTransfer` → se desactiva la IA y se crea un caso
7. La respuesta del bot se persiste y se devuelve al cliente

### Segmentación

Cada segmento tiene tono y beneficios personalizados:

- **VIP / Paddock Club**: Trato exclusivo, asistencia premium proactiva
- **Corporativo**: Profesional y eficiente, enfoque en logística de grupos
- **Hospitalidades**: Cálido y atento, énfasis en experiencia gastronómica
- **General**: Amable y claro, prioriza información práctica

### Escalamiento humano

Ocurre cuando n8n envía `humanTransfer: true`. El sistema:

1. Desactiva `ia_activa` para ese usuario
2. Toma los últimos 6 mensajes como contexto
3. Crea un registro en `casos` con estatus `abierto`
4. El agente humano responde vía `POST /api/agente`
5. Al resolver el caso (PATCH a `resuelto`), se reactiva la IA

## Lo que quedó fuera

- **Mapa**: Agregar un componente con la ubicación del Autódromo y Google Maps embed.
- **Pruebas automatizadas**: Se priorizó el flujo funcional. Pendiente agregar tests con Vitest + Playwright.

## Licencia

MIT
