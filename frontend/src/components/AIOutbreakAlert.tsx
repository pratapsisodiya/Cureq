'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, TrendingUp, Loader2, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface Pattern {
  symptom: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
}

interface OutbreakData {
  hasAlert: boolean;
  patterns: Pattern[];
  alertMessage?: string;
  recommendation?: string;
}

interface AIOutbreakAlertProps {
  clinicId: string;
}

const SEVERITY_STYLES: Record<string, { bar: string; badge: string }> = {
  high: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-800 border-red-200' },
  medium: { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
  low: { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export default function AIOutbreakAlert({ clinicId }: AIOutbreakAlertProps) {
  const [data, setData] = useState<OutbreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchPatterns = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/ai/complaint-patterns/${clinicId}`);
      setData(res);
      if (res.hasAlert) setDismissed(false);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, [clinicId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Scanning today's symptoms…
      </div>
    );
  }

  if (!data || data.patterns.length === 0) {
    return (
      <div className="flex items-center justify-between text-[11px] text-gray-400 py-2 px-1">
        <span>No significant symptom clusters today</span>
        <button onClick={fetchPatterns} className="text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const maxCount = Math.max(...data.patterns.map(p => p.count));

  if (dismissed && !data.hasAlert) return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${data.hasAlert && !dismissed ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          {data.hasAlert ? (
            <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0" />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          )}
          <div>
            <p className={`text-xs font-bold ${data.hasAlert ? 'text-red-800' : 'text-gray-800'}`}>
              {data.hasAlert ? 'Symptom Cluster Alert' : 'Symptom Patterns Today'}
            </p>
            {data.alertMessage && !expanded && (
              <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-1">{data.alertMessage}</p>
            )}
          </div>
          {data.hasAlert && (
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse ml-1 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fetchPatterns(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {data.hasAlert && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {data.alertMessage && (
            <div className={`px-3 py-2 rounded-lg text-xs font-medium ${data.hasAlert ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
              {data.alertMessage}
            </div>
          )}

          {/* Pattern bars */}
          <div className="space-y-2">
            {data.patterns.map((p, i) => {
              const style = SEVERITY_STYLES[p.severity];
              const widthPct = Math.round((p.count / maxCount) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-gray-700">{p.symptom}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-600">{p.count} patients</span>
                      <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>{p.severity}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {data.recommendation && (
            <div className="mt-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-[11px] text-amber-800 font-medium">
              <span className="font-bold">Recommendation: </span>{data.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
