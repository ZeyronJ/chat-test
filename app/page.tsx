'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ListaUsuarios } from '@/components/lista-usuarios';
import { VentanaChat } from '@/components/ventana-chat';
import { Dashboard } from '@/components/dashboard';
import type { Usuario } from '@/lib/types';
import { Flag, MessageSquareText, LayoutDashboard } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  );
}

function PageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, mutate } = useSWR<{ usuarios: Usuario[] }>(
    '/api/usuarios',
    fetcher,
  );
  const usuarios = data?.usuarios ?? [];
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tab, setTab] = useState('chat');

  useEffect(() => {
    if (usuarios.length === 0) return;
    const usuarioId = searchParams.get('usuario');
    if (usuarioId) {
      const user = usuarios.find((u) => u.id === usuarioId);
      if (user) {
        setSeleccionadoId(user.telefono_simulado);
        setTab('chat');
        return;
      }
    }
    if (!seleccionadoId) {
      setSeleccionadoId(usuarios[0].telefono_simulado);
    }
  }, [usuarios, searchParams]);

  useEffect(() => {
    if (!seleccionadoId) return;
    const user = usuarios.find((u) => u.telefono_simulado === seleccionadoId);
    if (!user) return;
    if (searchParams.get('usuario') === user.id) return;
    router.replace(`/?usuario=${user.id}`, { scroll: false });
  }, [seleccionadoId, usuarios, router, searchParams]);

  const seleccionado = usuarios.find(
    (u) => u.telefono_simulado === seleccionadoId,
  );

  const { data: casoData } = useSWR(
    seleccionado && !seleccionado.ia_activa
      ? `/api/casos?telefono=${encodeURIComponent(seleccionado.telefono_simulado)}`
      : null,
    fetcher,
  );
  const casoActivoId = (casoData?.casos as { id: string }[] | undefined)?.[0]?.id ?? null;

  return (
    <main className='mx-auto flex h-screen max-w-6xl flex-col gap-5 overflow-hidden px-4 py-6'>
      {/* Encabezado */}
      <header className='flex items-center gap-3'>
        <div className='flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
          <Flag className='size-5' />
        </div>
        <div>
          <h1 className='text-balance text-lg font-semibold tracking-tight text-foreground'>
            Digital Concierge — GP de México F1
          </h1>
          <p className='text-xs text-muted-foreground'>
            Asistente conversacional con segmentación, escalamiento humano e
            historial · Autódromo Hermanos Rodríguez
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className='flex min-h-0 flex-1 flex-col'>
        <TabsList>
          <TabsTrigger value='chat' className='gap-1.5'>
            <MessageSquareText className='size-4' />
            Simulador de chat
          </TabsTrigger>
          <TabsTrigger value='dashboard' className='gap-1.5'>
            <LayoutDashboard className='size-4' />
            Panel de control
          </TabsTrigger>
        </TabsList>

        <TabsContent value='chat' className='mt-4 min-h-0 flex-1'>
          <div className='grid h-full grid-cols-1 overflow-hidden rounded-xl border border-border bg-card/30 md:grid-cols-[300px_1fr]'>
            {/* Lista de huéspedes */}
            <aside className='flex flex-col border-b border-border md:border-b-0 md:border-r'>
              <div className='border-b border-border px-4 py-3'>
                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                  Huéspedes simulados
                </p>
              </div>
              <div className='flex-1 overflow-y-auto'>
                <ListaUsuarios
                  usuarios={usuarios}
                  seleccionado={seleccionado}
                  onSelect={(u) => setSeleccionadoId(u.telefono_simulado)}
                />
              </div>
            </aside>

            {/* Conversación */}
            <section className='min-h-0'>
              {seleccionado ? (
                <VentanaChat
                  key={seleccionado.telefono_simulado}
                  usuario={seleccionado}
                  casoActivoId={casoActivoId}
                  onCambioEstado={() => mutate()}
                />
              ) : (
                <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
                  Selecciona un huésped para comenzar
                </div>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value='dashboard' className='mt-4 min-h-0 flex-1 overflow-hidden'>
          <Dashboard onCambio={() => mutate()} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
