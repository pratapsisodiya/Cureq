'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import { useClerkSync } from '../../src/utils/useClerkSync';

export default function DashboardIndex() {
  const { syncing, isSignedIn } = useClerkSync();
  const router = useRouter();

  useEffect(() => {
    if (syncing) return;

    if (!isSignedIn) {
      router.replace('/login');
      return;
    }

    const role = localStorage.getItem('cureq_role');
    if (role === 'DOCTOR') {
      router.replace('/dashboard/doctor');
    } else {
      router.replace('/dashboard/reception');
    }
  }, [syncing, isSignedIn, router]);

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center text-[#1a202c]">
      <div className="flex flex-col items-center gap-4 text-[#01696f] animate-pulse">
        <Activity className="h-10 w-10 animate-spin" />
        <p className="text-sm font-semibold uppercase tracking-widest">Redirecting to your console...</p>
      </div>
    </div>
  );
}
