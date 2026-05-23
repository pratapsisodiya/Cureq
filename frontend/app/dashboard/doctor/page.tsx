'use client';

import React, { useState, useEffect } from 'react';
import { useQueueStore, TokenItem } from '../../../src/store/useQueueStore';
import { apiRequest } from '../../../src/utils/api';
import VoiceDictation from '../../../src/components/VoiceDictation';
import { 
  Play, SkipForward, AlertCircle, Save, CheckCircle2,
  Clock, ShieldAlert, FileText, ChevronRight, Activity,
  LayoutDashboard, Calendar, Users, FileBarChart, Bell, Search, Plus, UserPlus, X, User, Phone,
  ArrowRight, ArrowLeft, Trash, Tv, Settings, LogOut
} from 'lucide-react';

const SPECIALITIES_LIST = [
  'General Physician', 'Dentist', 'ENT Specialist', 'Dermatologist',
  'Ophthalmologist', 'Gynecologist', 'Orthopedic Surgeon', 'Pediatrician'
];

export default function DoctorConsole() {
  const { 
    activeQueue, servedToday, fetchQueue, initSocket, disconnectSocket, 
    callNext, skipToken, markNoShow 
  } = useQueueStore();

  const [clinicId, setClinicId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('Doctor');
  const [speciality, setSpeciality] = useState('');

  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // === ONBOARDING STATE ===
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [onboardError, setOnboardError] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [selectedSpecialities, setSelectedSpecialities] = useState<string[]>([]);
  const [doctors, setDoctors] = useState([
    { name: '', email: '', password: 'DoctorCureQ123!', phone: '', speciality: '', schedules: [{ dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDuration: '15', maxPatients: '30', bufferTime: '5' }] }
  ]);
  
  // UI States
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [todayStr, setTodayStr] = useState('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);

  // New Appointment Form State
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientPhone, setNewPatientPhone] = useState('');
  const [newVisitType, setNewVisitType] = useState('NEW');
  const [newUrgency, setNewUrgency] = useState('GENERAL');
  const [newComplaint, setNewComplaint] = useState('');
  const [isAddingToken, setIsAddingToken] = useState(false);

  // Booked Appointments State
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);

  // Patient Database State
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Register Patient Form State
  const [addPatientName, setAddPatientName] = useState('');
  const [addPatientPhone, setAddPatientPhone] = useState('');
  const [addPatientAge, setAddPatientAge] = useState('');
  const [addPatientGender, setAddPatientGender] = useState('Male');
  const [isRegisteringPatient, setIsRegisteringPatient] = useState(false);

  // Medical History State
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPatientName, setHistoryPatientName] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Local consult states
  const [consultNotes, setConsultNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({
    avgConsultTime: 12,
    servedCount: 0,
    noshowRate: 0
  });

  useEffect(() => {
    setTodayStr(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  // 1. Check configuration
  useEffect(() => {
    async function loadDoctorContext() {
      let savedClinicId = localStorage.getItem('cureq_clinic_id') || '';
      let savedBranchId = localStorage.getItem('cureq_branch_id') || '';

      if (!savedClinicId || !savedBranchId) {
        setIsOnboarding(true);
      } else {
        setClinicId(savedClinicId);
        setBranchId(savedBranchId);
        fetchDoctors(savedClinicId);
      }
    }
    loadDoctorContext();
  }, []);

  const fetchDoctors = async (cId: string) => {
    try {
      const res = await apiRequest(`/clinics/${cId}`);
      const schedules = res.clinic.branches[0]?.schedules || [];
      const docs: any[] = [];
      schedules.forEach((s: any) => {
        if (!docs.some(d => d.id === s.doctor.id)) {
          docs.push(s.doctor);
        }
      });
      setDoctorsList(docs);
      if (docs.length > 0) {
        const savedDocId = localStorage.getItem('cureq_active_doctor_id');
        const defaultDoc = docs.find(d => d.id === savedDocId) || docs[0];
        setDoctorId(defaultDoc.id);
        setDoctorName(defaultDoc.user.name);
        setSpeciality(defaultDoc.speciality);
        localStorage.setItem('cureq_active_doctor_id', defaultDoc.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // === ONBOARDING HANDLERS ===
  const handleOnboardSubmit = async () => {
    setLoading(true);
    setOnboardError('');
    try {
      const regResponse = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: adminName, email: adminEmail, password: adminPassword, phone: adminPhone }),
      });
      localStorage.setItem('cureq_token', regResponse.token);
      localStorage.setItem('cureq_role', 'CLINIC_ADMIN');

      const onboardResponse = await apiRequest('/auth/onboard', {
        method: 'POST',
        body: JSON.stringify({ clinicName, speciality: selectedSpecialities.join(', '), doctors }),
      });

      const newClinicId = onboardResponse.clinic.id;
      const newBranchId = onboardResponse.branch.id;
      
      localStorage.setItem('cureq_clinic_id', newClinicId);
      localStorage.setItem('cureq_branch_id', newBranchId);

      setClinicId(newClinicId);
      setBranchId(newBranchId);
      setIsOnboarding(false);
      fetchDoctors(newClinicId);
    } catch (err: any) {
      setOnboardError(err.message || 'Onboarding failed.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorChange = (index: number, field: string, value: string) => {
    const updated = [...doctors];
    updated[index] = { ...updated[index], [field]: value };
    setDoctors(updated);
  };

  const handleResetClinic = () => {
    if (confirm('Are you sure you want to reset this sandbox? This will clear local configuration.')) {
      localStorage.removeItem('cureq_clinic_id');
      localStorage.removeItem('cureq_branch_id');
      localStorage.removeItem('cureq_token');
      localStorage.removeItem('cureq_role');
      localStorage.removeItem('cureq_active_doctor_id');
      window.location.reload();
    }
  };

  const fetchAppointments = async () => {
    if (!branchId || !clinicId) return;
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const res = await apiRequest(`/appointments/${clinicId}?branchId=${branchId}&doctorId=${doctorId}&date=${dateStr}`);
      setAppointmentsList(res.appointments || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await apiRequest('/patients');
      setPatientsList(res.patients || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  const handleCheckIn = async (appointment: any) => {
    if (!branchId) return;
    setIsCheckingIn(appointment.id);
    try {
      await apiRequest(`/queues/${branchId}/token`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          patientPhone: appointment.patient.phone,
          patientName: appointment.patient.name,
          type: appointment.type === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL',
          visitType: appointment.type,
          chiefComplaint: `Checked in from appointment slot ${appointment.timeSlot}`,
          appointmentId: appointment.id
        })
      });
      // Refresh list
      await fetchAppointments();
      await fetchQueue(branchId, doctorId);
    } catch (err: any) {
      alert(err.message || 'Failed to check in patient.');
    } finally {
      setIsCheckingIn(null);
    }
  };

  const handleRegisterPatient = async () => {
    if (!addPatientName || !addPatientPhone) {
      alert('Please fill in patient name and phone number.');
      return;
    }
    setIsRegisteringPatient(true);
    try {
      await apiRequest('/auth/patient-login', {
        method: 'POST',
        body: JSON.stringify({
          phone: addPatientPhone,
          name: addPatientName,
          age: addPatientAge ? parseInt(addPatientAge) : undefined,
          gender: addPatientGender
        })
      });
      // Reset inputs & close modal
      setAddPatientName('');
      setAddPatientPhone('');
      setAddPatientAge('');
      setAddPatientGender('Male');
      setShowAddPatient(false);
      // Refresh patients list
      await fetchPatients();
    } catch (err: any) {
      alert(err.message || 'Failed to register patient.');
    } finally {
      setIsRegisteringPatient(false);
    }
  };

  const handleViewHistory = async (patientId: string, patientName: string) => {
    if (!patientId) return;
    setHistoryPatientName(patientName);
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    setSelectedPatientHistory([]);
    try {
      const res = await apiRequest(`/patients/id/${patientId}/history`);
      setSelectedPatientHistory(res.history || []);
    } catch (err) {
      console.error('Error fetching patient history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleViewHistoryByPhone = async (phone: string, patientName: string) => {
    setHistoryPatientName(patientName);
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    setSelectedPatientHistory([]);
    try {
      const pRes = await apiRequest(`/patients/${phone}`);
      if (pRes.patient && pRes.patient.id) {
        const res = await apiRequest(`/patients/id/${pRes.patient.id}/history`);
        setSelectedPatientHistory(res.history || []);
      } else {
        setSelectedPatientHistory([]);
      }
    } catch (err) {
      console.error('Error fetching patient history by phone:', err);
      setSelectedPatientHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // 2. Init queue syncing
  useEffect(() => {
    if (branchId && doctorId) {
      fetchQueue(branchId, doctorId);
      initSocket(branchId);
      loadPerformanceStats();
      fetchAppointments();
    }
    return () => {
      disconnectSocket();
    };
  }, [branchId, doctorId]);

  useEffect(() => {
    if (activeTab === 'Patients') {
      fetchPatients();
    } else if (activeTab === 'Appointments') {
      fetchAppointments();
    }
  }, [activeTab, branchId, doctorId]);

  const loadPerformanceStats = async () => {
    if (!clinicId) return;
    try {
      const res = await apiRequest(`/analytics/${clinicId}`);
      const myPerf = res.doctorPerformance?.find((d: any) => d.name === doctorName);
      if (myPerf) {
        setPerformanceStats({
          avgConsultTime: myPerf.avgConsultationTime,
          servedCount: myPerf.servedCount,
          noshowRate: myPerf.noShowRate
        });
      }
    } catch (err) {
      console.warn('Failed to load performance analytics.');
    }
  };

  const currentPatient = activeQueue.find(t => t.status === 'IN_CONSULTATION');
  const nextPatient = activeQueue.find(t => t.status === 'WAITING');

  useEffect(() => {
    if (currentPatient) {
      setConsultNotes(currentPatient.chiefComplaint ? `Complaint: ${currentPatient.chiefComplaint}\nNotes: ` : '');
    } else {
      setConsultNotes('');
    }
  }, [currentPatient?.id]);

  const handleSaveNotes = async () => {
    if (!currentPatient) return;
    setIsSavingNotes(true);
    try {
      await apiRequest(`/patients/token/${currentPatient.id}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: consultNotes }),
      });
      setIsSavingNotes(false);
    } catch (err) {
      console.error(err);
      setIsSavingNotes(false);
    }
  };

  const handleCallNext = async () => {
    if (currentPatient && consultNotes) {
      await handleSaveNotes();
    }
    await callNext(branchId, doctorId, consultNotes);
    fetchQueue(branchId, doctorId);
    loadPerformanceStats();
  };

  const handleSkip = async () => {
    if (!currentPatient) return;
    await skipToken(branchId, doctorId, currentPatient.id);
    fetchQueue(branchId, doctorId);
  };

  const handleNoShow = async () => {
    if (!currentPatient) return;
    await markNoShow(branchId, doctorId, currentPatient.id);
    fetchQueue(branchId, doctorId);
  };

  const handleAddNewAppointment = async () => {
    if (!newPatientName || !newPatientPhone) {
      alert('Please fill in patient name and phone.');
      return;
    }
    setIsAddingToken(true);
    try {
      await useQueueStore.getState().addToken(branchId, {
        doctorId,
        patientName: newPatientName,
        patientPhone: newPatientPhone,
        type: newUrgency,
        visitType: newVisitType,
        chiefComplaint: newComplaint
      });
      setShowNewAppointment(false);
      setNewPatientName('');
      setNewPatientPhone('');
      setNewComplaint('');
      // Queue automatically syncs via socket
    } catch (err) {
      alert('Failed to add patient to queue.');
    } finally {
      setIsAddingToken(false);
    }
  };

  const NavItem = ({ icon: Icon, label, id }: any) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${
          isActive 
            ? 'bg-[#f4f4f3] text-[#01696f]' 
            : 'text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]'
        }`}
      >
        <Icon className="h-4 w-4" /> {label}
      </button>
    );
  };

  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] flex flex-col items-center justify-center p-8 font-sans">
        <div className="max-w-2xl w-full animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-[#1a202c]">Set Up Your Clinic</h2>
            <p className="mt-2 text-sm text-[#64748b]">Configure your branch and doctors to get started.</p>
          </div>

          <div className="bg-white p-8 border border-[#e9e9e7] shadow-sm rounded-xl">
            {onboardError && (
              <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-200">{onboardError}</div>
            )}

            <div className="flex justify-between items-center mb-8 border-b border-[#e9e9e7] pb-4">
              <span className={`text-xs font-bold uppercase tracking-wider ${step === 1 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>1. Details</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${step === 2 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>2. Specialities</span>
              <span className={`text-xs font-bold uppercase tracking-wider ${step === 3 ? 'text-[#01696f]' : 'text-[#64748b]'}`}>3. Doctors</span>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Clinic Name</label>
                  <input type="text" required placeholder="Apex Clinic" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:border-[#01696f] outline-none shadow-xs" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Admin Name</label>
                    <input type="text" required placeholder="John Doe" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:border-[#01696f] outline-none shadow-xs" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Admin Phone</label>
                    <input type="text" required placeholder="9998887770" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:border-[#01696f] outline-none shadow-xs" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Admin Email</label>
                  <input type="email" required placeholder="admin@clinic.com" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:border-[#01696f] outline-none shadow-xs" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Password</label>
                  <input type="password" required placeholder="••••••••" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:border-[#01696f] outline-none shadow-xs" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
                <button onClick={() => { if (clinicName && adminName && adminEmail && adminPassword && adminPhone) setStep(2); else setOnboardError('Fill all details'); }} className="w-full mt-6 py-2 bg-[#01696f] text-white font-bold text-sm rounded-md shadow-md hover:bg-[#005459] transition-colors flex items-center justify-center gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-sm text-[#64748b] mb-4">Select all specialities offered:</p>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIALITIES_LIST.map((spec) => {
                    const sel = selectedSpecialities.includes(spec);
                    return (
                      <button key={spec} onClick={() => {
                        if (sel) setSelectedSpecialities(selectedSpecialities.filter(s => s !== spec));
                        else setSelectedSpecialities([...selectedSpecialities, spec]);
                      }} className={`p-3 text-left border rounded-md text-sm font-semibold transition-all shadow-xs ${sel ? 'border-[#01696f] bg-[#e6f3f4] text-[#01696f]' : 'border-[#e9e9e7] bg-white text-[#64748b] hover:bg-[#f4f4f3]'}`}>
                        {spec}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex gap-4">
                  <button onClick={() => setStep(1)} className="w-1/2 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] font-bold text-sm rounded-md shadow-xs hover:bg-[#f4f4f3]">Back</button>
                  <button onClick={() => { if (selectedSpecialities.length > 0) setStep(3); else setOnboardError('Select at least one.'); }} className="w-1/2 py-2 bg-[#01696f] text-white font-bold text-sm rounded-md shadow-md hover:bg-[#005459]">Configure Doctors</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                {doctors.map((doc, docIdx) => (
                  <div key={docIdx} className="border border-[#e9e9e7] p-5 rounded-lg bg-[#fbfbfa] space-y-4 relative shadow-inner">
                    {doctors.length > 1 && (
                      <button onClick={() => setDoctors(doctors.filter((_, i) => i !== docIdx))} className="absolute top-3 right-3 text-red-400 hover:text-red-600">
                        <Trash className="h-4 w-4" />
                      </button>
                    )}
                    <h4 className="font-bold text-sm text-[#01696f]">Doctor #{docIdx + 1}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase">Doctor Name</label>
                        <input type="text" className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.name} onChange={(e) => handleDoctorChange(docIdx, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase">Speciality</label>
                        <select className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.speciality} onChange={(e) => handleDoctorChange(docIdx, 'speciality', e.target.value)}>
                          <option value="">Choose...</option>
                          {selectedSpecialities.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setDoctors([...doctors, { name: '', email: '', password: 'DoctorCureQ123!', phone: '', speciality: selectedSpecialities[0] || '', schedules: [{ dayOfWeek: '1', startTime: '09:00', endTime: '17:00', slotDuration: '15', maxPatients: '30', bufferTime: '5' }] }])} className="w-full py-2 bg-white border border-[#e9e9e7] border-dashed text-sm font-semibold text-[#64748b] hover:text-[#01696f] hover:bg-[#f4f4f3] rounded-md shadow-xs">
                  + Add Another Doctor
                </button>
                <div className="mt-8 flex gap-4 pt-4 border-t border-[#e9e9e7]">
                  <button onClick={() => setStep(2)} className="w-1/2 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] font-bold text-sm rounded-md shadow-xs hover:bg-[#f4f4f3]">Back</button>
                  <button onClick={handleOnboardSubmit} disabled={loading} className="w-1/2 py-2 bg-[#01696f] text-white font-bold text-sm rounded-md shadow-md hover:bg-[#005459] disabled:opacity-50">
                    {loading ? 'Processing...' : 'Complete Setup'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] flex flex-col md:flex-row relative">
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-[#e9e9e7] flex flex-col h-auto md:h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-[#e9e9e7] flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <span className="font-serif text-xl font-bold tracking-tight text-[#1a202c]">CureQ</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Dashboard" id="Dashboard" />
          <NavItem icon={Calendar} label="Appointments" id="Appointments" />
          <NavItem icon={Users} label="Patients" id="Patients" />
          <NavItem icon={FileBarChart} label="Reports" id="Reports" />
        </nav>
        <div className="p-4 border-t border-[#e9e9e7]">
          <button 
            onClick={handleResetClinic}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer mb-4"
          >
            <LogOut className="h-3.5 w-3.5" /> Reset Sandbox Clinic
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#e6f3f4] text-[#01696f] flex items-center justify-center font-bold">
              {doctorName ? doctorName.charAt(0) : 'D'}
            </div>
            <div>
              <p className="text-sm font-semibold">{doctorName}</p>
              <p className="text-xs text-[#64748b]">{speciality}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        
        {/* Top Navbar */}
        <header className="bg-white border-b border-[#e9e9e7] px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <span className="font-bold text-[#1a202c]">Doctor Console</span>
            <div className="h-6 w-px bg-[#e9e9e7]"></div>
            <select 
              value={doctorId} 
              onChange={(e) => {
                const doc = doctorsList.find(d => d.id === e.target.value);
                if (doc) {
                  setDoctorId(doc.id);
                  setDoctorName(doc.user.name);
                  setSpeciality(doc.speciality);
                  localStorage.setItem('cureq_active_doctor_id', doc.id);
                }
              }}
              className="px-3 py-1.5 border border-[#e9e9e7] rounded-md bg-[#fbfbfa] text-sm focus:outline-none focus:border-[#01696f] text-[#1a202c] shadow-xs cursor-pointer"
            >
              {doctorsList.length > 0 ? doctorsList.map(doc => (
                <option key={doc.id} value={doc.id}>Console for {doc.user?.name} ({doc.speciality})</option>
              )) : <option>No Doctors Available</option>}
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href={`/display/${clinicId}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs font-bold text-[#01696f] hover:underline flex items-center gap-1 border border-[#01696f]/20 bg-[#e6f3f4] px-2.5 py-1 rounded shadow-xs"
            >
              <Tv className="h-3.5 w-3.5" /> Live TV
            </a>
            <div className="h-6 w-px bg-[#e9e9e7]"></div>
            <a 
              href="/dashboard/reception" 
              className="text-xs font-semibold text-[#64748b] hover:text-[#1a202c] hover:underline"
            >
              Reception Console
            </a>
            <div className="h-6 w-px bg-[#e9e9e7]"></div>
            <span className="text-xs bg-[#e6f3f4] text-[#01696f] px-2.5 py-1 rounded border border-[#01696f]/20 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#01696f] animate-pulse"></span> Live Sync
            </span>
          </div>
        </header>

        {/* ONBOARDING WIZARD */}
        {/* DOCTOR CONSOLE MAIN CONTENT */}
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
          
          {/* Welcome & Quick Actions */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-serif font-bold text-[#1a202c]">
                {activeTab === 'Dashboard' ? `Welcome back, ${doctorName}` : activeTab}
              </h1>
              <p className="text-[#64748b] mt-1 font-medium">{todayStr || 'Loading date...'}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAddPatient(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e9e9e7] text-[#1a202c] hover:bg-[#f4f4f3] rounded-md text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Add Patient
              </button>
              <button 
                onClick={() => setShowNewAppointment(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#01696f] text-white hover:bg-[#005459] rounded-md text-sm font-semibold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> New Appointment
              </button>
            </div>
          </div>

          {/* DASHBOARD TAB */}
          {activeTab === 'Dashboard' && (
            <div className="grid lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              
              {/* Left Column: Active Consultation */}
              <div className="lg:col-span-2 space-y-8">
                
                <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                  <div className="p-6">
                    {currentPatient ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-[#1a202c]">Current Consultation</h2>
                          {currentPatient.status !== 'IN_CONSULTATION' && (
                            <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-semibold border border-amber-200">Paused</span>
                          )}
                        </div>

                        {/* Patient mini-card */}
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-[#e9e9e7]">
                          <div className="flex gap-4">
                            <div className="h-12 w-12 rounded-full bg-[#fbfbfa] border border-[#e9e9e7] flex items-center justify-center shadow-xs">
                              <User className="h-6 w-6 text-[#64748b]" />
                            </div>
                            <div>
                              <h3 className="font-bold text-xl text-[#1a202c]">{currentPatient.patientName}</h3>
                              <div className="flex items-center gap-3 mt-1 text-sm text-[#64748b]">
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {currentPatient.patientPhone}</span>
                                <span className="text-[#e9e9e7]">|</span>
                                <span className="capitalize font-medium">#{currentPatient.tokenNo}</span>
                                <span className="text-[#e9e9e7]">|</span>
                                <button 
                                  onClick={() => handleViewHistoryByPhone(currentPatient.patientPhone, currentPatient.patientName)}
                                  className="text-xs font-semibold text-[#01696f] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="h-3 w-3" /> Medical History
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="inline-block px-3 py-1 bg-[#e6f3f4] text-[#01696f] text-xs font-bold rounded shadow-xs mb-1 uppercase tracking-wider">
                              {currentPatient.type}
                            </div>
                            <p className="text-xs text-[#64748b] mt-1 font-medium">Est Wait was: {currentPatient.estimatedWait}m</p>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Chief Complaint</h4>
                            <p className="text-sm font-medium text-[#1a202c] bg-[#fbfbfa] p-3 rounded-md border border-[#e9e9e7]">
                              {currentPatient.chiefComplaint || 'No complaints noted by reception.'}
                            </p>
                          </div>

                          <div>
                            <div className="flex justify-between items-end mb-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Consultation Notes / Prescription</h4>
                              <VoiceDictation onResult={(text) => setConsultNotes(prev => prev ? `${prev} ${text}` : text)} />
                            </div>
                            <textarea
                              value={consultNotes}
                              onChange={(e) => setConsultNotes(e.target.value)}
                              placeholder="Type or dictate patient observations, diagnosis, and prescribed medications here..."
                              className="w-full h-40 p-4 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f] resize-none text-sm leading-relaxed shadow-inner"
                            ></textarea>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                            <div className="flex gap-3">
                              <button
                                onClick={handleSkip}
                                className="px-4 py-2 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <SkipForward className="h-3.5 w-3.5" /> Skip
                              </button>
                              <button
                                onClick={handleNoShow}
                                className="px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" /> No-Show
                              </button>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={handleSaveNotes}
                                disabled={isSavingNotes}
                                className="px-5 py-2 border border-[#e9e9e7] bg-white hover:bg-[#f4f4f3] text-[#1a202c] text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                              >
                                <Save className="h-4 w-4" /> {isSavingNotes ? 'Saving...' : 'Save Draft'}
                              </button>
                              <button
                                onClick={handleCallNext}
                                className="px-6 py-2 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4" /> Complete & Next
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-20 text-center flex flex-col items-center">
                        <div className="h-16 w-16 bg-[#f4f4f3] rounded-full flex items-center justify-center mb-4">
                          <Play className="h-8 w-8 text-[#01696f]" />
                        </div>
                        <h3 className="font-serif text-xl font-bold text-[#1a202c]">Ready for Next Patient</h3>
                        <p className="text-sm text-[#64748b] mt-2 max-w-sm mx-auto font-light leading-relaxed">
                          You are not currently in a consultation. Pull the next waiting patient from the queue to begin.
                        </p>
                        <button
                          onClick={handleCallNext}
                          className="mt-8 px-6 py-3 bg-[#01696f] hover:bg-[#005459] text-white text-sm font-bold shadow-md rounded-md transition-all cursor-pointer flex items-center gap-2"
                        >
                          Call Next Patient <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Previews & Stats */}
              <div className="space-y-6">
                <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                    <h3 className="text-xs font-bold uppercase text-[#64748b] tracking-wider">Up Next</h3>
                  </div>
                  <div className="p-5">
                    {nextPatient ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-base text-[#1a202c]">{nextPatient.patientName}</h4>
                            <span className="text-[11px] text-[#64748b] font-medium block mt-1">
                              Token: {nextPatient.tokenNo} • Type: {nextPatient.type} • Seat: <span className={nextPatient.seatStatus === 'SEATED' ? 'text-[#01696f] font-bold' : 'text-amber-700 font-bold'}>{nextPatient.seatStatus.replace('_', ' ')}</span>
                            </span>
                          </div>
                          <span className="text-[10px] bg-[#e6f3f4] text-[#01696f] border border-[#01696f]/20 px-2 py-1 rounded font-bold uppercase tracking-wider shadow-xs">
                            ~ {nextPatient.estimatedWait}m Wait
                          </span>
                        </div>
                        {nextPatient.chiefComplaint && (
                          <div className="bg-[#fbfbfa] p-3 border border-[#e9e9e7] rounded-md">
                            <p className="text-xs text-[#64748b] leading-relaxed">
                              <strong className="text-[#1a202c]">Complaint:</strong> {nextPatient.chiefComplaint}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={handleCallNext}
                          className="w-full py-2.5 bg-white hover:bg-[#f4f4f3] text-xs font-bold uppercase tracking-wider rounded-md border border-[#e9e9e7] transition-all flex items-center justify-center gap-1 text-[#01696f] cursor-pointer shadow-xs"
                        >
                          Start Next Consult <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-sm text-[#64748b] font-medium">No other patients waiting.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                    <h3 className="text-xs font-bold uppercase text-[#64748b] tracking-wider">Today's Overview</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-[#e9e9e7]">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#e6f3f4] rounded-md">
                          <Clock className="h-4 w-4 text-[#01696f]" />
                        </div>
                        <span className="text-sm font-medium text-[#64748b]">Avg. Consult Time</span>
                      </div>
                      <span className="text-sm font-bold text-[#1a202c]">{performanceStats.avgConsultTime}m</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-[#e9e9e7]">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-emerald-50 rounded-md">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="text-sm font-medium text-[#64748b]">Patients Served</span>
                      </div>
                      <span className="text-sm font-bold text-[#1a202c]">{performanceStats.servedCount}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-red-50 rounded-md">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        </div>
                        <span className="text-sm font-medium text-[#64748b]">No-Show Rate</span>
                      </div>
                      <span className="text-sm font-bold text-[#1a202c]">{performanceStats.noshowRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* APPOINTMENTS TAB */}
          {activeTab === 'Appointments' && (
            <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden animate-in fade-in duration-300">
              <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex justify-between items-center">
                <h2 className="font-semibold text-lg">Today's Scheduled Appointments</h2>
                <span className="text-xs font-semibold bg-[#e6f3f4] text-[#01696f] px-3 py-1 rounded-full">
                  {appointmentsList.filter(a => a.status === 'BOOKED').length} Booked Today
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-xs uppercase font-semibold text-[#64748b]">
                    <tr>
                      <th className="px-6 py-3">Time Slot</th>
                      <th className="px-6 py-3">Patient Name</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Visit Type</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9e9e7]">
                    {appointmentsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-[#64748b]">No scheduled appointments for today.</td>
                      </tr>
                    ) : (
                      appointmentsList.map((app) => (
                        <tr key={app.id} className="hover:bg-[#fbfbfa] transition-colors">
                          <td className="px-6 py-4 font-bold text-[#01696f] flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#64748b]" /> {app.timeSlot}
                          </td>
                          <td className="px-6 py-4 font-medium text-[#1a202c]">{app.patient?.name}</td>
                          <td className="px-6 py-4 text-[#64748b]">{app.patient?.phone}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-[10px] uppercase rounded font-bold tracking-wider ${
                              app.type === 'EMERGENCY' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {app.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-[10px] uppercase rounded font-bold tracking-wider ${
                              app.status === 'BOOKED' 
                                ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                                : app.status === 'CHECKED_IN' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                  : 'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                              {app.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex gap-2 justify-end">
                              {app.status === 'BOOKED' && (
                                <button
                                  onClick={() => handleCheckIn(app)}
                                  disabled={isCheckingIn === app.id}
                                  className="text-xs font-bold text-white bg-[#01696f] hover:bg-[#005459] px-3 py-1.5 rounded shadow-sm disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  {isCheckingIn === app.id ? 'Checking In...' : 'Check-in'}
                                </button>
                              )}
                              <button
                                onClick={() => handleViewHistoryByPhone(app.patient?.phone, app.patient?.name)}
                                className="text-xs font-semibold text-[#64748b] hover:text-[#1a202c] bg-white border border-[#e9e9e7] px-2.5 py-1.5 rounded shadow-xs cursor-pointer"
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PATIENTS TAB */}
          {activeTab === 'Patients' && (
            <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden animate-in fade-in duration-300">
              <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex justify-between items-center">
                <h2 className="font-semibold text-lg">Patient Database</h2>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or phone..." 
                    className="w-full pl-10 pr-3 py-1.5 border border-[#e9e9e7] rounded text-sm focus:outline-none focus:border-[#01696f]" 
                  />
                </div>
              </div>
              {patientsList.filter(p => {
                const q = searchQuery.toLowerCase();
                return (p.name || '').toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q);
              }).length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-[#e9e9e7] mx-auto mb-3" />
                  <h3 className="font-medium text-[#1a202c]">No records found</h3>
                  <p className="text-sm text-[#64748b] mt-1">Add a new patient or adjust your search.</p>
                  <button onClick={() => setShowAddPatient(true)} className="mt-4 px-4 py-2 bg-[#01696f] text-white rounded-md text-sm font-semibold hover:bg-[#005459]">
                    Add Patient
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-xs uppercase font-semibold text-[#64748b]">
                      <tr>
                        <th className="px-6 py-3">Patient Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Age</th>
                        <th className="px-6 py-3">Gender</th>
                        <th className="px-6 py-3">Blood Group</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e9e9e7]">
                      {patientsList.filter(p => {
                        const q = searchQuery.toLowerCase();
                        return (p.name || '').toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q);
                      }).map((p) => (
                        <tr key={p.id} className="hover:bg-[#fbfbfa] transition-colors">
                          <td className="px-6 py-4 font-semibold text-[#1a202c]">{p.name}</td>
                          <td className="px-6 py-4 text-[#64748b]">{p.phone}</td>
                          <td className="px-6 py-4">{p.age ? `${p.age} yrs` : 'N/A'}</td>
                          <td className="px-6 py-4 capitalize">{p.gender || 'N/A'}</td>
                          <td className="px-6 py-4 uppercase font-medium">{p.bloodGroup || 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleViewHistory(p.id, p.name)}
                              className="text-xs font-semibold text-[#01696f] hover:underline flex items-center gap-1 justify-end ml-auto bg-[#e6f3f4] px-2.5 py-1.5 rounded shadow-xs border border-[#01696f]/20 cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" /> Medical History
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'Reports' && (
            <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden animate-in fade-in duration-300">
              <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                <h2 className="font-semibold text-lg">Analytics & Reports</h2>
              </div>
              <div className="p-8 text-center">
                <FileBarChart className="h-12 w-12 text-[#e9e9e7] mx-auto mb-3" />
                <h3 className="font-medium text-[#1a202c]">Analytics Dashboard</h3>
                <p className="text-sm text-[#64748b] mt-1">Detailed reports will be generated once you have enough data.</p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODALS */}
      
      {/* Add Patient Modal */}
      {showAddPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#e9e9e7] flex justify-between items-center bg-[#fbfbfa]">
              <h3 className="font-bold text-lg">Register New Patient</h3>
              <button onClick={() => setShowAddPatient(false)} className="text-[#64748b] hover:text-[#1a202c]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Full Name *</label>
                <input 
                  type="text" 
                  value={addPatientName}
                  onChange={(e) => setAddPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" 
                  placeholder="John Doe" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Phone Number *</label>
                <input 
                  type="tel" 
                  value={addPatientPhone}
                  onChange={(e) => setAddPatientPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" 
                  placeholder="9876543210" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Age</label>
                  <input 
                    type="number" 
                    value={addPatientAge}
                    onChange={(e) => setAddPatientAge(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" 
                    placeholder="30" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Gender</label>
                  <select 
                    value={addPatientGender}
                    onChange={(e) => setAddPatientGender(e.target.value)}
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa] flex justify-end gap-3">
              <button 
                onClick={() => setShowAddPatient(false)} 
                className="px-4 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] font-semibold text-sm rounded-md hover:bg-[#f4f4f3]"
              >
                Cancel
              </button>
              <button 
                onClick={handleRegisterPatient} 
                disabled={isRegisteringPatient}
                className="px-4 py-2 bg-[#01696f] text-white font-semibold text-sm rounded-md hover:bg-[#005459] disabled:opacity-50"
              >
                {isRegisteringPatient ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Appointment Modal */}
      {showNewAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#e9e9e7] flex justify-between items-center bg-[#fbfbfa]">
              <h3 className="font-bold text-lg">Schedule Appointment</h3>
              <button onClick={() => setShowNewAppointment(false)} className="text-[#64748b] hover:text-[#1a202c]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Patient Name *</label>
                  <input type="text" value={newPatientName} onChange={(e) => setNewPatientName(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Phone *</label>
                  <input type="text" value={newPatientPhone} onChange={(e) => setNewPatientPhone(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" placeholder="9876543210" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Visit Type</label>
                  <select value={newVisitType} onChange={(e) => setNewVisitType(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]">
                    <option value="NEW">General (New)</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Urgency</label>
                  <select value={newUrgency} onChange={(e) => setNewUrgency(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]">
                    <option value="GENERAL">Normal</option>
                    <option value="PRIORITY">Priority</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider">Chief Complaint</label>
                  <VoiceDictation onResult={(text) => setNewComplaint(prev => prev ? `${prev} ${text}` : text)} />
                </div>
                <textarea value={newComplaint} onChange={(e) => setNewComplaint(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f] resize-none h-20 shadow-inner" placeholder="E.g., Fever and cough..."></textarea>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa] flex justify-end gap-3">
              <button onClick={() => setShowNewAppointment(false)} className="px-4 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] font-semibold text-sm rounded-md hover:bg-[#f4f4f3]">Cancel</button>
              <button onClick={handleAddNewAppointment} disabled={isAddingToken} className="px-4 py-2 bg-[#01696f] text-white font-semibold text-sm rounded-md hover:bg-[#005459] disabled:opacity-50">
                {isAddingToken ? 'Adding...' : 'Add to Queue'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Medical History Viewer Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#e9e9e7] flex justify-between items-center bg-[#fbfbfa]">
              <h3 className="font-bold text-lg">Medical History - {historyPatientName}</h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-[#64748b] hover:text-[#1a202c]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {isLoadingHistory ? (
                <div className="text-center py-8 text-[#64748b]">Loading patient history...</div>
              ) : selectedPatientHistory.length === 0 ? (
                <div className="text-center py-8 text-[#64748b]">No past visit history recorded for this patient.</div>
              ) : (
                <div className="space-y-4">
                  {selectedPatientHistory.map((visit: any) => (
                    <div key={visit.id} className="border border-[#e9e9e7] rounded-lg p-4 bg-[#fbfbfa]">
                      <div className="flex justify-between items-start mb-2 pb-2 border-b border-[#e9e9e7]">
                        <div>
                          <p className="font-bold text-[#01696f] text-sm">{visit.specialty} Consult</p>
                          <p className="text-xs text-[#64748b]">Doctor: {visit.doctorName}</p>
                        </div>
                        <span className="text-xs text-[#64748b] font-medium">
                          {new Date(visit.date).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {visit.chiefComplaint && (
                          <div>
                            <strong className="text-xs text-[#64748b] uppercase tracking-wider block">Chief Complaint</strong>
                            <p className="text-[#1a202c] font-medium">{visit.chiefComplaint}</p>
                          </div>
                        )}
                        {visit.notes && (
                          <div>
                            <strong className="text-xs text-[#64748b] uppercase tracking-wider block">Notes / Prescription</strong>
                            <p className="text-[#1a202c] bg-white p-2.5 rounded border border-[#e9e9e7] whitespace-pre-wrap font-mono text-xs">{visit.notes}</p>
                          </div>
                        )}
                        {visit.followUpDate && (
                          <div>
                            <strong className="text-xs text-[#64748b] uppercase tracking-wider">Follow Up Date: </strong>
                            <span className="text-sm font-medium">{visit.followUpDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa] flex justify-end">
              <button onClick={() => setIsHistoryOpen(false)} className="px-4 py-2 bg-[#01696f] text-white font-semibold text-sm rounded-md hover:bg-[#005459]">Close</button>
            </div>
          </div>
        </div>
      )}

      </div>
    );
  }