'use client';

import React, { useState } from 'react';
import { X, Send, Pill, TestTube, CheckCircle2, AlertTriangle, Loader2, QrCode, Share2, Sparkles } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface PrescriptionSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescriptionData: any; // Result from AIPrescription
  patientName: string;
  patientPhone: string;
  patientAge?: number;
  patientGender?: string;
  patientId?: string;
  doctorId: string;
  doctorName: string;
  branchId: string;
  clinicName?: string;
  tokenId: string;
  onSaved?: (savedPrescription: any) => void;
}

export default function PrescriptionSaveModal({
  isOpen,
  onClose,
  prescriptionData,
  patientName,
  patientPhone,
  patientAge,
  patientGender,
  patientId,
  doctorId,
  doctorName,
  branchId,
  clinicName,
  tokenId,
  onSaved,
}: PrescriptionSaveModalProps) {
  const [saving, setSaving] = useState(false);
  const [sharingWA, setSharingWA] = useState(false);
  const [sendingPharmacy, setSendingPharmacy] = useState(false);
  const [sendingLab, setSendingLab] = useState(false);

  const [savedPrescription, setSavedPrescription] = useState<any>(null);
  const [waSent, setWaSent] = useState(false);
  const [pharmacySent, setPharmacySent] = useState(false);
  const [labSent, setLabSent] = useState(false);

  // Lab test selection state
  const [showLabForm, setShowLabForm] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>(['Complete Blood Count (CBC)']);
  const [customTest, setCustomTest] = useState('');
  const [labUrgency, setLabUrgency] = useState<'NORMAL' | 'URGENT'>('NORMAL');

  const COMMON_LAB_TESTS = [
    'Complete Blood Count (CBC)',
    'Fasting Blood Sugar (FBS)',
    'HbA1c',
    'Lipid Profile',
    'Liver Function Test (LFT)',
    'Kidney Function Test (KFT)',
    'Thyroid Profile (T3, T4, TSH)',
    'Urine Routine & Microscopy',
    'Chest X-Ray',
  ];

  if (!isOpen || !prescriptionData) return null;

  // 1. Initial save of the prescription record
  const ensurePrescriptionSaved = async () => {
    if (savedPrescription) return savedPrescription;

    setSaving(true);
    try {
      const res = await apiRequest('/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          tokenId,
          patientId: patientId || null,
          patientName,
          patientPhone,
          patientAge,
          patientGender,
          doctorId,
          doctorName,
          branchId,
          clinicName: clinicName || 'CureQ Clinic',
          medications: prescriptionData.medications || [],
          interactions: prescriptionData.interactions || [],
          generalAdvice: prescriptionData.generalAdvice || '',
          reviewRequired: prescriptionData.reviewRequired || false,
        }),
      });

      setSavedPrescription(res.prescription);
      if (onSaved) onSaved(res.prescription);
      return res.prescription;
    } catch (err) {
      console.error('Failed to save prescription:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // 2. Share via WhatsApp
  const handleShareWhatsApp = async () => {
    setSharingWA(true);
    try {
      const rx = await ensurePrescriptionSaved();
      await apiRequest(`/prescriptions/${rx.id}/share-whatsapp`, { method: 'POST' });
      setWaSent(true);
    } catch (err: any) {
      alert(err.message || 'Failed to share prescription via WhatsApp.');
    } finally {
      setSharingWA(false);
    }
  };

  // 3. Send to Pharmacy Counter
  const handleSendToPharmacy = async () => {
    setSendingPharmacy(true);
    try {
      const rx = await ensurePrescriptionSaved();
      await apiRequest(`/prescriptions/${rx.id}/pharmacy-order`, { method: 'POST' });
      setPharmacySent(true);
    } catch (err: any) {
      alert(err.message || 'Failed to send to pharmacy.');
    } finally {
      setSendingPharmacy(false);
    }
  };

  // 4. Send to Lab Counter
  const handleSendToLab = async () => {
    if (selectedTests.length === 0) {
      alert('Please select at least one lab test.');
      return;
    }

    setSendingLab(true);
    try {
      const rx = await ensurePrescriptionSaved();
      const testsPayload = selectedTests.map((t) => ({ testName: t, urgency: labUrgency }));

      await apiRequest(`/prescriptions/${rx.id}/lab-order`, {
        method: 'POST',
        body: JSON.stringify({
          tests: testsPayload,
          priority: labUrgency,
        }),
      });

      setLabSent(true);
      setShowLabForm(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create lab order.');
    } finally {
      setSendingLab(false);
    }
  };

  const toggleTest = (test: string) => {
    setSelectedTests((prev) =>
      prev.includes(test) ? prev.filter((t) => t !== test) : [...prev, test]
    );
  };

  const addCustomTest = () => {
    if (customTest.trim() && !selectedTests.includes(customTest.trim())) {
      setSelectedTests((prev) => [...prev, customTest.trim()]);
      setCustomTest('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-700 to-teal-800 text-white">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-teal-300" />
            <div>
              <h3 className="font-bold text-base">E-Prescription & Care Workflow</h3>
              <p className="text-xs text-teal-100">Patient: {patientName} • Token: #{tokenId.slice(0, 6)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-teal-100 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Medications Summary Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Pill className="h-3.5 w-3.5 text-teal-600" />
              Prescribed Medications ({prescriptionData.medications?.length || 0})
            </h4>
            <div className="space-y-2">
              {prescriptionData.medications?.map((m: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{m.name}</span>
                    <span className="text-slate-500 ml-2">({m.dosage} • {m.frequency})</span>
                  </div>
                  <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-medium">{m.duration}</span>
                </div>
              ))}
            </div>

            {/* Drug Interaction Warning */}
            {prescriptionData.interactions?.length > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800">Drug Interaction Warnings Detected:</p>
                  {prescriptionData.interactions.map((warn: string, i: number) => (
                    <p key={i} className="text-amber-700 mt-0.5">• {warn}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Hub */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Action 1: WhatsApp Share */}
            <button
              onClick={handleShareWhatsApp}
              disabled={sharingWA || waSent}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                waSent
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-50/50 hover:bg-emerald-100/60 border-emerald-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-emerald-600 text-white">
                  <Share2 className="h-4 w-4" />
                </div>
                {waSent && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">
                  {waSent ? 'Sent to WhatsApp!' : 'WhatsApp Share'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Send E-Rx + Live Link</p>
              </div>
            </button>

            {/* Action 2: Send to Pharmacy */}
            <button
              onClick={handleSendToPharmacy}
              disabled={sendingPharmacy || pharmacySent}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                pharmacySent
                  ? 'bg-teal-50 border-teal-300 text-teal-800'
                  : 'bg-teal-50/50 hover:bg-teal-100/60 border-teal-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-teal-600 text-white">
                  <Pill className="h-4 w-4" />
                </div>
                {pharmacySent && <CheckCircle2 className="h-5 w-5 text-teal-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">
                  {pharmacySent ? 'Pushed to Pharmacy!' : 'Pharmacy Counter'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Auto-fill prescription</p>
              </div>
            </button>

            {/* Action 3: Send to Lab */}
            <button
              onClick={() => setShowLabForm((v) => !v)}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                labSent
                  ? 'bg-purple-50 border-purple-300 text-purple-800'
                  : 'bg-purple-50/50 hover:bg-purple-100/60 border-purple-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2 rounded-lg bg-purple-600 text-white">
                  <TestTube className="h-4 w-4" />
                </div>
                {labSent && <CheckCircle2 className="h-5 w-5 text-purple-600" />}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">
                  {labSent ? 'Lab Order Created!' : 'Lab Test Push'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Select & order lab tests</p>
              </div>
            </button>
          </div>

          {/* Expandable Lab Test Form */}
          {showLabForm && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900">Select Required Diagnostic Tests</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLabUrgency('NORMAL')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      labUrgency === 'NORMAL' ? 'bg-purple-700 text-white' : 'bg-white text-purple-700 border'
                    }`}
                  >
                    Routine
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabUrgency('URGENT')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      labUrgency === 'URGENT' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border'
                    }`}
                  >
                    Stat / Urgent
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {COMMON_LAB_TESTS.map((test) => {
                  const selected = selectedTests.includes(test);
                  return (
                    <button
                      key={test}
                      type="button"
                      onClick={() => toggleTest(test)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors ${
                        selected ? 'bg-purple-600 text-white border-purple-600 font-semibold' : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-100/50'
                      }`}
                    >
                      <span className="truncate">{test}</span>
                      {selected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>

              {/* Custom Test Add */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Add custom lab test name..."
                  value={customTest}
                  onChange={(e) => setCustomTest(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomTest}
                  className="px-3 py-1.5 bg-purple-700 text-white font-bold rounded-lg hover:bg-purple-800"
                >
                  Add Test
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSendToLab}
                  disabled={sendingLab}
                  className="px-4 py-2 bg-purple-800 text-white font-bold rounded-lg hover:bg-purple-900 flex items-center gap-1.5"
                >
                  {sendingLab ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Confirm Lab Push ({selectedTests.length} tests)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Prescription QR Code will automatically append to patient portal link.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-700 text-white font-bold rounded-lg hover:bg-teal-800 transition-colors"
          >
            Done / Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
