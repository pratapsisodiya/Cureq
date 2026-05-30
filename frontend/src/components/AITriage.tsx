'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, ShieldAlert, Activity, X } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface TriageResult {
  urgency: 'GENERAL' | 'PRIORITY' | 'EMERGENCY';
  suggestedSpeciality: string;
  symptoms: string[];
  reasoning: string;
  confidence: number;
}

interface AITriageProps {
  chiefComplaint: string;
  onApply: (urgency: 'GENERAL' | 'PRIORITY' | 'EMERGENCY', speciality: string) => void;
}

const URGENCY_CONFIG = {
  GENERAL: {
    label: 'General',
    icon: Activity,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  PRIORITY: {
    label: 'Priority',
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
  EMERGENCY: {
    label: 'Emergency',
    icon: ShieldAlert,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-800',
  },
};

export default function AITriage({ chiefComplaint, onApply }: AITriageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState('');

  const handleTriage = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!chiefComplaint || chiefComplaint.trim().length < 3) {
      setError('Enter a chief complaint first');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setIsLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await apiRequest('/ai/triage', {
        method: 'POST',
        body: JSON.stringify({ chiefComplaint }),
      });
      setResult(data);
    } catch {
      setError('Triage unavailable');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.urgency, result.suggestedSpeciality);
    setResult(null);
  };

  const cfg = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTriage}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#01696f]/30 bg-[#e6f3f4] text-[#01696f] hover:bg-[#d0eaeb] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          title="AI-powered triage analysis"
        >
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {isLoading ? 'Analyzing...' : 'AI Triage'}
        </button>
        {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
      </div>

      {result && cfg && (
        <div className={`mt-2 rounded-xl border ${cfg.border} ${cfg.bg} p-3 animate-in fade-in slide-in-from-top-1 duration-200`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <cfg.icon className={`h-4 w-4 ${cfg.text} flex-shrink-0`} />
              <div>
                <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label} Priority</span>
                <span className="text-[10px] text-gray-500 ml-1.5">({result.confidence}% confidence)</span>
              </div>
            </div>
            <button type="button" onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[10px] text-gray-600 mb-2 leading-relaxed">{result.reasoning}</p>

          <div className="flex flex-wrap gap-1 mb-2">
            {result.symptoms.map((s, i) => (
              <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">{s}</span>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/60">
            <span className="text-[10px] text-gray-500">
              Suggested: <span className="font-semibold text-gray-700">{result.suggestedSpeciality}</span>
            </span>
            <button
              type="button"
              onClick={handleApply}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg ${cfg.badge} transition-colors hover:opacity-90`}
            >
              Apply Triage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
