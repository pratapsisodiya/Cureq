'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Activity, User, Phone, Stethoscope, CheckCircle2, AlertCircle, Loader2, QrCode } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface DoctorInfo {
  id: string;
  name: string;
  speciality: string;
  queueCount: number;
}

interface BranchInfo {
  name: string;
  clinicName: string;
  address: string;
  doctors: DoctorInfo[];
}

export default function SelfCheckIn() {
  const params = useParams();
  const branchId = params.branchId as string;

  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ tokenNo: string; estimatedWait: number; doctorName: string; seatStatus: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [complaint, setComplaint] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [visitType, setVisitType] = useState('NEW');

  useEffect(() => {
    if (!branchId) return;
    fetch(`${BACKEND_URL}/api/queues/${branchId}/public`)
      .then(r => r.ok ? r.json() : Promise.reject('Branch not found'))
      .then((data: BranchInfo) => {
        setBranchInfo(data);
        if (data.doctors?.length > 0) setSelectedDoctorId(data.doctors[0].id);
      })
      .catch(() => setError('Clinic not found or self check-in is currently unavailable.'))
      .finally(() => setIsLoading(false));
  }, [branchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !selectedDoctorId) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/queues/${branchId}/self-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName: name.trim(), patientPhone: phone.trim(), chiefComplaint: complaint.trim() || undefined, doctorId: selectedDoctorId, visitType }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Check-in failed.');
      }

      const data = await res.json();
      const doc = branchInfo?.doctors.find(d => d.id === selectedDoctorId);
      setSuccess({ tokenNo: data.token.tokenNo, estimatedWait: data.token.estimatedWait, doctorName: doc?.name || 'Your Doctor', seatStatus: data.seatStatus });
    } catch (err: any) {
      setError(err.message || 'Check-in failed. Please ask the receptionist for help.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#01696f] animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center border border-[#e9e9e7]">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-[#e6f3f4] rounded-full p-4">
              <CheckCircle2 className="h-10 w-10 text-[#01696f]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#1a202c] mb-1">You're Checked In!</h2>
          <p className="text-[#64748b] text-sm mb-6">Please take a seat. You will be called by name when it's your turn.</p>

          <div className="bg-[#01696f] text-white rounded-xl px-8 py-5 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-80">Your Token Number</p>
            <p className="text-5xl font-bold tracking-wider">{success.tokenNo}</p>
          </div>

          {success.seatStatus === 'WAITING_OUTSIDE' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
              The waiting room is currently full. Please wait near the entrance — you will be called when a seat opens.
            </div>
          )}

          <div className="text-sm text-[#64748b] space-y-1.5 mb-6">
            <p><strong className="text-[#1a202c]">Doctor:</strong> {success.doctorName}</p>
            <p><strong className="text-[#1a202c]">Est. Wait:</strong> ~{success.estimatedWait} minutes</p>
            <p><strong className="text-[#1a202c]">Clinic:</strong> {branchInfo?.clinicName}</p>
          </div>

          <button
            onClick={() => { setSuccess(null); setName(''); setPhone(''); setComplaint(''); setVisitType('NEW'); }}
            className="text-xs text-[#64748b] hover:text-[#01696f] underline transition-colors"
          >
            Register another patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-[#e9e9e7]">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#e9e9e7]">
          <div className="bg-[#e6f3f4] rounded-xl p-2.5">
            <Activity className="h-5 w-5 text-[#01696f]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#1a202c]">{branchInfo?.clinicName || 'CureQ Clinic'}</h1>
            <p className="text-xs text-[#64748b]">{branchInfo?.name} · Self Check-In</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your full name" required
                className="w-full pl-9 pr-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Phone Number *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" required
                className="w-full pl-9 pr-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] bg-white" />
            </div>
          </div>

          {branchInfo && branchInfo.doctors.length > 1 && (
            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Select Doctor *</label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
                <select value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} required
                  className="w-full pl-9 pr-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] bg-white appearance-none">
                  {branchInfo.doctors.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} — {doc.speciality} ({doc.queueCount} ahead)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Visit Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ val: 'NEW', label: 'New Visit' }, { val: 'FOLLOW_UP', label: 'Follow-Up' }].map(({ val, label }) => (
                <button key={val} type="button" onClick={() => setVisitType(val)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-colors ${visitType === val ? 'bg-[#01696f] text-white border-[#01696f]' : 'bg-white text-[#64748b] border-[#e9e9e7] hover:border-[#01696f]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5">Chief Complaint (optional)</label>
            <textarea value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Briefly describe your symptoms or reason for visit..." rows={3}
              className="w-full px-4 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] resize-none bg-white" />
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#01696f] text-white rounded-lg font-semibold text-sm hover:bg-[#015a5f] disabled:opacity-60 transition-colors">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isSubmitting ? 'Checking In…' : 'Join Queue Now'}
          </button>
        </form>

        <p className="mt-5 text-[10px] text-center text-[#9ca3af]">
          Powered by CureQ · Your information is kept private and secure
        </p>
      </div>
    </div>
  );
}
