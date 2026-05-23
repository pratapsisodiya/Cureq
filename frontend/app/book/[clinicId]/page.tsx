'use client';

import React, { use, useState, useEffect } from 'react';
import { apiRequest } from '../../../src/utils/api';
import { Activity, Clock, ShieldCheck, MapPin, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import VoiceDictation from '../../../src/components/VoiceDictation';

interface BookingParams {
  clinicId: string;
}

export default function PatientBookingPortal({ params }: { params: Promise<BookingParams> }) {
  const resolvedParams = use(params);
  const clinicId = resolvedParams.clinicId;

  const [clinicData, setClinicData] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success State
  const [generatedToken, setGeneratedToken] = useState<any>(null);

  useEffect(() => {
    async function fetchClinicDetails() {
      try {
        const res = await apiRequest(`/clinics/${clinicId}`);
        setClinicData(res.clinic);
        if (res.clinic.branches && res.clinic.branches.length > 0) {
          const mainBranch = res.clinic.branches[0];
          setBranch(mainBranch);
          if (mainBranch.schedules.length > 0) {
            setSelectedDoctorId(mainBranch.schedules[0].doctor.id);
          }
        }
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError('Clinic not found or offline.');
        setLoading(false);
      }
    }
    fetchClinicDetails();
  }, [clinicId]);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !patientName || !patientPhone) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // 1. Log in or create patient profile
      const pResponse = await apiRequest('/auth/patient-login', {
        method: 'POST',
        body: JSON.stringify({
          phone: patientPhone,
          name: patientName,
          age: patientAge,
          gender: patientGender,
        }),
      });

      // 2. Add to virtual queue
      const tokenRes = await apiRequest(`/queues/${branch.id}/token`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          patientPhone: patientPhone,
          patientName: patientName,
          type: 'GENERAL',
          visitType: 'NEW',
          chiefComplaint: chiefComplaint,
          patientId: pResponse.user.id,
        }),
      });

      setGeneratedToken(tokenRes.token);
    } catch (err: any) {
      setError(err.message || 'Failed to generate token. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="h-10 w-10 text-[#01696f] mb-4" />
          <p className="text-[#64748b] text-sm">Loading clinic profile...</p>
        </div>
      </div>
    );
  }

  if (error || !clinicData || !branch) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 p-8 rounded-xl max-w-md w-full text-center shadow-sm">
          <ShieldCheck className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1a202c]">Booking Unavailable</h2>
          <p className="text-[#64748b] mt-2 text-sm">{error || 'This clinic does not have an active online booking portal.'}</p>
        </div>
      </div>
    );
  }

  // Deduplicate doctors from schedules
  const uniqueDoctors: any[] = [];
  branch.schedules.forEach((sched: any) => {
    if (!uniqueDoctors.some(d => d.id === sched.doctor.id)) {
      uniqueDoctors.push(sched.doctor);
    }
  });

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] font-sans selection:bg-[#01696f]/20">
      
      {/* Header */}
      <header className="bg-white border-b border-[#e9e9e7] sticky top-0 z-10 shadow-xs">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-3">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <div>
            <h1 className="font-serif font-bold text-lg leading-tight text-[#01696f]">{clinicData.name}</h1>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Official Booking Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        
        {generatedToken ? (
          /* SUCCESS SCREEN */
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-8 md:p-12 text-center shadow-lg animate-in zoom-in-95 duration-500">
            <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="font-serif text-3xl font-bold text-[#1a202c]">Booking Confirmed!</h2>
            <p className="text-[#64748b] mt-3">You have been added to the live virtual queue.</p>
            
            <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-6 mt-8 max-w-sm mx-auto shadow-inner">
              <span className="text-xs font-bold uppercase tracking-widest text-[#64748b] block mb-2">Your Token No.</span>
              <span className="text-6xl font-mono font-bold text-[#01696f] block">{generatedToken.tokenNo}</span>
              <div className="mt-4 text-sm text-[#1a202c] font-medium">
                Dr. {uniqueDoctors.find(d => d.id === generatedToken.doctorId)?.user.name}
              </div>
            </div>

            <p className="text-sm text-[#64748b] mt-8 max-w-md mx-auto leading-relaxed">
              We've calculated your estimated wait time. Please track your live status and use the "On My Way" button when you leave your home.
            </p>

            <Link 
              href={`/queue/${generatedToken.id}`}
              className="mt-8 inline-flex items-center gap-2 px-8 py-3 bg-[#01696f] text-white font-bold rounded-md hover:bg-[#005459] transition-all shadow-md"
            >
              Open Live Tracker <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          /* BOOKING FORM */
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* Clinic Info Card */}
            <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-xs">
              <div className="h-16 w-16 bg-[#e6f3f4] text-[#01696f] rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#1a202c]">{branch.name}</h2>
                <p className="text-sm text-[#64748b] mt-1 leading-relaxed">
                  Join the queue remotely and avoid the crowded waiting room. We'll update you live on your phone.
                </p>
                <div className="flex gap-4 mt-4 text-xs font-semibold text-[#01696f]">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> AI Wait Times</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Verified Doctors</span>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleBookingSubmit} className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                <h3 className="font-bold text-[#1a202c]">Patient Details</h3>
              </div>
              
              <div className="p-6 space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded border border-red-200 font-medium">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-2">Select Doctor *</label>
                  <div className="grid md:grid-cols-2 gap-3">
                    {uniqueDoctors.map(doc => (
                      <div 
                        key={doc.id}
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center gap-3 ${
                          selectedDoctorId === doc.id 
                            ? 'border-[#01696f] bg-[#e6f3f4] shadow-sm' 
                            : 'border-[#e9e9e7] bg-white hover:border-[#01696f]/40 hover:bg-[#fbfbfa]'
                        }`}
                      >
                        <div className="h-10 w-10 bg-white border border-[#e9e9e7] rounded-full flex items-center justify-center shrink-0 shadow-xs">
                          <User className="h-5 w-5 text-[#64748b]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1a202c]">Dr. {doc.user.name}</p>
                          <p className="text-[10px] text-[#64748b] font-medium mt-0.5">{doc.speciality}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-[#e9e9e7]">
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Full Name *</label>
                    <input 
                      type="text" required placeholder="John Doe" 
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner transition-colors"
                      value={patientName} onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Mobile Phone *</label>
                    <input 
                      type="text" required placeholder="10-digit number" maxLength={10}
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner transition-colors"
                      value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Age</label>
                    <input 
                      type="number" placeholder="Years" 
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner transition-colors"
                      value={patientAge} onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Gender</label>
                    <select 
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-xs cursor-pointer"
                      value={patientGender} onChange={(e) => setPatientGender(e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#e9e9e7]">
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-xs font-bold text-[#64748b] uppercase tracking-wider">Chief Complaint (Optional)</label>
                    <VoiceDictation onResult={(text) => setChiefComplaint(prev => prev ? `${prev} ${text}` : text)} />
                  </div>
                  <textarea 
                    placeholder="Briefly describe your symptoms (e.g., Fever and dry cough for 2 days)..." rows={3}
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner transition-colors resize-none mt-1"
                    value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)}
                  />
                </div>

              </div>
              <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa]">
                <button 
                  type="submit" disabled={isSubmitting}
                  className="w-full py-3 bg-[#01696f] text-white text-sm font-bold rounded-md hover:bg-[#005459] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Booking & Get Token'}
                </button>
                <p className="text-[10px] text-center text-[#64748b] mt-3 font-medium">
                  By booking, you agree to receive WhatsApp/SMS updates regarding your token status.
                </p>
              </div>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
