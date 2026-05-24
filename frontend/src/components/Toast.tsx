'use client';

import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium animate-in slide-in-from-top-2 duration-300 max-w-sm ${
      type === 'success'
        ? 'bg-white border-emerald-200 text-emerald-800'
        : 'bg-white border-red-200 text-red-800'
    }`}>
      {type === 'success'
        ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
        : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
      }
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const hideToast = () => setToast(null);

  const ToastComponent = toast ? (
    <Toast message={toast.message} type={toast.type} onClose={hideToast} />
  ) : null;

  return { showToast, ToastComponent };
}
