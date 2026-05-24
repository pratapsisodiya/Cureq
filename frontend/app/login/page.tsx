'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '../../src/utils/api';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Login to get JWT
      const loginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      const token = loginRes.token;
      localStorage.setItem('cureq_token', token);
      localStorage.setItem('cureq_role', loginRes.user.role);

      // 2. Fetch full user context (clinic + branch IDs)
      const meRes = await apiRequest('/auth/me');
      const user = meRes.user;

      if (user.role === 'CLINIC_ADMIN' && user.clinicAdmin) {
        localStorage.setItem('cureq_clinic_id', user.clinicAdmin.id);
        const firstBranch = user.clinicAdmin.branches?.[0];
        if (firstBranch) {
          localStorage.setItem('cureq_branch_id', firstBranch.id);
        }
        router.push('/dashboard/reception');
      } else if (user.role === 'DOCTOR' && user.doctorProfile) {
        const firstSchedule = user.doctorProfile.schedules?.[0];
        if (firstSchedule?.branch) {
          localStorage.setItem('cureq_branch_id', firstSchedule.branch.id);
          // Find the clinic ID via the branch's clinic
          if (firstSchedule.branch.clinicId) {
            localStorage.setItem('cureq_clinic_id', firstSchedule.branch.clinicId);
          }
        }
        localStorage.setItem('cureq_active_doctor_id', user.doctorProfile.id);
        router.push('/dashboard/doctor');
      } else {
        router.push('/dashboard/reception');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1a202c]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2 group">
          <Activity className="mx-auto h-10 w-10 text-[#01696f]" />
        </Link>
        <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#1a202c]">Sign in to CureQ</h2>
        <p className="mt-2 text-sm text-[#64748b] font-light">
          Access your clinic dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-[#e9e9e7] shadow-sm rounded-[6px] sm:px-10">

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Email Address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="admin@clinic.com"
                className="block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-[#475569]">Password</label>
                <Link href="/forgot-password" className="text-xs text-[#01696f] hover:underline font-medium">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="block w-full px-3 py-2 pr-10 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1a202c]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-[#01696f] text-white text-sm font-semibold rounded-[4px] hover:bg-[#005459] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? 'Signing in...' : (
                <>Sign In <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-[#e9e9e7] pt-6">
            <p className="text-xs text-[#64748b]">
              New clinic?{' '}
              <Link href="/onboarding" className="text-[#01696f] font-semibold hover:underline">
                Set up your clinic
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
