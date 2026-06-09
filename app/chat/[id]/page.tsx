'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ListaUsuarios } from '@/components/lista-usuarios';
import { VentanaChat } from '@/components/ventana-chat';
import type { Usuario } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data, mutate } = useSWR<{ usuarios: Usuario[] }>('/api/usuarios', fetcher);
  const usuarios = data?.usuarios ?? [];

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const usuarioActual = usuarios.find((u) => u.id === id);

  useEffect(() => {
    if (usuarioActual) {
      setSeleccionadoId(usuarioActual.telefono_simulado);
    }
  }, [usuarioActual]);

  function handleSelect(user: Usuario) {
    router.push(`/chat/${user.id}`);
  }

  const seleccionado = usuarios.find((u) => u.telefono_simulado === seleccionadoId);

  const { data: casoData } = useSWR(
    seleccionado && !seleccionado.ia_activa
      ? `/api/casos?telefono=${encodeURIComponent(seleccionado.telefono_simulado)}`
      : null,
    fetcher,
  );
  const casoActivoId = (casoData?.casos as { id: string }[] | undefined)?.[0]?.id ?? null;

  return (
    <main className='mx-auto box-border flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col gap-5 overflow-hidden px-4 py-6'>
      <div className='grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card/30 md:grid-cols-[300px_1fr]'>
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
              onSelect={handleSelect}
            />
          </div>
        </aside>

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
    </main>
  );
}
