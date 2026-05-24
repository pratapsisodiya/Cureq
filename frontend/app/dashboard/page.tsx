'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardIndex() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem('cureq_role');
    if (role === 'DOCTOR') {
      router.replace('/dashboard/doctor');
    } else {
      router.replace('/dashboard/reception');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center text-[#1a202c]">
      <p className="text-sm font-light">Redirecting to dashboard...</p>
    </div>
  );
}
