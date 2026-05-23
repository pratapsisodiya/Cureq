'use client';

import { SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { ShieldCheck, Activity, Users, Tv, Smartphone, Cpu, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const { isSignedIn } = useAuth();

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] selection:bg-[#01696f]/20 selection:text-[#01696f]">
      {/* Header */}
      <header className="border-b border-[#e9e9e7] bg-[#fbfbfa]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#01696f]" />
            <span className="font-serif text-2xl font-bold tracking-tight text-[#01696f]">CureQ</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/onboarding" className="text-sm font-medium text-[#64748b] hover:text-[#01696f] transition-colors">
              Onboard Clinic
            </Link>
            <Link href="/dashboard/reception" className="text-sm font-medium text-[#64748b] hover:text-[#01696f] transition-colors">
              Reception Desk
            </Link>
            <Link href="/dashboard/doctor" className="text-sm font-medium text-white bg-[#01696f] px-3.5 py-1.5 rounded-[4px] hover:bg-[#005459] transition-all">
              Doctor Console
            </Link>
            {!isSignedIn ? (
              <SignInButton mode="modal">
                <button className="text-sm font-medium text-[#64748b] hover:text-[#01696f] cursor-pointer bg-transparent border-0 p-0 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            ) : (
              <UserButton />
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 max-w-5xl mx-auto px-4 text-center">
        <span className="text-[#01696f] text-xs font-semibold tracking-widest uppercase border border-[#01696f]/20 bg-[#01696f]/10 px-3 py-1 rounded-full">
          AI-Powered Clinic Operations
        </span>
        <h1 className="font-serif text-5xl md:text-7xl font-bold mt-6 tracking-tight leading-[1.1] max-w-3xl mx-auto text-[#1a202c]">
          The smart token engine built for modern clinics.
        </h1>
        <p className="text-lg md:text-xl text-[#64748b] mt-6 max-w-2xl mx-auto font-light leading-relaxed">
          CureQ replaces crowded waiting rooms with virtual queues, real-time smart TV displays, and automated WhatsApp alert triggers. Gated by OpenAI wait-time predictions.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link href="/onboarding" className="px-6 py-3 bg-[#01696f] text-white font-medium rounded-[4px] hover:bg-[#005459] transition-all flex items-center gap-2 shadow-sm">
            Launch Your Clinic <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/reception" className="px-6 py-3 border border-[#e9e9e7] bg-white hover:bg-[#f4f4f3] text-[#1a202c] text-sm font-medium rounded-[4px] transition-all shadow-xs">
            Open Reception Sandbox
          </Link>
        </div>
      </section>

      {/* Differentiators Grid */}
      <section className="py-16 border-t border-[#e9e9e7] bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="font-serif text-3xl font-bold text-center tracking-tight text-[#1a202c]">
            How CureQ Beats Traditional Queue Managers
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 border border-[#e9e9e7] rounded-[6px] bg-[#fbfbfa]">
              <div className="h-10 w-10 bg-[#01696f]/10 rounded-[4px] flex items-center justify-center text-[#01696f]">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="font-medium text-lg mt-4 text-[#1a202c]">AI Wait Time Predictor</h3>
              <p className="text-sm text-[#64748b] mt-2 font-light">
                No more static token numbers. CureQ tracks rolling doctor consultation speeds to give patients accurate ETAs down to the minute.
              </p>
            </div>

            <div className="p-6 border border-[#e9e9e7] rounded-[6px] bg-[#fbfbfa]">
              <div className="h-10 w-10 bg-[#01696f]/10 rounded-[4px] flex items-center justify-center text-[#01696f]">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="font-medium text-lg mt-4 text-[#1a202c]">Virtual Queue Check-in</h3>
              <p className="text-sm text-[#64748b] mt-2 font-light">
                Patients scan a QR code at entrance or check-in from home. Updates live on their phone with "I'm on my way" scheduling.
              </p>
            </div>

            <div className="p-6 border border-[#e9e9e7] rounded-[6px] bg-[#fbfbfa]">
              <div className="h-10 w-10 bg-[#01696f]/10 rounded-[4px] flex items-center justify-center text-[#01696f]">
                <Tv className="h-5 w-5" />
              </div>
              <h3 className="font-medium text-lg mt-4 text-[#1a202c]">Waiting Room TV Mode</h3>
              <p className="text-sm text-[#64748b] mt-2 font-light">
                Dedicated widescreen waiting room layout. Auto-refreshes, displays current and upcoming tokens, and plays audio call chimes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Monetization Pricing Tiers */}
      <section className="py-20 max-w-6xl mx-auto px-4">
        <h2 className="font-serif text-4xl font-bold text-center tracking-tight text-[#1a202c]">SaaS Subscription Plans</h2>
        <p className="text-center text-[#64748b] mt-2 font-light">Select the plan tailored for your clinic size</p>

        <div className="grid md:grid-cols-4 gap-6 mt-12">
          {/* Plan 1 */}
          <div className="border border-[#e9e9e7] rounded-[6px] p-6 bg-white flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1a202c]">Free</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-[#1a202c]">₹0</span>
                <span className="ml-1 text-xs text-[#64748b]">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-[#64748b] font-light">
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 1 Doctor</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 1 Clinic Branch</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 50 Tokens / day</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Basic queue display</li>
              </ul>
            </div>
            <Link href="/onboarding" className="mt-8 block text-center w-full py-2 bg-[#f4f4f3] hover:bg-[#e9e9e7] text-[#1a202c] font-medium text-xs rounded-[4px] transition-all">
              Get Started
            </Link>
          </div>

          {/* Plan 2 */}
          <div className="border border-[#e9e9e7] rounded-[6px] p-6 bg-white flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1a202c]">Starter</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-[#1a202c]">₹499</span>
                <span className="ml-1 text-xs text-[#64748b]">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-[#64748b] font-light">
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 3 Doctors</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 1 Clinic Branch</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 200 Tokens / day</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> SMS Queue alerts</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Shareable Booking Page</li>
              </ul>
            </div>
            <Link href="/onboarding" className="mt-8 block text-center w-full py-2 bg-[#f4f4f3] hover:bg-[#e9e9e7] text-[#1a202c] font-medium text-xs rounded-[4px] transition-all">
              Go Starter
            </Link>
          </div>

          {/* Plan 3 */}
          <div className="border-2 border-[#01696f] rounded-[6px] p-6 bg-white relative flex flex-col justify-between shadow-sm">
            <span className="absolute -top-3 left-4 bg-[#01696f] text-white px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider">Popular</span>
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1a202c]">Pro</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-[#1a202c]">₹999</span>
                <span className="ml-1 text-xs text-[#64748b]">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-[#64748b] font-light">
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Unlimited Doctors</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> 1 Clinic Branch</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Unlimited Tokens</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> WhatsApp Business alerts</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> AI wait analytics</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> TV Display mode</li>
              </ul>
            </div>
            <Link href="/onboarding" className="mt-8 block text-center w-full py-2 bg-[#01696f] text-white hover:bg-[#005459] font-medium text-xs rounded-[4px] transition-all">
              Go Pro
            </Link>
          </div>

          {/* Plan 4 */}
          <div className="border border-[#e9e9e7] rounded-[6px] p-6 bg-white flex flex-col justify-between shadow-xs">
            <div>
              <h3 className="font-serif text-xl font-bold text-[#1a202c]">Chain</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-3xl font-extrabold tracking-tight text-[#1a202c]">₹2499</span>
                <span className="ml-1 text-xs text-[#64748b]">/month</span>
              </div>
              <ul className="mt-6 space-y-3 text-xs text-[#64748b] font-light">
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Unlimited Doctors</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Multi-Branch support</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Unlimited Tokens</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Consolidated Analytics</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#01696f]" /> Priority Support</li>
              </ul>
            </div>
            <Link href="/onboarding" className="mt-8 block text-center w-full py-2 bg-[#f4f4f3] hover:bg-[#e9e9e7] text-[#1a202c] font-medium text-xs rounded-[4px] transition-all">
              Go Chain
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e9e9e7] py-8 text-center text-xs text-[#64748b]">
        <p>© 2026 CureQ Inc. Built with Next.js 16 + Tailwind CSS v4.</p>
      </footer>
    </div>
  );
}