'use client';

import { Dashboard } from '@/components/dashboard';

export default function Page() {
  return (
    <main className='mx-auto box-border flex h-full max-w-6xl flex-col gap-5 overflow-hidden px-4 py-6'>
      <Dashboard onCambio={() => {}} />
    </main>
  );
}
