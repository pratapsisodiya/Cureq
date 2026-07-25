'use client';

import React, { useState } from 'react';
import { Pill, AlertTriangle, Printer, ChevronDown, ChevronUp, Loader2, FileText, Send, Share2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import PrescriptionSaveModal from './PrescriptionSaveModal';

interface PrescriptionDrug {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
}

interface PrescriptionResult {
  medications: PrescriptionDrug[];
  interactions: string[];
  generalAdvice: string;
  reviewRequired: boolean;
}

interface AIPrescriptionProps {
  soapNotes: string;
  patientName: string;
  patientAge?: number;
  patientGender?: string;
  doctorName?: string;
  clinicName?: string;
  className?: string;
  tokenId?: string;
  patientPhone?: string;
  patientId?: string;
  doctorId?: string;
  branchId?: string;
}

export default function AIPrescription({
  soapNotes,
  patientName,
  patientAge,
  patientGender,
  doctorName,
  clinicName,
  className,
  tokenId,
  patientPhone,
  patientId,
  doctorId,
  branchId,
}: AIPrescriptionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [prescription, setPrescription] = useState<PrescriptionResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const handleGenerate = async () => {
    if (!soapNotes || soapNotes.trim().length < 5) {
      setError('Add consultation notes first before generating a prescription.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest('/ai/generate-prescription', {
        method: 'POST',
        body: JSON.stringify({
          soapNotes: soapNotes.trim(),
          patientInfo: { name: patientName, age: patientAge, gender: patientGender },
        }),
      });
      setPrescription(result);
      setIsExpanded(true);
    } catch {
      setError('Prescription generation failed. Check notes and retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (!prescription) return;
    const w = window.open('', '_blank');
    if (!w) return;

    const rows = prescription.medications.map((d, i) => `
      <tr style="border-bottom:1px solid #f0f0f0;${i % 2 === 0 ? '' : 'background:#f9fafb'}">
        <td style="padding:10px 12px;font-weight:600;color:#1a202c">${i + 1}. ${d.name}</td>
        <td style="padding:10px 12px">${d.dosage}</td>
        <td style="padding:10px 12px">${d.frequency}</td>
        <td style="padding:10px 12px">${d.duration}</td>
        <td style="padding:10px 12px;color:#64748b;font-size:12px">${d.instructions}</td>
      </tr>`).join('');

    const interactions = prescription.interactions.length > 0
      ? `<div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:14px;margin-top:18px">
          <strong style="color:#92400e;font-size:13px">⚠ Drug Interaction Warnings</strong>
          <ul style="margin:8px 0 0 18px;color:#92400e;font-size:13px">${prescription.interactions.map(i => `<li style="margin-bottom:4px">${i}</li>`).join('')}</ul>
        </div>` : '';

    w.document.write(`<!DOCTYPE html><html><head><title>Prescription — ${patientName}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:30px auto;color:#1a202c;font-size:14px}
        table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
        th{background:#01696f;color:white;padding:10px 12px;text-align:left;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
        .rx-symbol{font-size:3rem;font-weight:900;color:#01696f;line-height:1}
        @media print{button{display:none}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #01696f;padding-bottom:14px;margin-bottom:20px">
        <div><div class="rx-symbol">℞</div><h2 style="margin:4px 0 0;font-size:20px">${clinicName || 'CureQ Clinic'}</h2><p style="margin:2px 0;color:#64748b;font-size:13px">Medical Prescription</p></div>
        <div style="text-align:right;font-size:13px;color:#64748b"><p style="margin:0;font-weight:600;color:#1a202c">Dr. ${doctorName || 'Physician'}</p><p style="margin:4px 0 0">Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
      </div>
      <div style="background:#f0fafa;border-radius:8px;padding:12px 16px;margin-bottom:20px;display:flex;gap:24px;font-size:13px">
        <span><strong>Patient:</strong> ${patientName}</span>
        ${patientAge ? `<span><strong>Age:</strong> ${patientAge} yrs</span>` : ''}
        ${patientGender ? `<span><strong>Gender:</strong> ${patientGender}</span>` : ''}
      </div>
      <table>
        <thead><tr><th>Medication (Generic)</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${interactions}
      <div style="margin-top:18px;padding:14px 16px;background:#e6f3f4;border-radius:8px;font-size:13px">
        <strong>General Advice:</strong> ${prescription.generalAdvice}
      </div>
      ${prescription.reviewRequired ? '<p style="margin-top:14px;font-size:11px;color:#94a3b8;font-style:italic">* This AI-generated prescription requires physician verification before dispensing.</p>' : ''}
      <div style="margin-top:50px;display:flex;justify-content:flex-end">
        <div style="text-align:center"><div style="width:180px;border-top:1px solid #374151;padding-top:8px;font-size:12px;color:#374151">Authorized Signature</div></div>
      </div>
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className={`relative ${className || ''}`}>
      <button type="button" onClick={handleGenerate} disabled={isLoading}
        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors">
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pill className="h-3.5 w-3.5" />}
        {isLoading ? 'Generating…' : 'AI Prescription'}
      </button>

      {error && <p className="mt-1.5 text-[11px] text-red-600">{error}</p>}

      {prescription && (
        <div className="mt-2 border border-purple-200 rounded-lg overflow-hidden bg-white shadow-xs">
          <div className="flex items-center justify-between px-3 py-2 bg-purple-50 cursor-pointer" onClick={() => setIsExpanded(v => !v)}>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-[11px] font-bold text-purple-700">
                AI Rx — {prescription.medications.length} med(s)
                {prescription.reviewRequired && <span className="ml-1.5 text-[10px] font-normal text-amber-600">· Review Required</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {tokenId && branchId && doctorId && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setIsSaveModalOpen(true); }}
                  className="flex items-center gap-1 text-[10px] bg-purple-700 hover:bg-purple-800 text-white font-bold px-2 py-0.5 rounded shadow-xs transition-colors"
                >
                  <Share2 className="h-3 w-3" /> Save & Share
                </button>
              )}
              <button type="button" onClick={e => { e.stopPropagation(); handlePrint(); }}
                className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 font-semibold">
                <Printer className="h-3 w-3" /> Print
              </button>
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-purple-400" /> : <ChevronDown className="h-3.5 w-3.5 text-purple-400" />}
            </div>
          </div>

          {isExpanded && (
            <div className="p-3 space-y-2.5">
              <div className="overflow-x-auto rounded border border-purple-100">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-purple-700 text-white">
                      {['Medication', 'Dosage', 'Frequency', 'Duration', 'Route'].map(h => (
                        <th key={h} className="px-2.5 py-1.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {prescription.medications.map((d, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/30'}>
                        <td className="px-2.5 py-1.5 font-semibold text-purple-900">{d.name}</td>
                        <td className="px-2.5 py-1.5">{d.dosage}</td>
                        <td className="px-2.5 py-1.5">{d.frequency}</td>
                        <td className="px-2.5 py-1.5">{d.duration}</td>
                        <td className="px-2.5 py-1.5 text-[#64748b]">{d.route}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {prescription.interactions.length > 0 && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-amber-700 mb-0.5">Drug Interactions</p>
                    {prescription.interactions.map((w, i) => (
                      <p key={i} className="text-[10px] text-amber-700">• {w}</p>
                    ))}
                  </div>
                </div>
              )}

              {prescription.generalAdvice && (
                <p className="text-[10px] bg-[#e6f3f4] rounded p-2.5 text-[#01696f]">
                  <strong>Advice:</strong> {prescription.generalAdvice}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save & Share Modal */}
      {prescription && tokenId && branchId && doctorId && (
        <PrescriptionSaveModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          prescriptionData={prescription}
          patientName={patientName}
          patientPhone={patientPhone || ''}
          patientAge={patientAge}
          patientGender={patientGender}
          patientId={patientId}
          doctorId={doctorId}
          doctorName={doctorName || 'Doctor'}
          branchId={branchId}
          clinicName={clinicName}
          tokenId={tokenId}
        />
      )}
    </div>
  );
}
