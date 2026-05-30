'use client';

import React, { useState } from 'react';
import { Sparkles, X, ChevronDown, ChevronUp, Loader2, FileText, ClipboardCopy, Check } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  followUpDays?: number | null;
}

interface AISoapNotesProps {
  rawNotes: string;
  onApply: (structured: string) => void;
  className?: string;
}

export default function AISoapNotes({ rawNotes, onApply, className = '' }: AISoapNotesProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleStructure = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!rawNotes || rawNotes.trim().length < 5) {
      setError('Add notes first (at least 5 characters)');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest('/ai/structure-notes', {
        method: 'POST',
        body: JSON.stringify({ rawNotes }),
      });
      setSoapNote(result);
      setIsExpanded(true);
    } catch {
      setError('AI structuring failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const buildFormattedText = (note: SoapNote) =>
    `[S] ${note.subjective}\n[O] ${note.objective}\n[A] ${note.assessment}\n[P] ${note.plan}${note.followUpDays ? `\nFollow-up in ${note.followUpDays} days` : ''}`;

  const handleApply = () => {
    if (!soapNote) return;
    onApply(buildFormattedText(soapNote));
    setSoapNote(null);
    setIsExpanded(false);
  };

  const handleCopy = async () => {
    if (!soapNote) return;
    await navigator.clipboard.writeText(buildFormattedText(soapNote));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleStructure}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          title="Convert notes to SOAP format using AI"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isLoading ? 'Structuring...' : 'AI Structure'}
        </button>
        {error && <span className="text-[10px] text-red-500 font-medium">{error}</span>}
      </div>

      {soapNote && isExpanded && (
        <div className="mt-3 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-purple-100 bg-purple-50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">AI SOAP Note</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded-md hover:bg-purple-100 text-purple-600 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-md hover:bg-purple-100 text-purple-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {[
              { key: 'subjective', label: 'S — Subjective', color: 'blue' },
              { key: 'objective', label: 'O — Objective', color: 'teal' },
              { key: 'assessment', label: 'A — Assessment', color: 'amber' },
              { key: 'plan', label: 'P — Plan', color: 'green' },
            ].map(({ key, label, color }) => (
              <div key={key}>
                <p className={`text-[9px] font-bold uppercase tracking-wider text-${color}-600 mb-0.5`}>{label}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{(soapNote as any)[key]}</p>
              </div>
            ))}
            {soapNote.followUpDays && (
              <div className="pt-2 border-t border-purple-100">
                <p className="text-[10px] font-semibold text-purple-700">Follow-up recommended in {soapNote.followUpDays} days</p>
              </div>
            )}
          </div>

          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={handleApply}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <FileText className="h-3.5 w-3.5" />
              Apply to Notes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
