'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Flag, LayoutDashboard, MessageSquareText } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Conversaciones', icon: MessageSquareText },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className=' bg-card/80 backdrop-blur'>
      <nav className='mx-auto flex h-14 max-w-6xl items-center gap-6 px-4'>
        <Link href='/' className='flex shrink-0 items-center gap-2'>
          <div className='flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <Flag className='size-4' />
          </div>
          <span className='hidden text-sm font-semibold text-foreground sm:inline'>
            Digital Concierge
          </span>
        </Link>

        <div className='flex items-center gap-1'>
          {links.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className='size-4' />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
