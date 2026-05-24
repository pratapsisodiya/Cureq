'use client';

import React, { useState } from 'react';
import { BACKEND_URL } from '../../src/utils/api';
import { Mail, ArrowLeft, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

type Step = 'email' | 'reset' | 'done';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: verify email exists
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email not found.');
      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed.');
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[#e6f3f4] rounded-2xl mb-4">
            <span className="text-[#01696f] font-serif font-bold text-xl">C</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#1a202c]">Reset Password</h1>
          <p className="text-sm text-[#64748b] mt-1">CureQ Clinic Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#e9e9e7] p-8">

          {/* STEP: email */}
          {step === 'email' && (
            <>
              <div className="mb-6">
                <h2 className="font-bold text-[#1a202c] text-lg">Find your account</h2>
                <p className="text-sm text-[#64748b] mt-1">Enter the email address linked to your CureQ account.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
                    <input
                      type="email"
                      required
                      placeholder="you@clinic.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#01696f]/20 focus:border-[#01696f]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#01696f] text-white font-bold rounded-lg hover:bg-[#005459] disabled:opacity-60 transition-colors text-sm"
                >
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </form>
            </>
          )}

          {/* STEP: reset */}
          {step === 'reset' && (
            <>
              <div className="mb-6">
                <h2 className="font-bold text-[#1a202c] text-lg">Set new password</h2>
                <p className="text-sm text-[#64748b] mt-1">Choose a strong password for <strong>{email}</strong>.</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#01696f]/20 focus:border-[#01696f]"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1a202c]">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1.5">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#01696f]/20 focus:border-[#01696f]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setStep('email'); setError(''); }} className="flex-1 py-2.5 border border-[#e9e9e7] text-[#64748b] font-semibold rounded-lg hover:bg-[#f4f4f3] text-sm flex items-center justify-center gap-1.5">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-[#01696f] text-white font-bold rounded-lg hover:bg-[#005459] disabled:opacity-60 transition-colors text-sm">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* STEP: done */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-emerald-500" />
                </div>
              </div>
              <h2 className="font-bold text-[#1a202c] text-lg mb-2">Password Reset!</h2>
              <p className="text-sm text-[#64748b] mb-6">Your password has been updated. You can now log in with your new password.</p>
              <a href="/login" className="block w-full py-2.5 bg-[#01696f] text-white font-bold rounded-lg hover:bg-[#005459] transition-colors text-sm text-center">
                Go to Login
              </a>
            </div>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-[#64748b]">
          Remember your password?{' '}
          <a href="/login" className="font-bold text-[#01696f] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
