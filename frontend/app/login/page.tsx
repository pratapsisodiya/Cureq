'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1a202c]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex items-center justify-center gap-2 group">
          <Activity className="mx-auto h-10 w-10 text-[#01696f]" />
        </Link>
        <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#1a202c]">Sign in to CureQ</h2>
        <p className="mt-2 text-sm text-[#64748b] font-light">
          Access your clinic dashboard
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md flex justify-center">
        <SignIn routing="hash" signUpUrl="/onboarding" forceRedirectUrl="/dashboard/reception" />
      </div>
    </div>
  );
}
