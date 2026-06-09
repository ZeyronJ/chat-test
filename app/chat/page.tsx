'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { MessageSquareText } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { inicial, SEGMENTO_BADGE } from '@/lib/ui-helpers'
import type { Usuario } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ChatListPage() {
  const router = useRouter()
  const { data } = useSWR<{ usuarios: Usuario[] }>('/api/usuarios', fetcher)
  const usuarios = data?.usuarios ?? []

  return (
    <div className='mx-auto box-border flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col gap-5 overflow-hidden px-4 py-6'>
      <header className='flex items-center gap-2'>
        <MessageSquareText className='size-5 text-primary' />
        <h1 className='text-lg font-semibold tracking-tight text-foreground'>
          Conversaciones
        </h1>
      </header>

      <div className='flex-1 overflow-y-auto rounded-xl border border-border bg-card/30'>
        {usuarios.length === 0 && (
          <p className='p-6 text-center text-sm text-muted-foreground'>
            No hay conversaciones disponibles.
          </p>
        )}
        <div className='divide-y divide-border'>
          {usuarios.map((u) => (
            <button
              key={u.id}
              onClick={() => router.push(`/chat/${u.id}`)}
              className='flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/40'
            >
              <Avatar className='size-10 shrink-0'>
                <AvatarFallback className='bg-muted text-xs font-semibold text-foreground'>
                  {inicial(u.nombre)}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-2'>
                  <p className='truncate text-sm font-medium text-foreground'>
                    {u.nombre}
                  </p>
                  {!u.ia_activa && (
                    <span className='size-2 shrink-0 rounded-full bg-primary' title='Atendido por humano' />
                  )}
                </div>
                <div className='mt-1 flex items-center gap-2'>
                  <Badge
                    variant='outline'
                    className={cn('h-5 px-1.5 text-[10px]', SEGMENTO_BADGE[u.segmento])}
                  >
                    {u.segmento}
                  </Badge>
                  <span className='truncate text-xs text-muted-foreground'>
                    {u.telefono_simulado}
                  </span>
                  {!u.ia_activa && (
                    <span className='text-[11px] text-primary'>· Atención humana</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
