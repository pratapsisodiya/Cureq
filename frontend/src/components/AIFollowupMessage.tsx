'use client';

import React, { useState } from 'react';
import { MessageSquare, Loader2, ClipboardCopy, Check, X, ChevronRight, Send } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface AIFollowupMessageProps {
  consultNotes: string;
  patientName: string;
  doctorName: string;
  clinicName?: string;
  followUpDate?: string;
}

interface MessageResult {
  message: string;
  keyPoints: string[];
}

export default function AIFollowupMessage({
  consultNotes,
  patientName,
  doctorName,
  clinicName = 'CureQ Clinic',
  followUpDate,
}: AIFollowupMessageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MessageResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!consultNotes || consultNotes.trim().length < 5) {
      setError('Save consultation notes first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const data = await apiRequest('/ai/followup-message', {
        method: 'POST',
        body: JSON.stringify({ patientName, doctorName, clinicName, consultNotes, followUpDate }),
      });
      setResult(data);
      setIsOpen(true);
    } catch {
      setError('Message generation failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          title="Generate a patient-friendly follow-up message"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
          {isLoading ? 'Generating…' : 'Follow-up Msg'}
        </button>
        {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
      </div>

      {result && isOpen && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-sky-100 bg-sky-50/80">
            <div className="flex items-center gap-2">
              <Send className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">Patient Message</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="text-sky-400 hover:text-sky-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Key Points */}
          {result.keyPoints.length > 0 && (
            <div className="px-4 pt-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-sky-600 mb-1.5">Key Care Instructions</p>
              <ul className="space-y-1">
                {result.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                    <ChevronRight className="h-3 w-3 text-sky-400 flex-shrink-0 mt-0.5" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Message text */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-sky-600 mb-1.5">WhatsApp / SMS Message</p>
            <div className="bg-white border border-sky-100 rounded-lg p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {result.message}
            </div>
          </div>

          <div className="px-4 pb-4 flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[11px] font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors shadow-sm"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
