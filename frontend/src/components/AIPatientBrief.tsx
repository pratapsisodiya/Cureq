'use client';

import React, { useEffect, useState } from 'react';
import { Brain, AlertTriangle, Pill, Stethoscope, ChevronDown, ChevronUp, Loader2, History } from 'lucide-react';
import axios from 'axios';
import { apiRequest } from '../utils/api';

interface PatientBrief {
  summary: string;
  conditions: string[];
  lastDiagnosis: string;
  medications: string[];
  alerts: string[];
  visitCount: number;
}

interface AIPatientBriefProps {
  patientPhone: string;
  clinicId: string;
  patientName: string;
}

export default function AIPatientBrief({ patientPhone, clinicId, patientName }: AIPatientBriefProps) {
  const [brief, setBrief] = useState<PatientBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!patientPhone || !clinicId) return;
    setBrief(null);
    setLoading(true);
    setCollapsed(false);

    const controller = new AbortController();

    apiRequest('/ai/patient-context', {
      method: 'POST',
      body: JSON.stringify({ patientPhone, clinicId }),
      signal: controller.signal,
    })
      .then(data => setBrief(data))
      .catch((err: any) => { if (!axios.isCancel(err)) setBrief(null); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [patientPhone, clinicId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-600 animate-pulse">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>AI loading patient history…</span>
      </div>
    );
  }

  if (!brief) return null;

  const isNewPatient = brief.visitCount === 0;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      brief.alerts.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-indigo-100 bg-indigo-50/40'
    }`}>
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Brain className={`h-3.5 w-3.5 ${brief.alerts.length > 0 ? 'text-amber-600' : 'text-indigo-600'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${brief.alerts.length > 0 ? 'text-amber-800' : 'text-indigo-800'}`}>
            AI Patient Brief
          </span>
          {!isNewPatient && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 ml-1">
              <History className="h-3 w-3" /> {brief.visitCount} prior visit{brief.visitCount !== 1 ? 's' : ''}
            </span>
          )}
          {brief.alerts.length > 0 && (
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse ml-1" />
          )}
        </div>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronUp className="h-3.5 w-3.5 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/60">
          {/* Summary */}
          <p className="text-xs text-gray-700 leading-relaxed pt-3">{brief.summary}</p>

          {/* Alerts */}
          {brief.alerts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {brief.alerts.map((a, i) => (
                <span key={i} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" /> {a}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Last Diagnosis */}
            {!isNewPatient && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1 flex items-center gap-1">
                  <Stethoscope className="h-2.5 w-2.5" /> Last Diagnosis
                </p>
                <p className="text-[11px] text-gray-700 leading-snug">{brief.lastDiagnosis}</p>
              </div>
            )}

            {/* Conditions */}
            {brief.conditions.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1">Known Conditions</p>
                <div className="flex flex-wrap gap-1">
                  {brief.conditions.map((c, i) => (
                    <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 bg-white border border-indigo-200 text-indigo-700 rounded">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Medications */}
          {brief.medications.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-1 flex items-center gap-1">
                <Pill className="h-2.5 w-2.5" /> Prior Medications
              </p>
              <div className="flex flex-wrap gap-1">
                {brief.medications.map((m, i) => (
                  <span key={i} className="text-[9px] px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded font-medium">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
