'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => console.log('[CureQ SW] Registered', reg.scope))
        .catch((err) => console.warn('[CureQ SW] Registration failed', err));
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show banner only if not dismissed before
      const dismissed = localStorage.getItem('pwa_banner_dismissed');
      if (!dismissed) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Hide banner if already installed
    window.addEventListener('appinstalled', () => {
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setIsInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
    setIsInstalling(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white border border-[#e9e9e7] rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="p-2 bg-[#e6f3f4] rounded-xl flex-shrink-0">
          <Smartphone className="h-5 w-5 text-[#01696f]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1a202c]">Install CureQ App</p>
          <p className="text-[11px] text-[#64748b] mt-0.5 leading-snug">
            Add to your home screen for faster access and offline support.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01696f] text-white text-xs font-bold rounded-lg hover:bg-[#005459] transition-colors disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {isInstalling ? 'Installing…' : 'Install'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs font-semibold text-[#64748b] rounded-lg hover:bg-[#f4f4f3] border border-[#e9e9e7] transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-[#64748b] hover:text-[#1a202c] flex-shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
