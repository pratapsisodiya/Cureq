'use client';

import React, { useState, useEffect } from 'react';
import { useQueueStore, TokenItem } from '../../../src/store/useQueueStore';
import { apiRequest } from '../../../src/utils/api';
import VoiceDictation from '../../../src/components/VoiceDictation';
import { 
  Users, Activity, CheckCircle, AlertTriangle, 
  Search, Printer, MoveUp, MoveDown, Mail, Bell, X, UserPlus,
  LayoutDashboard, Settings, Plus, Trash, ArrowRight, ArrowLeft
} from 'lucide-react';

const SPECIALITIES_LIST = [
  'General Physician', 'Dentist', 'ENT Specialist', 'Dermatologist',
  'Ophthalmologist', 'Gynecologist', 'Orthopedic Surgeon', 'Pediatrician'
];

export default function ReceptionDashboard() {
  const { 
    activeQueue, servedToday, skippedToday, noShowToday,
    fetchQueue, initSocket, disconnectSocket, reorderQueue, recallToken 
  } = useQueueStore();

  const [clinicId, setClinicId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  // UI Tabs
  const [activeTab, setActiveTab] = useState('Dashboard');

  // Walk-in form states
  const [searchPhone, setSearchPhone] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [visitType, setVisitType] = useState('NEW');
  const [urgencyType, setUrgencyType] = useState('GENERAL');
  const [chiefComplaint, setChiefComplaint] = useState('');

  // UI state
  const [printToken, setPrintToken] = useState<TokenItem | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

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

  // 1. Initial configuration check
  useEffect(() => {
    async function loadClinicStructure() {
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
    loadClinicStructure();
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
        setSelectedDoctorId(docs[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Refresh active queue and socket listeners when branch/doctor changes
  useEffect(() => {
    if (branchId && selectedDoctorId) {
      fetchQueue(branchId, selectedDoctorId);
      initSocket(branchId);
    }
    return () => {
      disconnectSocket();
    };
  }, [branchId, selectedDoctorId]);

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

  // === RECEPTION HANDLERS ===
  const handlePhoneSearch = async () => {
    if (searchPhone.length < 10) return;
    try {
      const data = await apiRequest(`/patients/${searchPhone}`);
      if (data.patient) {
        setPatientName(data.patient.name);
        setPatientPhone(data.patient.phone);
        setPatientAge(data.patient.age || '');
        setPatientGender(data.patient.gender || 'Male');
        setErrorMessage('');
      }
    } catch (err: any) {
      setPatientPhone(searchPhone);
      setErrorMessage('New patient phone number. Please enter details to register.');
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!patientName || !patientPhone || !selectedDoctorId) {
      setErrorMessage('Please fill in patient details and select a doctor.');
      return;
    }

    try {
      const pResponse = await apiRequest('/auth/patient-login', {
        method: 'POST',
        body: JSON.stringify({ phone: patientPhone, name: patientName, age: patientAge, gender: patientGender }),
      });

      const tokenRes = await apiRequest(`/queues/${branchId}/token`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          patientPhone: patientPhone,
          patientName: patientName,
          type: urgencyType,
          visitType: visitType,
          chiefComplaint: chiefComplaint,
          patientId: pResponse.user.id,
        }),
      });

      // Reset
      setPatientName(''); setPatientPhone(''); setSearchPhone('');
      setPatientAge(''); setChiefComplaint(''); setErrorMessage('');

      setPrintToken(tokenRes.token);
      setTimeout(() => window.print(), 500);

      fetchQueue(branchId, selectedDoctorId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error generating token.');
    }
  };

  const handleOpenLogs = async () => {
    setIsLogsOpen(true);
    if (!branchId) return;
    try {
      const res = await apiRequest(`/notifications/${branchId}`);
      setNotificationLogs(res.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNudge = async (index: number, direction: 'UP' | 'DOWN') => {
    const newQueue = [...activeQueue];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIdx];
    newQueue[targetIdx] = temp;

    const tokenIds = newQueue.map(t => t.id);
    await reorderQueue(branchId, selectedDoctorId, tokenIds);
    fetchQueue(branchId, selectedDoctorId);
  };

  const getUrgencyBadge = (eta: number) => {
    if (eta > 60) return 'bg-red-50 text-red-700 border-red-200';
    if (eta > 30) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-[#e6f3f4] text-[#01696f] border-[#01696f]/20';
  };

  const NavItem = ({ icon: Icon, label, id }: any) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${
          isActive ? 'bg-[#f4f4f3] text-[#01696f]' : 'text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]'
        }`}
      >
        <Icon className="h-4 w-4" /> {label}
      </button>
    );
  };

  // === RENDER ===
  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] flex flex-col md:flex-row relative font-sans">
      
      {/* Sidebar */}
      {!isOnboarding && (
        <aside className="w-full md:w-64 bg-white border-r border-[#e9e9e7] flex flex-col h-auto md:h-screen sticky top-0 z-20 shadow-xs">
          <div className="p-6 border-b border-[#e9e9e7] flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#01696f]" />
            <span className="font-serif text-xl font-bold tracking-tight text-[#1a202c]">CureQ</span>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavItem icon={LayoutDashboard} label="Dashboard" id="Dashboard" />
            <NavItem icon={Users} label="Patient Records" id="Patients" />
            <NavItem icon={Settings} label="Clinic Settings" id="Settings" />
          </nav>
          <div className="p-4 border-t border-[#e9e9e7]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#e6f3f4] text-[#01696f] flex items-center justify-center font-bold">R</div>
              <div>
                <p className="text-sm font-semibold">Receptionist</p>
                <p className="text-xs text-[#64748b]">Front Desk</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        
        {/* Top Navbar */}
        <header className="bg-white border-b border-[#e9e9e7] px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          {!isOnboarding ? (
            <div className="flex items-center gap-4">
              <span className="font-bold text-[#1a202c]">Front Desk</span>
              <div className="h-6 w-px bg-[#e9e9e7]"></div>
              <select 
                value={selectedDoctorId} 
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-3 py-1.5 border border-[#e9e9e7] rounded-md bg-[#fbfbfa] text-sm focus:outline-none focus:border-[#01696f] text-[#1a202c] shadow-xs cursor-pointer"
              >
                {doctorsList.length > 0 ? doctorsList.map(doc => (
                  <option key={doc.id} value={doc.id}>Queue for {doc.user?.name} ({doc.speciality})</option>
                )) : <option>No Doctors Available</option>}
              </select>
            </div>
          ) : (
            <div className="font-bold text-[#1a202c] flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#01696f]" /> CureQ Onboarding
            </div>
          )}
          
          <div className="flex items-center gap-4">
            {!isOnboarding && (
              <button onClick={handleOpenLogs} className="p-2 text-[#64748b] hover:text-[#1a202c] hover:bg-[#fbfbfa] rounded-full transition-colors relative cursor-pointer shadow-xs">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-2 h-2.5 w-2.5 bg-[#01696f] rounded-full border-2 border-white"></span>
              </button>
            )}
            <div className="h-6 w-px bg-[#e9e9e7]"></div>
            <span className="text-xs bg-[#e6f3f4] text-[#01696f] px-2.5 py-1 rounded border border-[#01696f]/20 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#01696f] animate-pulse"></span> Live Sync
            </span>
          </div>
        </header>

        {/* ONBOARDING WIZARD */}
        {isOnboarding ? (
          <div className="p-8 max-w-2xl mx-auto w-full my-auto animate-in fade-in zoom-in-95 duration-300">
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
        ) : (
          /* RECEPTION DASHBOARD */
          <>
            {activeTab === 'Dashboard' && (
              <div className="p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
                
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-center shadow-xs">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Total Today</span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="p-2 bg-[#fbfbfa] rounded-md"><Users className="h-5 w-5 text-[#64748b]" /></div>
                  <h3 className="text-2xl font-bold text-[#1a202c]">{activeQueue.length + servedToday.length + noShowToday.length + skippedToday.length}</h3>
                </div>
              </div>
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-center shadow-xs">
                <span className="text-[10px] font-bold text-[#01696f] uppercase tracking-wider">In Queue</span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="p-2 bg-[#e6f3f4] rounded-md"><Activity className="h-5 w-5 text-[#01696f]" /></div>
                  <h3 className="text-2xl font-bold text-[#1a202c]">{activeQueue.length}</h3>
                </div>
              </div>
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-center shadow-xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Served</span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="p-2 bg-emerald-50 rounded-md"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
                  <h3 className="text-2xl font-bold text-[#1a202c]">{servedToday.length}</h3>
                </div>
              </div>
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 flex flex-col justify-center shadow-xs">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">No-Show / Skipped</span>
                <div className="flex items-center gap-3 mt-1">
                  <div className="p-2 bg-red-50 rounded-md"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                  <h3 className="text-2xl font-bold text-[#1a202c]">{noShowToday.length + skippedToday.length}</h3>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Quick Walk-in */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden h-fit">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                  <h2 className="text-sm font-bold text-[#1a202c] flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-[#01696f]" /> Quick Walk-in
                  </h2>
                </div>
                <div className="p-6">
                  <div className="mb-5">
                    <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Search via Phone</label>
                    <div className="flex gap-2">
                      <input type="text" maxLength={10} placeholder="Enter 10-digit phone" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner" value={searchPhone} onChange={(e) => { setSearchPhone(e.target.value); if (e.target.value.length === 10) handlePhoneSearch(); }} />
                      <button onClick={handlePhoneSearch} className="px-3 bg-white hover:bg-[#f4f4f3] border border-[#e9e9e7] rounded-md shadow-xs text-[#1a202c] cursor-pointer"><Search className="h-4 w-4" /></button>
                    </div>
                    {errorMessage && <span className="text-[10px] text-red-500 font-medium block mt-1">{errorMessage}</span>}
                  </div>

                  <form onSubmit={handleAddWalkIn} className="space-y-4 pt-4 border-t border-[#e9e9e7]">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Patient Name *</label>
                      <input type="text" required placeholder="Full Name" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Phone *</label>
                        <input type="text" required placeholder="Phone" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Age</label>
                        <input type="number" placeholder="Age" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Urgency</label>
                        <select className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-xs" value={urgencyType} onChange={(e) => setUrgencyType(e.target.value)}>
                          <option value="GENERAL">General</option>
                          <option value="PRIORITY">Priority</option>
                          <option value="EMERGENCY">Emergency</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Visit</label>
                        <select className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-xs" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                          <option value="NEW">New</option>
                          <option value="FOLLOW_UP">Follow-up</option>
                        </select>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="flex justify-between items-end mb-1">
                        <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Complaint</label>
                        <VoiceDictation 
                          onResult={(text) => setChiefComplaint(prev => prev ? `${prev} ${text}` : text)} 
                        />
                      </div>
                      <textarea placeholder="Optional notes" rows={2} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner resize-none" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-[#01696f] text-white text-sm font-bold rounded-md shadow-md hover:bg-[#005459] transition-colors cursor-pointer flex items-center justify-center gap-2">
                      <Printer className="h-4 w-4" /> Issue Token
                    </button>
                  </form>
                </div>
              </div>

              {/* Active Queue */}
              <div className="lg:col-span-2 bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1a202c]">Active Waitlist</h2>
                  <span className="text-xs font-bold bg-[#e6f3f4] text-[#01696f] px-3 py-1 rounded-full shadow-xs">
                    {activeQueue.length} Waiting
                  </span>
                </div>
                
                {activeQueue.length === 0 ? (
                  <div className="py-24 text-center text-sm text-[#64748b] font-medium">
                    No patients waiting in queue.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-[10px] uppercase font-bold text-[#64748b] tracking-wider">
                        <tr>
                          <th className="px-5 py-3">Order</th>
                          <th className="px-5 py-3">Token</th>
                          <th className="px-5 py-3">Patient</th>
                          <th className="px-5 py-3">Urgency</th>
                          <th className="px-5 py-3">ETA</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e9e9e7]">
                        {activeQueue.map((token, idx) => (
                          <tr key={token.id} className={`hover:bg-[#fbfbfa] transition-colors ${token.status === 'IN_CONSULTATION' ? 'bg-[#e6f3f4]/30' : ''}`}>
                            <td className="px-5 py-4 flex items-center gap-2">
                              <div className="flex flex-col gap-1">
                                <button onClick={() => handleNudge(idx, 'UP')} disabled={idx === 0} className="text-[#64748b] hover:text-[#01696f] disabled:opacity-30"><MoveUp className="h-3 w-3" /></button>
                                <button onClick={() => handleNudge(idx, 'DOWN')} disabled={idx === activeQueue.length - 1} className="text-[#64748b] hover:text-[#01696f] disabled:opacity-30"><MoveDown className="h-3 w-3" /></button>
                              </div>
                              <span className="font-bold text-[#1a202c]">{idx + 1}</span>
                            </td>
                            <td className="px-5 py-4 font-bold text-[#01696f]">{token.tokenNo}</td>
                            <td className="px-5 py-4">
                              <div className="font-semibold text-[#1a202c]">{token.patientName}</div>
                              <div className="text-[10px] text-[#64748b] mt-0.5">{token.patientPhone}</div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2 py-1 text-[9px] uppercase font-bold rounded shadow-xs border ${token.type === 'EMERGENCY' ? 'bg-red-50 text-red-700 border-red-200' : token.type === 'PRIORITY' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                {token.type}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`px-2 py-1 text-[10px] font-bold rounded border ${getUrgencyBadge(token.estimatedWait)}`}>
                                {token.status === 'IN_CONSULTATION' ? 'Serving' : `${token.estimatedWait}m`}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${token.status === 'IN_CONSULTATION' ? 'text-[#01696f]' : 'text-[#64748b]'}`}>
                                {token.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setPrintToken(token); setTimeout(() => window.print(), 200); }} className="p-1.5 border border-[#e9e9e7] bg-white rounded shadow-xs hover:bg-[#f4f4f3] text-[#1a202c]" title="Print Slip"><Printer className="h-3.5 w-3.5" /></button>
                                <button onClick={() => recallToken(branchId, token.tokenNo, 'Doctor')} className="px-2 py-1.5 bg-white hover:bg-[#f4f4f3] border border-[#e9e9e7] rounded text-[10px] font-bold text-[#1a202c] shadow-xs">Re-call TV</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* PATIENTS TAB */}
          {activeTab === 'Patients' && (
            <div className="p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex justify-between items-center">
                  <h2 className="font-semibold text-lg text-[#1a202c]">Patient Records</h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
                    <input type="text" placeholder="Search records..." className="w-full pl-10 pr-3 py-1.5 border border-[#e9e9e7] rounded text-sm outline-none focus:border-[#01696f]" />
                  </div>
                </div>
                <div className="p-16 text-center">
                  <Users className="h-12 w-12 text-[#e9e9e7] mx-auto mb-3" />
                  <h3 className="font-medium text-[#1a202c]">No records found</h3>
                  <p className="text-sm text-[#64748b] mt-1">Use the dashboard to generate a token for new patients.</p>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'Settings' && (
            <div className="p-8 max-w-4xl mx-auto w-full animate-in fade-in duration-300 space-y-6">
              <div className="mb-6">
                <h1 className="text-2xl font-serif font-bold text-[#1a202c]">Clinic Settings</h1>
                <p className="text-[#64748b] mt-1 text-sm">Manage queue preferences and operational details.</p>
              </div>

              {/* Queue Settings */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                  <h2 className="font-bold text-[#1a202c]">Queue & Waitlist Preferences</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-[#e9e9e7] border-dashed">
                    <div>
                      <h4 className="text-sm font-bold text-[#1a202c]">Smart ETA Calculation</h4>
                      <p className="text-xs text-[#64748b] mt-1">Use AI to dynamically calculate wait times based on historical data.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#01696f]"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between pb-4 border-b border-[#e9e9e7] border-dashed">
                    <div>
                      <h4 className="text-sm font-bold text-[#1a202c]">Auto-Skip No-Shows</h4>
                      <p className="text-xs text-[#64748b] mt-1">Automatically mark patients as no-show if they miss their turn.</p>
                    </div>
                    <select className="px-3 py-1.5 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-xs">
                      <option>After 5 minutes</option>
                      <option>After 10 minutes</option>
                      <option>After 15 minutes</option>
                      <option>Do not auto-skip</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#1a202c]">Daily Token Limit</h4>
                      <p className="text-xs text-[#64748b] mt-1">Maximum number of walk-in tokens allowed per day.</p>
                    </div>
                    <input type="number" defaultValue={200} className="w-24 px-3 py-1.5 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-xs" />
                  </div>
                </div>
              </div>

              {/* Doctors List */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex justify-between items-center">
                  <h2 className="font-bold text-[#1a202c]">Onboarded Doctors</h2>
                  <button className="text-xs text-[#01696f] font-bold hover:underline">Add Doctor</button>
                </div>
                <div className="p-0">
                  {doctorsList.map((doc, idx) => (
                    <div key={idx} className="px-6 py-4 border-b border-[#e9e9e7] last:border-0 flex justify-between items-center hover:bg-[#fbfbfa]">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-[#e6f3f4] text-[#01696f] rounded-full flex items-center justify-center font-bold">
                          {doc.user?.name ? doc.user.name.charAt(0) : 'D'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1a202c]">{doc.user?.name || 'Doctor'}</p>
                          <p className="text-xs text-[#64748b] mt-0.5">{doc.speciality}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1.5 border border-[#e9e9e7] bg-white rounded text-xs font-semibold hover:bg-[#f4f4f3]">Manage Schedule</button>
                    </div>
                  ))}
                  {doctorsList.length === 0 && (
                     <div className="p-6 text-sm text-[#64748b] text-center">No doctors found.</div>
                  )}
                </div>
              </div>

            </div>
          )}
          </>
        )}
      </main>

      {/* Hidden print area */}
      {printToken && (
        <div className="print-area hidden flex-col items-center text-center p-6 border border-black font-sans bg-white text-black" style={{ maxWidth: '105mm' }}>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#01696f]">CUREQ TOKEN SLIP</h2>
          <span className="text-[10px] uppercase text-gray-500 font-bold">Live Queue Pass</span>
          <hr className="w-full border-dashed border-gray-400 my-4" />
          
          <div className="my-6">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Token Number</span>
            <span className="text-5xl font-mono font-bold tracking-tighter text-[#1a202c] my-2 block">{printToken.tokenNo}</span>
          </div>

          <div className="space-y-1.5 text-xs text-left w-full border-t border-b border-gray-300 py-3 my-4">
            <p><strong>Patient:</strong> {printToken.patientName}</p>
            <p><strong>Urgency:</strong> {printToken.type}</p>
            <p><strong>Estimated Wait:</strong> ~{printToken.estimatedWait} minutes</p>
            <p><strong>Check-in Time:</strong> {new Date(printToken.checkInTime).toLocaleString()}</p>
          </div>

          {/* Dynamic QR Code for Live Tracking */}
          <div className="my-4 flex justify-center">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/queue/${printToken.id}`)}`} 
              alt="Scan to track queue" 
              className="w-24 h-24 border-2 border-gray-200 rounded p-1"
            />
          </div>

          <p className="text-[10px] text-gray-500 mt-2 leading-relaxed font-medium">
            Scan the QR code to track your token live from your mobile browser.
          </p>
        </div>
      )}

      {/* Logs Drawer */}
      {isLogsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl p-6 relative border-l border-[#e9e9e7] animate-in slide-in-from-right duration-300">
            <button onClick={() => setIsLogsOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b]">
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-serif text-xl font-bold tracking-tight flex items-center gap-2 text-[#01696f] mb-6">
              <Mail className="h-5 w-5" /> Live SMS Logs
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {notificationLogs.length === 0 ? (
                <div className="py-20 text-center text-sm text-[#64748b] font-medium">No notifications triggered yet.</div>
              ) : (
                notificationLogs.map(log => (
                  <div key={log.id} className="p-4 border border-[#e9e9e7] bg-[#fbfbfa] rounded-xl shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#01696f] uppercase tracking-wider">{log.channel} Alert</span>
                      <span className="text-[10px] text-[#64748b] font-semibold">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm font-medium text-[#1a202c]">
                      <strong>To:</strong> {log.phone} <br />
                      <span className="text-xs text-[#64748b] mt-1 block">"{log.message}"</span>
                    </p>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-bold uppercase inline-block">
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
