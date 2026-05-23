'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { apiRequest } from '../../src/utils/api';
import { Activity, ShieldCheck, ArrowRight, ArrowLeft, Plus, Trash } from 'lucide-react';

const SPECIALITIES_LIST = [
  'General Physician',
  'Dentist',
  'ENT Specialist',
  'Dermatologist',
  'Ophthalmologist',
  'Gynecologist',
  'Orthopedic Surgeon',
  'Pediatrician'
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Admin Account & Clinic Profile
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [clinicName, setClinicName] = useState('');

  // Automatically fill email/name if logged in via Clerk
  useEffect(() => {
    if (user) {
      setAdminName(user.fullName || '');
      setAdminEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);
  
  // Step 2: Speciality tag select
  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);

  // Step 3: Doctors profiles
  const [doctors, setDoctors] = useState([
    { name: '', email: '', password: 'DoctorCureQ123!', phone: '', speciality: '', schedules: [{ dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDuration: '15', maxPatients: '30', bufferTime: '5' }] }
  ]);

  const toggleSpeciality = (spec: string) => {
    if (selectedSpecialities.includes(spec)) {
      setSelectedSpecialities(selectedSpecialities.filter(s => s !== spec));
    } else {
      setSelectedSpecialities([...selectedSpecialities, spec]);
    }
  };

  const handleAddDoctor = () => {
    setDoctors([
      ...doctors,
      {
        name: '',
        email: '',
        password: 'DoctorCureQ123!',
        phone: '',
        speciality: selectedSpecialities[0] || 'General Physician',
        schedules: [{ dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDuration: '15', maxPatients: '30', bufferTime: '5' }]
      }
    ]);
  };

  const handleRemoveDoctor = (index: number) => {
    setDoctors(doctors.filter((_, i) => i !== index));
  };

  const handleDoctorChange = (index: number, field: string, value: string) => {
    const updated = [...doctors];
    updated[index] = { ...updated[index], [field]: value };
    setDoctors(updated);
  };

  const handleScheduleChange = (docIndex: number, schedIndex: number, field: string, value: string) => {
    const updated = [...doctors];
    const schedules = [...updated[docIndex].schedules];
    schedules[schedIndex] = { ...schedules[schedIndex], [field]: value };
    updated[docIndex].schedules = schedules;
    setDoctors(updated);
  };

  const handleOnboardSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Register the Admin
      const regResponse = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          phone: adminPhone,
        }),
      });

      const token = regResponse.token;
      localStorage.setItem('cureq_token', token);
      localStorage.setItem('cureq_role', 'CLINIC_ADMIN');

      // 2. Submit Clinic & Doctors configuration
      const onboardResponse = await apiRequest('/auth/onboard', {
        method: 'POST',
        body: JSON.stringify({
          clinicName,
          speciality: selectedSpecialities.join(', '),
          doctors,
        }),
      });

      // Save clinic & branch references in localStorage for dashboard configurations
      localStorage.setItem('cureq_clinic_id', onboardResponse.clinic.id);
      localStorage.setItem('cureq_branch_id', onboardResponse.branch.id);
      if (onboardResponse.branch.id) {
        localStorage.setItem('cureq_doctor_id', onboardResponse.branch.id); // sandbox fallback
      }

      router.push('/dashboard/reception');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Onboarding failed. Please review user details.');
      setStep(1); // Return to fix account
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-[#1a202c]">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <Activity className="mx-auto h-10 w-10 text-[#01696f]" />
        <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#1a202c]">Onboard Your Clinic to CureQ</h2>
        <p className="mt-2 text-sm text-[#64748b] font-light">Set up your profile, branch and schedules in less than 5 minutes</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 border border-[#e9e9e7] shadow-sm rounded-[6px] sm:px-10">
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-200">
              {error}
            </div>
          )}

          {/* Progress Indicators */}
          <div className="flex justify-between items-center mb-8 border-b border-[#e9e9e7] pb-4">
            <span className={`text-xs font-semibold ${step === 1 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>1. Admin Account</span>
            <span className={`text-xs font-semibold ${step === 2 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>2. Specialities</span>
            <span className={`text-xs font-semibold ${step === 3 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>3. Doctor setup</span>
          </div>

          {/* Step 1: Admin & Clinic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#475569]">Clinic Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Multispeciality Clinic"
                  className="mt-1 block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#475569]">Admin Name</label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    className="mt-1 block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569]">Admin Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="9998887770"
                    className="mt-1 block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#475569]">Admin Email</label>
                <input
                  type="email"
                  required
                  placeholder="admin@clinic.com"
                  className="mt-1 block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#475569]">Admin Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="mt-1 block w-full px-3 py-2 border border-[#e9e9e7] rounded-[4px] bg-white text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (clinicName && adminName && adminEmail && adminPassword && adminPhone) setStep(2);
                  else setError('Please fill all account details first.');
                }}
                className="w-full mt-6 py-2 bg-[#01696f] text-white text-sm font-semibold rounded-[4px] hover:bg-[#005459] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2: Speciality Selection */}
          {step === 2 && (
            <div>
              <p className="text-xs text-[#64748b] mb-4 font-light">Select all specialities offered at your clinic branches:</p>
              <div className="grid grid-cols-2 gap-3">
                {SPECIALITIES_LIST.map((spec) => {
                  const selected = selectedSpecialities.includes(spec);
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => toggleSpeciality(spec)}
                      className={`p-3 text-left border rounded-[4px] text-xs font-medium transition-all cursor-pointer ${
                        selected
                          ? 'border-[#01696f] bg-[#01696f]/10 text-[#01696f]'
                          : 'border-[#e9e9e7] bg-white text-[#64748b] hover:bg-[#f4f4f3] hover:text-[#1a202c]'
                      }`}
                    >
                      {spec}
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/2 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] text-xs font-semibold rounded-[4px] flex items-center justify-center gap-1 cursor-pointer hover:bg-[#f4f4f3] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSpecialities.length > 0) setStep(3);
                    else setError('Please select at least one speciality.');
                  }}
                  className="w-1/2 py-2 bg-[#01696f] text-white text-xs font-semibold rounded-[4px] hover:bg-[#005459] flex items-center justify-center gap-1 cursor-pointer shadow-xs transition-colors"
                >
                  Configure Doctors <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Doctors & Schedules setup */}
          {step === 3 && (
            <div className="space-y-6">
              {doctors.map((doc, docIdx) => (
                <div key={docIdx} className="border border-[#e9e9e7] p-4 rounded-[4px] bg-[#fbfbfa] space-y-4 relative shadow-sm">
                  {doctors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDoctor(docIdx)}
                      className="absolute top-3 right-3 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                  <h4 className="font-medium text-xs text-[#01696f]">Doctor Profile #{docIdx + 1}</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-medium text-[#64748b]">Doctor Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Sharma"
                        className="mt-1 block w-full px-3 py-1.5 border border-[#e9e9e7] rounded-[4px] bg-white text-xs focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                        value={doc.name}
                        onChange={(e) => handleDoctorChange(docIdx, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#64748b]">Speciality</label>
                      <select
                        className="mt-1 block w-full px-3 py-1.5 border border-[#e9e9e7] rounded-[4px] bg-white text-xs focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c]"
                        value={doc.speciality}
                        onChange={(e) => handleDoctorChange(docIdx, 'speciality', e.target.value)}
                      >
                        <option value="">Choose...</option>
                        {selectedSpecialities.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-medium text-[#64748b]">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="sharma@clinic.com"
                        className="mt-1 block w-full px-3 py-1.5 border border-[#e9e9e7] rounded-[4px] bg-white text-xs focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                        value={doc.email}
                        onChange={(e) => handleDoctorChange(docIdx, 'email', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-[#64748b]">Contact Number</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        className="mt-1 block w-full px-3 py-1.5 border border-[#e9e9e7] rounded-[4px] bg-white text-xs focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f]/20 text-[#1a202c] placeholder:text-gray-400"
                        value={doc.phone}
                        onChange={(e) => handleDoctorChange(docIdx, 'phone', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Schedule config block */}
                  <div className="border-t border-[#e9e9e7] pt-3 mt-3">
                    <h5 className="text-[10px] font-semibold uppercase text-[#64748b] mb-2">Schedule & Slot Configuration</h5>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] text-[#64748b]">Consulting Day</label>
                        <select
                          className="mt-1 block w-full p-1 border border-[#e9e9e7] rounded-[4px] bg-white text-[10px] focus:outline-none text-[#1a202c]"
                          value={doc.schedules[0].dayOfWeek}
                          onChange={(e) => handleScheduleChange(docIdx, 0, 'dayOfWeek', e.target.value)}
                        >
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                          <option value="0">Sunday</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] text-[#64748b]">Hours</label>
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="text"
                            placeholder="09:00"
                            className="w-1/2 p-1 border border-[#e9e9e7] rounded-[4px] bg-white text-[10px] text-[#1a202c] placeholder:text-gray-400"
                            value={doc.schedules[0].startTime}
                            onChange={(e) => handleScheduleChange(docIdx, 0, 'startTime', e.target.value)}
                          />
                          <span className="text-[#64748b]">-</span>
                          <input
                            type="text"
                            placeholder="17:00"
                            className="w-1/2 p-1 border border-[#e9e9e7] rounded-[4px] bg-white text-[10px] text-[#1a202c] placeholder:text-gray-400"
                            value={doc.schedules[0].endTime}
                            onChange={(e) => handleScheduleChange(docIdx, 0, 'endTime', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] text-[#64748b]">Duration (mins)</label>
                        <select
                          className="mt-1 block w-full p-1 border border-[#e9e9e7] rounded-[4px] bg-white text-[10px] text-[#1a202c]"
                          value={doc.schedules[0].slotDuration}
                          onChange={(e) => handleScheduleChange(docIdx, 0, 'slotDuration', e.target.value)}
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="15">15</option>
                          <option value="20">20</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddDoctor}
                className="w-full py-2 bg-white border border-[#e9e9e7] border-dashed text-xs text-[#64748b] hover:text-[#01696f] hover:border-[#01696f]/40 hover:bg-[#f4f4f3] transition-all flex items-center justify-center gap-1.5 cursor-pointer rounded-[4px]"
              >
                <Plus className="h-4 w-4" /> Add Another Doctor Profile
              </button>

              <div className="mt-8 flex gap-4 pt-4 border-t border-[#e9e9e7]">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/2 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] text-xs font-semibold rounded-[4px] flex items-center justify-center gap-1 cursor-pointer hover:bg-[#f4f4f3] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOnboardSubmit}
                  className="w-1/2 py-2 bg-[#01696f] text-white text-xs font-semibold rounded-[4px] hover:bg-[#005459] flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
                >
                  {loading ? 'Registering Workspace...' : 'Go Live Now'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}