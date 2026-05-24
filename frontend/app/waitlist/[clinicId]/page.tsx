'use client';

import React, { use, useState, useEffect } from 'react';
import { apiRequest } from '../../../src/utils/api';
import { Activity, User, CheckCircle2, Clock, Calendar } from 'lucide-react';
import VoiceDictation from '../../../src/components/VoiceDictation';

interface WaitlistParams { clinicId: string }

export default function WaitlistPage({ params }: { params: Promise<WaitlistParams> }) {
  const { clinicId } = use(params);
  const [clinicData, setClinicData] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const minDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

  useEffect(() => {
    apiRequest(`/clinics/${clinicId}`).then(res => {
      setClinicData(res.clinic);
      const b = res.clinic.branches?.[0];
      if (b) { setBranch(b); const docs: any[] = []; const seen = new Set(); b.schedules.forEach((s: any) => { if (!seen.has(s.doctor.id)) { seen.add(s.doctor.id); docs.push(s.doctor); } }); if (docs.length > 0) setSelectedDoctorId((docs[0] as any).id); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [clinicId]);

  const uniqueDoctors: any[] = [];
  if (branch) { const seen = new Set(); branch.schedules.forEach((s: any) => { if (!seen.has(s.doctor.id)) { seen.add(s.doctor.id); uniqueDoctors.push(s.doctor); } }); }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(patientPhone)) { setError('Enter a valid 10-digit phone.'); return; }
    setIsSubmitting(true); setError('');
    try {
      const pRes = await apiRequest('/auth/patient-login', { method: 'POST', body: JSON.stringify({ phone: patientPhone, name: patientName }) });
      await apiRequest(`/features/clinics/${clinicId}/waitlist`, {
        method: 'POST',
        body: JSON.stringify({ patientName, patientPhone, patientId: pRes.user.id, doctorId: selectedDoctorId, branchId: branch.id, targetDate, chiefComplaint }),
      });
      setSuccess(true);
    } catch (err: any) { setError(err.message || 'Failed to join waitlist.'); }
    finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center text-sm text-[#64748b]">Loading...</div>;
  if (!clinicData) return <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center"><p className="text-red-500">Clinic not found.</p></div>;

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] font-sans">
      <header className="bg-white border-b border-[#e9e9e7] sticky top-0 z-10 shadow-xs">
        <div className="max-w-lg mx-auto px-6 h-16 flex items-center gap-3">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight text-[#01696f]">{clinicData.name}</h1>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Pre-Register for Tomorrow</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {success ? (
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-10 text-center shadow-lg space-y-4">
            <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="font-serif text-2xl font-bold">You're on the Waitlist!</h2>
            <p className="text-[#64748b] text-sm">The receptionist will add you to the live queue when the clinic opens on <strong>{targetDate}</strong>. Show up early.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden space-y-0">
            <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
              <h3 className="font-bold text-[#1a202c]">Pre-Register for a Future Date</h3>
              <p className="text-xs text-[#64748b] mt-0.5">Secure your spot before the clinic opens. Reception will add you to the queue when you arrive.</p>
            </div>
            <div className="p-6 space-y-5">
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded">{error}</p>}

              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Select Doctor *</label>
                <div className="space-y-2">
                  {uniqueDoctors.map((doc: any) => (
                    <div key={doc.id} onClick={() => setSelectedDoctorId(doc.id)}
                      className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 transition-all ${selectedDoctorId === doc.id ? 'border-[#01696f] bg-[#e6f3f4]' : 'border-[#e9e9e7] hover:border-[#01696f]/40'}`}>
                      <div className="h-8 w-8 bg-[#e6f3f4] rounded-full flex items-center justify-center shrink-0"><User className="h-4 w-4 text-[#01696f]" /></div>
                      <div><p className="text-sm font-bold">Dr. {doc.user.name}</p><p className="text-[10px] text-[#64748b]">{doc.speciality}</p></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Your Name *</label>
                  <input required type="text" placeholder="Full name"
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f]"
                    value={patientName} onChange={e => setPatientName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Mobile *</label>
                  <input required type="tel" maxLength={10} placeholder="10-digit"
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f]"
                    value={patientPhone} onChange={e => setPatientPhone(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Preferred Date *</label>
                <input required type="date" min={minDate}
                  className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f]"
                  value={targetDate} onChange={e => setTargetDate(e.target.value)} />
              </div>

              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider">Chief Complaint</label>
                  <VoiceDictation onResult={t => setChiefComplaint(prev => prev ? prev + ' ' + t : t)} />
                </div>
                <textarea placeholder="Brief description of symptoms..." rows={2}
                  className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] resize-none"
                  value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa]">
              <button type="submit" disabled={isSubmitting}
                className="w-full py-3 bg-[#01696f] text-white text-sm font-bold rounded-md hover:bg-[#005459] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                <Clock className="h-4 w-4" /> {isSubmitting ? 'Registering...' : 'Join Waitlist'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
