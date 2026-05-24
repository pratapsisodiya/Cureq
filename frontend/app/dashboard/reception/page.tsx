'use client';

import React, { useState, useEffect } from 'react';
import { useQueueStore, TokenItem } from '../../../src/store/useQueueStore';
import { apiRequest } from '../../../src/utils/api';
import VoiceDictation from '../../../src/components/VoiceDictation';
import { useToast } from '../../../src/components/Toast';
import {
  Users, Activity, CheckCircle, AlertTriangle,
  Search, Printer, MoveUp, MoveDown, Mail, Bell, X, UserPlus,
  LayoutDashboard, Settings, Plus, Trash, ArrowRight, ArrowLeft, LogOut, Calendar, Clock, Timer, Coffee
} from 'lucide-react';

const SPECIALITIES_LIST = [
  'General Physician', 'Dentist', 'ENT Specialist', 'Dermatologist',
  'Ophthalmologist', 'Gynecologist', 'Orthopedic Surgeon', 'Pediatrician'
];

export default function ReceptionDashboard() {
  const {
    activeQueue, servedToday, skippedToday, noShowToday,
    fetchQueue, initSocket, disconnectSocket, reorderQueue, recallToken, updateSeatsCapacity,
    doctorBreakStatus
  } = useQueueStore();

  const { showToast, ToastComponent } = useToast();

  const [waitingSeats, setWaitingSeats] = useState(10);

  const [clinicId, setClinicId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);
  
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
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // Patient records
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [historyPatientName, setHistoryPatientName] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // All Queues tab
  const [allQueues, setAllQueues] = useState<Record<string, any[]>>({});
  const [isLoadingAllQueues, setIsLoadingAllQueues] = useState(false);

  // Waitlist tab
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [waitlistDate, setWaitlistDate] = useState(new Date().toISOString().split('T')[0]);

  // Add Doctor modal
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorPassword, setNewDoctorPassword] = useState('DoctorCureQ123!');
  const [newDoctorPhone, setNewDoctorPhone] = useState('');
  const [newDoctorSpeciality, setNewDoctorSpeciality] = useState('General Physician');
  const [newDoctorDays, setNewDoctorDays] = useState([1,2,3,4,5]);
  const [newDoctorStart, setNewDoctorStart] = useState('09:00');
  const [newDoctorEnd, setNewDoctorEnd] = useState('17:00');
  const [isAddingDoctor, setIsAddingDoctor] = useState(false);

  // Manage Schedule modal
  const [isManageScheduleOpen, setIsManageScheduleOpen] = useState(false);
  const [scheduleDoctor, setScheduleDoctor] = useState<any>(null);
  const [managedSchedules, setManagedSchedules] = useState<any[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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

  // Parse query param tab on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);

  const fetchDoctors = async (cId: string) => {
    try {
      const res = await apiRequest(`/clinics/${cId}`);
      const branch = res.clinic?.branches?.[0];
      if (branch) {
        setWaitingSeats(branch.waitingSeats || 10);
      }
      const schedules = branch?.schedules || [];
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

      // Fetch all queue sizes in background for the custom selector
      if (branch?.id && docs.length > 0) {
        const result: Record<string, any[]> = {};
        for (const doc of docs) {
          try {
            const data = await apiRequest(`/queues/${branch.id}/live?doctorId=${doc.id}`);
            result[doc.id] = data.active || [];
          } catch {
            result[doc.id] = [];
          }
        }
        setAllQueues(result);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSeats = async (newCapacity: number) => {
    if (newCapacity < 1) return;
    try {
      await updateSeatsCapacity(clinicId, branchId, newCapacity);
      setWaitingSeats(newCapacity);
    } catch (err) {
      console.error('Failed to update waiting room seats', err);
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

  // Load patients when switching to Patients tab
  useEffect(() => {
    if (activeTab === 'Patients' && patientsList.length === 0) {
      fetchPatients();
    }
  }, [activeTab]);

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
    if (!/^\d{10}$/.test(searchPhone)) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }
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
      setErrorMessage('No existing record found — creating new patient profile.');
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

  const fetchPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const res = await apiRequest('/patients');
      setPatientsList(res.patients || []);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const handleViewHistory = async (patientId: string, name: string) => {
    setHistoryPatientName(name);
    setIsHistoryOpen(true);
    setPatientHistory([]);
    try {
      const res = await apiRequest(`/patients/id/${patientId}/history`);
      setPatientHistory(res.history || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() || !branchId) return;
    setIsBroadcasting(true);
    try {
      await apiRequest('/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ branchId, message: broadcastMsg }),
      });
      setBroadcastMsg('');
      showToast('Broadcast sent to all waiting patients.', 'success');
    } catch (err) {
      console.error('Broadcast failed', err);
      showToast('Failed to send broadcast.', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !branchId) return;
    setIsAddingDoctor(true);
    try {
      const schedules = newDoctorDays.map(day => ({
        dayOfWeek: day,
        startTime: newDoctorStart,
        endTime: newDoctorEnd,
        slotDuration: 15,
        maxPatients: 30,
        bufferTime: 5,
      }));
      await apiRequest(`/clinics/${clinicId}/doctors`, {
        method: 'POST',
        body: JSON.stringify({
          name: newDoctorName,
          email: newDoctorEmail,
          password: newDoctorPassword,
          phone: newDoctorPhone || undefined,
          speciality: newDoctorSpeciality,
          branchId,
          schedules,
        }),
      });
      setIsAddDoctorOpen(false);
      setNewDoctorName(''); setNewDoctorEmail(''); setNewDoctorPhone('');
      setNewDoctorPassword('DoctorCureQ123!');
      showToast('Doctor added successfully!', 'success');
      // Refresh doctors list
      const res = await apiRequest(`/clinics/${clinicId}`);
      const branch = res.clinic?.branches?.find((b: any) => b.id === branchId);
      if (branch?.schedules) {
        const unique = new Map();
        branch.schedules.forEach((s: any) => { if (!unique.has(s.doctor.id)) unique.set(s.doctor.id, s.doctor); });
        setDoctorsList(Array.from(unique.values()));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add doctor.', 'error');
    } finally {
      setIsAddingDoctor(false);
    }
  };

  const openManageSchedule = (doctor: any) => {
    setScheduleDoctor(doctor);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    setManagedSchedules(days.map((label, i) => {
      const existing = doctor.schedules?.find((s: any) => s.dayOfWeek === i);
      return {
        dayOfWeek: i,
        label,
        active: existing ? existing.active : (i >= 1 && i <= 5),
        startTime: existing?.startTime || '09:00',
        endTime: existing?.endTime || '17:00',
        slotDuration: existing?.slotDuration || 15,
        maxPatients: existing?.maxPatients || 30,
        bufferTime: existing?.bufferTime || 5,
      };
    }));
    setIsManageScheduleOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!clinicId || !branchId || !scheduleDoctor) return;
    setIsSavingSchedule(true);
    try {
      await apiRequest(`/clinics/${clinicId}/doctors/${scheduleDoctor.id}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({
          branchId,
          schedules: managedSchedules.filter(s => s.active),
        }),
      });
      setIsManageScheduleOpen(false);
      showToast('Schedule updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save schedule.', 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleOpenLogs = async () => {
    setIsLogsOpen(true);
    if (!branchId) return;
    setIsLoadingLogs(true);
    try {
      const res = await apiRequest(`/notifications/${branchId}`);
      setNotificationLogs(res.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchAllQueues = async () => {
    if (!branchId || doctorsList.length === 0) return;
    setIsLoadingAllQueues(true);
    const result: Record<string, any[]> = {};
    for (const doc of doctorsList) {
      try {
        const data = await apiRequest(`/queues/${branchId}/live?doctorId=${doc.id}`);
        result[doc.id] = data.active || [];
      } catch { result[doc.id] = []; }
    }
    setAllQueues(result);
    setIsLoadingAllQueues(false);
  };

  const fetchWaitlist = async () => {
    if (!clinicId) return;
    setIsLoadingWaitlist(true);
    try {
      const res = await apiRequest(`/features/clinics/${clinicId}/waitlist?date=${waitlistDate}`);
      setWaitlistEntries(res.entries || []);
    } catch { /* ignore */ } finally { setIsLoadingWaitlist(false); }
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
            <button onClick={() => { setActiveTab('All Queues'); fetchAllQueues(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${activeTab === 'All Queues' ? 'bg-[#f4f4f3] text-[#01696f]' : 'text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]'}`}>
              <Activity className="h-4 w-4" /> All Queues
            </button>
            <button onClick={() => { setActiveTab('Waitlist'); fetchWaitlist(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors cursor-pointer ${activeTab === 'Waitlist' ? 'bg-[#f4f4f3] text-[#01696f]' : 'text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]'}`}>
              <Calendar className="h-4 w-4" /> Waitlist
            </button>
            <div className="pt-2 border-t border-[#e9e9e7] mt-2">
              <a href="/dashboard/analytics" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#01696f]">
                <Activity className="h-4 w-4" /> Analytics
              </a>
              <a href="/dashboard/doctor" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]">
                <Users className="h-4 w-4" /> Doctor Console
              </a>
              <a href="/patient/portal" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]">
                <Search className="h-4 w-4" /> Patient Portal
              </a>
              {clinicId && (
                <a href={`/waitlist/${clinicId}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c]">
                  <Calendar className="h-4 w-4" /> Pre-Register (Public)
                </a>
              )}
            </div>
          </nav>
          <div className="p-4 border-t border-[#e9e9e7]">
            <button
              onClick={() => {
                if (confirm('Sign out and clear session?')) {
                  localStorage.removeItem('cureq_token');
                  localStorage.removeItem('cureq_role');
                  localStorage.removeItem('cureq_clinic_id');
                  localStorage.removeItem('cureq_branch_id');
                  localStorage.removeItem('cureq_active_doctor_id');
                  window.location.href = '/login';
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer mb-3"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
                  className="flex items-center gap-2.5 px-4 py-2 border border-[#e9e9e7] rounded-lg bg-[#fbfbfa] hover:bg-[#f4f4f3] text-sm font-semibold text-[#1a202c] shadow-xs cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#01696f]/20"
                  aria-haspopup="listbox"
                  aria-expanded={isDocDropdownOpen}
                  aria-label="Select Doctor Queue"
                >
                  <span className="h-5 w-5 rounded-full bg-[#e6f3f4] text-[#01696f] text-xs font-bold flex items-center justify-center">
                    {doctorsList.find(d => d.id === selectedDoctorId)?.user?.name?.charAt(0) || 'D'}
                  </span>
                  <span>
                    {doctorsList.find(d => d.id === selectedDoctorId)?.user?.name ? `Queue for Dr. ${doctorsList.find(d => d.id === selectedDoctorId)?.user?.name}` : 'Select Doctor...'}
                  </span>
                  <svg className={`h-4 w-4 text-[#64748b] transition-transform duration-200 ${isDocDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDocDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsDocDropdownOpen(false)}></div>
                    <ul
                      className="absolute left-0 mt-2 w-72 bg-white border border-[#e9e9e7] rounded-xl shadow-xl z-40 py-1.5 focus:outline-none animate-in fade-in slide-in-from-top-2 duration-200"
                      role="listbox"
                    >
                      {doctorsList.length > 0 ? (
                        doctorsList.map((doc) => {
                          const isSelected = doc.id === selectedDoctorId;
                          const onBreak = doctorBreakStatus[doc.id];
                          const queueCount = allQueues[doc.id]?.length || 0;

                          return (
                            <li
                              key={doc.id}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedDoctorId(doc.id);
                                setIsDocDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-4 py-2.5 hover:bg-[#fbfbfa] cursor-pointer transition-colors ${
                                isSelected ? 'bg-[#e6f3f4]/30 text-[#01696f]' : 'text-[#1a202c]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  isSelected ? 'bg-[#01696f] text-white' : 'bg-[#e6f3f4] text-[#01696f]'
                                }`}>
                                  {doc.user?.name?.charAt(0) || 'D'}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-[#1a202c]">Dr. {doc.user?.name}</p>
                                  <p className="text-[9px] text-[#64748b] font-medium">{doc.speciality}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {onBreak && (
                                  <span className="flex items-center px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-[9px] font-bold text-amber-700">
                                    Break
                                  </span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  queueCount > 0 ? 'bg-gray-100 text-gray-700' : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {queueCount > 0 ? `${queueCount} waiting` : 'Empty'}
                                </span>
                              </div>
                            </li>
                          );
                        })
                      ) : (
                        <li className="px-4 py-2 text-xs text-[#64748b] italic">No doctors available</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
              {selectedDoctorId && doctorBreakStatus[selectedDoctorId] && (
                <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-semibold text-amber-700">
                  <Coffee className="h-3 w-3" /> On Break
                  {doctorBreakStatus[selectedDoctorId].resumeAt && ` · ~${doctorBreakStatus[selectedDoctorId].resumeAt}`}
                </span>
              )}
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

              <div className="mb-4 p-3 bg-[#f4f4f3] rounded-md text-xs text-[#64748b] text-center border border-[#e9e9e7]">
                Already have an account?{' '}
                <a href="/login" className="text-[#01696f] font-semibold hover:underline">Sign in here</a>
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
                          <label className="block text-[10px] font-bold text-[#64748b] uppercase">Doctor Name *</label>
                          <input type="text" required placeholder="Dr. Sharma" className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.name} onChange={(e) => handleDoctorChange(docIdx, 'name', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748b] uppercase">Speciality *</label>
                          <select className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.speciality} onChange={(e) => handleDoctorChange(docIdx, 'speciality', e.target.value)}>
                            <option value="">Choose...</option>
                            {selectedSpecialities.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748b] uppercase">Email *</label>
                          <input type="email" required placeholder="dr@clinic.com" className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.email} onChange={(e) => handleDoctorChange(docIdx, 'email', e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#64748b] uppercase">Phone</label>
                          <input type="text" placeholder="9876543210" className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md outline-none text-sm shadow-xs" value={doc.phone} onChange={(e) => handleDoctorChange(docIdx, 'phone', e.target.value)} />
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

            {/* Queue Clearance ETA Bar */}
            {(() => {
              const waitingCount = activeQueue.filter(t => t.status === 'WAITING').length;
              const avgSlot = 15; // minutes per patient
              const etaMins = waitingCount * avgSlot;
              const clearTime = new Date(Date.now() + etaMins * 60 * 1000);
              const clearTimeStr = clearTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const urgency = etaMins <= 30 ? 'green' : etaMins <= 60 ? 'amber' : 'red';
              const inConsult = activeQueue.find(t => t.status === 'IN_CONSULTATION');
              return waitingCount > 0 ? (
                <div className={`flex items-center gap-4 px-5 py-3 rounded-xl border text-sm font-medium ${
                  urgency === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  urgency === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                  'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{waitingCount}</strong> patient{waitingCount !== 1 ? 's' : ''} waiting
                    {inConsult && <> · Now serving <strong>{inConsult.tokenNo}</strong> ({inConsult.patientName})</>}
                  </span>
                  <span className="ml-auto font-bold flex items-center gap-1.5">
                    Queue clears ~{clearTimeStr}
                    <span className={`h-2 w-2 rounded-full ${urgency === 'green' ? 'bg-emerald-500' : urgency === 'amber' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}></span>
                  </span>
                </div>
              ) : null;
            })()}

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
                      <textarea placeholder="Optional notes" rows={2} maxLength={300} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md text-sm outline-none focus:border-[#01696f] shadow-inner resize-none" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
                      <span className="text-[10px] text-[#64748b] block text-right mt-0.5">{chiefComplaint.length}/300</span>
                    </div>

                    {/* Capacity Indicator Helper */}
                    {(() => {
                      const currentSeatedCount = activeQueue.filter(t => t.status === 'WAITING' && t.seatStatus === 'SEATED').length;
                      const hasSeat = currentSeatedCount < waitingSeats;
                      return (
                        <div className={`p-2.5 rounded border text-xs font-semibold flex items-center justify-between ${
                          hasSeat 
                            ? 'bg-[#e6f3f4]/40 border-[#01696f]/20 text-[#01696f]' 
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          <span>Next Token Seat:</span>
                          <span className="font-bold flex items-center gap-1">
                            <span className={`h-2.5 w-2.5 rounded-full ${hasSeat ? 'bg-[#01696f]' : 'bg-amber-500 animate-pulse'}`}></span>
                            {hasSeat ? 'Physical Seat Available' : 'Virtual Queue (Wait Outside)'}
                          </span>
                        </div>
                      );
                    })()}

                    <button type="submit" className="w-full py-2.5 bg-[#01696f] text-white text-sm font-bold rounded-md shadow-md hover:bg-[#005459] transition-colors cursor-pointer flex items-center justify-center gap-2">
                      <Printer className="h-4 w-4" /> Issue Token
                    </button>
                  </form>
                </div>
              </div>

              {/* Waiting Room Seats Manager */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden h-fit">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1a202c] flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#01696f]" /> Waiting Room Seats
                  </h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleUpdateSeats(waitingSeats - 1)}
                      disabled={waitingSeats <= 1}
                      className="w-6 h-6 border border-[#e9e9e7] rounded bg-white hover:bg-[#f4f4f3] disabled:opacity-50 font-bold text-xs text-[#1a202c] cursor-pointer shadow-xs flex items-center justify-center"
                      title="Decrease seats capacity"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-[#1a202c]">{waitingSeats} Seats</span>
                    <button 
                      onClick={() => handleUpdateSeats(waitingSeats + 1)}
                      className="w-6 h-6 border border-[#e9e9e7] rounded bg-white hover:bg-[#f4f4f3] font-bold text-xs text-[#1a202c] cursor-pointer shadow-xs flex items-center justify-center"
                      title="Increase seats capacity"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {/* Grid of physical seats */}
                  <div className="grid grid-cols-5 gap-3">
                    {Array.from({ length: waitingSeats }).map((_, idx) => {
                      const seatedPatients = activeQueue.filter(t => t.status === 'WAITING' && t.seatStatus === 'SEATED');
                      const isOccupied = idx < seatedPatients.length;
                      const patient = isOccupied ? seatedPatients[idx] : null;

                      return (
                        <div 
                          key={idx} 
                          className={`aspect-square rounded-lg border flex flex-col items-center justify-center p-2 relative group transition-all duration-200 ${
                            isOccupied 
                              ? 'bg-[#e6f3f4] border-[#01696f]/40 text-[#01696f] shadow-xs' 
                              : 'bg-[#fbfbfa] border-[#e9e9e7] text-gray-300'
                          }`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 10V17M17 10V17M5 20H19M5 17H19M7 5H17M7 10H17" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span className="text-[9px] mt-1 font-bold">
                            {isOccupied && patient ? patient.tokenNo : `Seat ${idx + 1}`}
                          </span>
                          
                          {/* Tooltip on hover */}
                          {isOccupied && patient && (
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 bg-gray-900 text-white text-[10px] p-2 rounded shadow-md w-32 text-center left-1/2 -translate-x-1/2">
                              <p className="font-bold">{patient.patientName}</p>
                              <p className="text-[8px] text-gray-300">Wait: {patient.estimatedWait}m</p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Virtual Queue / Waiting Outside stats */}
                  {(() => {
                    const outsidePatients = activeQueue.filter(t => t.status === 'WAITING' && t.seatStatus === 'WAITING_OUTSIDE');
                    const seatedCount = activeQueue.filter(t => t.status === 'WAITING' && t.seatStatus === 'SEATED').length;
                    return (
                      <div className="mt-6 pt-4 border-t border-[#e9e9e7]">
                        <div className="flex justify-between text-xs font-semibold text-[#64748b] mb-2">
                          <span>Seated Patients: {seatedCount}/{waitingSeats}</span>
                          <span>Waiting Outside: {outsidePatients.length}</span>
                        </div>
                        {outsidePatients.length > 0 ? (
                          <div className="space-y-2 mt-2">
                            <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block animate-pulse"></span> Virtual Waitlist (Waiting Outside)
                            </h4>
                            <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                              {outsidePatients.map(patient => (
                                <div key={patient.id} className="flex justify-between items-center text-[11px] p-2 bg-amber-50/50 border border-amber-100 rounded-md">
                                  <div>
                                    <span className="font-bold text-[#1a202c]">{patient.patientName}</span>
                                    <span className="text-[9px] text-gray-500 ml-1">({patient.tokenNo})</span>
                                  </div>
                                  <span className="font-bold text-amber-700">{patient.estimatedWait}m wait</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-500 italic mt-1">No patients waiting outside. Everyone is seated.</p>
                        )}
                      </div>
                    );
                  })()}
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
                          <th className="px-5 py-3">Seat</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-3 py-3">Fee (₹)</th>
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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-[#64748b]">{token.patientPhone}</span>
                                {token.appointmentId
                                  ? <span className="text-[8px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded font-bold uppercase">Booked</span>
                                  : <span className="text-[8px] bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded font-bold uppercase">Walk-in</span>
                                }
                              </div>
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
                              <span className={`px-2 py-1 text-[9px] uppercase font-bold rounded shadow-xs border ${
                                token.status === 'IN_CONSULTATION' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : token.seatStatus === 'SEATED' 
                                    ? 'bg-[#e6f3f4] text-[#01696f] border-[#01696f]/20' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {token.status === 'IN_CONSULTATION' ? 'Chamber' : token.seatStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${token.status === 'IN_CONSULTATION' ? 'text-[#01696f]' : 'text-[#64748b]'}`}>
                                {token.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                placeholder="0"
                                defaultValue={token.consultationFee || ''}
                                onBlur={async (e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0) {
                                    try {
                                      await apiRequest(`/features/tokens/${token.id}/fee`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ fee: val }),
                                      });
                                    } catch { /* ignore */ }
                                  }
                                }}
                                className="w-20 px-2 py-1 text-xs border border-[#e9e9e7] rounded focus:outline-none focus:border-[#01696f] bg-white"
                              />
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
                  <h2 className="font-semibold text-lg text-[#1a202c]">Patient Records
                    <span className="ml-2 text-xs font-bold text-[#64748b] bg-[#f4f4f3] px-2 py-0.5 rounded-full">{patientsList.length}</span>
                  </h2>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
                    <input type="text" placeholder="Search name or phone..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} className="w-full pl-10 pr-3 py-1.5 border border-[#e9e9e7] rounded text-sm outline-none focus:border-[#01696f]" />
                  </div>
                </div>
                {isLoadingPatients ? (
                  <div className="p-6 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 animate-pulse">
                        <div className="h-4 bg-[#e9e9e7] rounded w-1/4"></div>
                        <div className="h-4 bg-[#e9e9e7] rounded w-1/6"></div>
                        <div className="h-4 bg-[#e9e9e7] rounded w-1/12"></div>
                        <div className="h-4 bg-[#e9e9e7] rounded w-1/6"></div>
                        <div className="h-4 bg-[#e9e9e7] rounded w-1/6 ml-auto"></div>
                      </div>
                    ))}
                  </div>
                ) : patientsList.length === 0 ? (
                  <div className="p-16 text-center">
                    <Users className="h-12 w-12 text-[#e9e9e7] mx-auto mb-3" />
                    <h3 className="font-medium text-[#1a202c]">No patients yet</h3>
                    <p className="text-sm text-[#64748b] mt-1">Patients will appear here after their first visit.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-[10px] uppercase font-bold text-[#64748b] tracking-wider">
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
                          const q = patientSearch.toLowerCase();
                          return !q || (p.name || '').toLowerCase().includes(q) || (p.phone || '').includes(q);
                        }).map((p) => (
                          <tr key={p.id} className="hover:bg-[#fbfbfa] transition-colors">
                            <td className="px-6 py-4 font-semibold text-[#1a202c]">{p.name}</td>
                            <td className="px-6 py-4 text-[#64748b]">{p.phone}</td>
                            <td className="px-6 py-4">{p.age ? `${p.age} yrs` : '—'}</td>
                            <td className="px-6 py-4 capitalize">{p.gender || '—'}</td>
                            <td className="px-6 py-4 uppercase font-medium">{p.bloodGroup || '—'}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleViewHistory(p.id, p.name)}
                                className="text-xs font-semibold text-[#01696f] hover:underline bg-[#e6f3f4] px-2.5 py-1.5 rounded shadow-xs border border-[#01696f]/20 cursor-pointer"
                              >
                                View History
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ALL QUEUES TAB */}
          {activeTab === 'All Queues' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-[#1a202c] text-lg">All Doctor Queues</h2>
                <button onClick={fetchAllQueues} disabled={isLoadingAllQueues}
                  className="text-xs font-semibold text-[#01696f] border border-[#01696f]/30 px-3 py-1.5 rounded hover:bg-[#e6f3f4] cursor-pointer disabled:opacity-50">
                  {isLoadingAllQueues ? 'Refreshing...' : 'Refresh All'}
                </button>
              </div>
              {isLoadingAllQueues ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {doctorsList.map((doc: any) => (
                    <div key={doc.id} className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-4 animate-pulse h-40" />
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {doctorsList.map((doc: any) => {
                    const queue = allQueues[doc.id] || [];
                    const serving = queue.find((t: any) => t.status === 'IN_CONSULTATION');
                    const waiting = queue.filter((t: any) => t.status === 'WAITING');
                    return (
                      <div key={doc.id} className="bg-white border border-[#e9e9e7] rounded-lg p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm text-[#1a202c]">Dr. {doc.user?.name}</p>
                            <p className="text-[10px] text-[#64748b]">{doc.speciality}</p>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${serving ? 'bg-[#e6f3f4] text-[#01696f]' : 'bg-gray-100 text-gray-500'}`}>
                            {serving ? 'Active' : 'Idle'}
                          </span>
                        </div>
                        {serving && (
                          <div className="bg-[#e6f3f4] border border-[#01696f]/20 p-2 rounded text-xs">
                            <span className="text-[10px] text-[#64748b] font-semibold block">Now Serving</span>
                            <span className="font-mono font-bold text-[#01696f] text-base">{serving.tokenNo}</span>
                            <span className="text-[#64748b] ml-2">{serving.patientName}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#64748b]">{waiting.length} waiting</span>
                          <button onClick={() => { setSelectedDoctorId(doc.id); setActiveTab('Dashboard'); }}
                            className="text-[10px] text-[#01696f] font-semibold hover:underline cursor-pointer">
                            View Queue →
                          </button>
                        </div>
                        {waiting.slice(0, 3).map((t: any, i: number) => (
                          <div key={t.id} className="flex items-center gap-2 py-1 border-t border-[#e9e9e7] text-xs">
                            <span className="text-[#64748b] font-mono w-6">#{i+1}</span>
                            <span className="font-mono font-semibold text-[#1a202c]">{t.tokenNo}</span>
                            <span className="text-[#64748b] truncate">{t.patientName}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WAITLIST TAB */}
          {activeTab === 'Waitlist' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#1a202c] text-lg">Pre-Registered Patients</h2>
                <div className="flex items-center gap-3">
                  <input type="date" value={waitlistDate} onChange={e => setWaitlistDate(e.target.value)}
                    className="px-3 py-1.5 border border-[#e9e9e7] rounded-md text-xs focus:outline-none focus:border-[#01696f]" />
                  <button onClick={fetchWaitlist} disabled={isLoadingWaitlist}
                    className="text-xs font-semibold text-[#01696f] border border-[#01696f]/30 px-3 py-1.5 rounded hover:bg-[#e6f3f4] cursor-pointer">
                    Load
                  </button>
                </div>
              </div>
              {isLoadingWaitlist ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-[#f4f4f3] rounded animate-pulse" />)}</div>
              ) : waitlistEntries.length === 0 ? (
                <p className="text-sm text-[#64748b] text-center py-10">No pre-registrations for this date.</p>
              ) : (
                <div className="space-y-2">
                  {waitlistEntries.map((entry: any) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 bg-white border border-[#e9e9e7] rounded-lg shadow-xs">
                      <div>
                        <p className="font-bold text-sm text-[#1a202c]">{entry.patientName}</p>
                        <p className="text-xs text-[#64748b]">{entry.patientPhone} · Dr. {entry.doctor?.user?.name} · {entry.targetDate}</p>
                        {entry.chiefComplaint && <p className="text-[10px] text-[#64748b] mt-0.5 italic">{entry.chiefComplaint}</p>}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await apiRequest(`/features/waitlist/${entry.id}/convert`, { method: 'POST' });
                            setWaitlistEntries(prev => prev.filter(e => e.id !== entry.id));
                            showToast('Converted — add patient to queue manually.', 'success');
                          } catch { showToast('Failed to convert.', 'error'); }
                        }}
                        className="text-xs font-bold text-white bg-[#01696f] px-3 py-1.5 rounded hover:bg-[#005459] cursor-pointer">
                        Add to Queue
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'Settings' && (
            <div className="p-8 max-w-4xl mx-auto w-full animate-in fade-in duration-300 space-y-6">
              <div className="mb-6">
                <h1 className="text-2xl font-serif font-bold text-[#1a202c]">Clinic Settings</h1>
                <p className="text-[#64748b] mt-1 text-sm">Manage queue preferences and operational details.</p>
              </div>

              {/* Broadcast Alert */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                  <h2 className="font-bold text-[#1a202c] flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#01696f]" /> Broadcast Alert to Waiting Patients
                  </h2>
                </div>
                <div className="p-6 flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Doctor will be available in 15 minutes. Thank you for your patience."
                    className="flex-1 px-3 py-2 border border-[#e9e9e7] rounded-md text-sm focus:outline-none focus:border-[#01696f] shadow-inner"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
                  />
                  <button
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !broadcastMsg.trim()}
                    className="px-4 py-2 bg-[#01696f] text-white text-sm font-bold rounded-md hover:bg-[#005459] disabled:opacity-50 shadow-xs transition-colors whitespace-nowrap"
                  >
                    {isBroadcasting ? 'Sending...' : 'Send Alert'}
                  </button>
                </div>
              </div>

              {/* Share Booking Link */}
              {clinicId && (
                <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
                    <h2 className="font-bold text-[#1a202c]">Patient Booking Portal Link</h2>
                  </div>
                  <div className="p-6 space-y-3">
                    <p className="text-xs text-[#64748b]">Share this link with patients so they can book appointments and join the virtual queue from home.</p>
                    <div className="flex gap-3 items-center">
                      <code className="flex-1 px-3 py-2 bg-[#fbfbfa] border border-[#e9e9e7] rounded-md text-xs font-mono text-[#01696f] truncate">
                        {typeof window !== 'undefined' ? `${window.location.origin}/book/${clinicId}` : `/book/${clinicId}`}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/book/${clinicId}`)}
                        className="px-3 py-2 bg-white border border-[#e9e9e7] rounded-md text-xs font-bold hover:bg-[#f4f4f3] shadow-xs whitespace-nowrap"
                      >
                        Copy Link
                      </button>
                      <a
                        href={`/book/${clinicId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-[#01696f] text-white rounded-md text-xs font-bold hover:bg-[#005459] shadow-xs whitespace-nowrap"
                      >
                        Preview
                      </a>
                    </div>
                  </div>
                </div>
              )}

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
                  <button
                    onClick={() => setIsAddDoctorOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-white bg-[#01696f] px-3 py-1.5 rounded-md font-bold hover:bg-[#005459] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Doctor
                  </button>
                </div>
                <div className="p-0">
                  {doctorsList.map((doc, idx) => (
                    <div key={idx} className="px-6 py-4 border-b border-[#e9e9e7] last:border-0 flex justify-between items-center hover:bg-[#fbfbfa]">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-[#e6f3f4] text-[#01696f] rounded-full flex items-center justify-center font-bold text-sm">
                          {doc.user?.name ? doc.user.name.charAt(0) : 'D'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#1a202c]">{doc.user?.name || 'Doctor'}</p>
                          <p className="text-xs text-[#64748b] mt-0.5">{doc.speciality}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openManageSchedule(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e9e9e7] bg-white rounded text-xs font-semibold hover:bg-[#f4f4f3] transition-colors"
                      >
                        <Calendar className="h-3.5 w-3.5 text-[#01696f]" /> Manage Schedule
                      </button>
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
              {isLoadingLogs ? (
                <div className="space-y-3 pt-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border border-[#e9e9e7] rounded-xl animate-pulse space-y-2">
                      <div className="h-3 bg-[#e9e9e7] rounded w-1/3"></div>
                      <div className="h-3 bg-[#e9e9e7] rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : notificationLogs.length === 0 ? (
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

      {ToastComponent}

      {/* ADD DOCTOR MODAL */}
      {isAddDoctorOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-[#e9e9e7] overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e9e9e7]">
              <h2 className="font-serif text-lg font-bold text-[#1a202c] flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[#01696f]" /> Add New Doctor
              </h2>
              <button onClick={() => setIsAddDoctorOpen(false)} className="p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">Full Name *</label>
                  <input required value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} placeholder="Dr. Priya Sharma" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">Speciality *</label>
                  <select required value={newDoctorSpeciality} onChange={e => setNewDoctorSpeciality(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]">
                    {SPECIALITIES_LIST.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">Email *</label>
                  <input required type="email" value={newDoctorEmail} onChange={e => setNewDoctorEmail(e.target.value)} placeholder="doctor@clinic.com" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">Phone</label>
                  <input type="tel" value={newDoctorPhone} onChange={e => setNewDoctorPhone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] mb-1">Login Password</label>
                <input value={newDoctorPassword} onChange={e => setNewDoctorPassword(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm font-mono focus:outline-none focus:border-[#01696f]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] mb-2">Working Days</label>
                <div className="flex gap-2 flex-wrap">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => (
                    <button key={i} type="button"
                      onClick={() => setNewDoctorDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${newDoctorDays.includes(i) ? 'bg-[#01696f] text-white border-[#01696f]' : 'bg-white text-[#64748b] border-[#e9e9e7] hover:border-[#01696f]'}`}
                    >{d}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">Start Time</label>
                  <input type="time" value={newDoctorStart} onChange={e => setNewDoctorStart(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] mb-1">End Time</label>
                  <input type="time" value={newDoctorEnd} onChange={e => setNewDoctorEnd(e.target.value)} className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-[#e9e9e7]">
                <button type="button" onClick={() => setIsAddDoctorOpen(false)} className="px-4 py-2 border border-[#e9e9e7] rounded-lg text-sm font-semibold text-[#64748b] hover:bg-[#f4f4f3]">Cancel</button>
                <button type="submit" disabled={isAddingDoctor} className="px-4 py-2 bg-[#01696f] text-white rounded-lg text-sm font-bold hover:bg-[#005459] disabled:opacity-50">
                  {isAddingDoctor ? 'Creating...' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE SCHEDULE MODAL */}
      {isManageScheduleOpen && scheduleDoctor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-[#e9e9e7] overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e9e9e7]">
              <div>
                <h2 className="font-serif text-lg font-bold text-[#1a202c] flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#01696f]" /> Manage Schedule
                </h2>
                <p className="text-xs text-[#64748b] mt-0.5">{scheduleDoctor.user?.name} · {scheduleDoctor.speciality}</p>
              </div>
              <button onClick={() => setIsManageScheduleOpen(false)} className="p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {managedSchedules.map((s, idx) => (
                <div key={s.dayOfWeek} className={`p-4 border rounded-xl transition-colors ${s.active ? 'border-[#e9e9e7] bg-white' : 'border-dashed border-[#e9e9e7] bg-[#fbfbfa] opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={s.active} onChange={e => {
                        const updated = [...managedSchedules];
                        updated[idx] = { ...s, active: e.target.checked };
                        setManagedSchedules(updated);
                      }} className="w-4 h-4 accent-[#01696f]" />
                      <span className="font-bold text-sm text-[#1a202c]">{s.label}</span>
                    </label>
                    {s.active && (
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[#64748b]" />
                          <input type="time" value={s.startTime} onChange={e => {
                            const updated = [...managedSchedules];
                            updated[idx] = { ...s, startTime: e.target.value };
                            setManagedSchedules(updated);
                          }} className="px-2 py-1 border border-[#e9e9e7] rounded text-xs focus:outline-none focus:border-[#01696f]" />
                          <span className="text-[#64748b]">to</span>
                          <input type="time" value={s.endTime} onChange={e => {
                            const updated = [...managedSchedules];
                            updated[idx] = { ...s, endTime: e.target.value };
                            setManagedSchedules(updated);
                          }} className="px-2 py-1 border border-[#e9e9e7] rounded text-xs focus:outline-none focus:border-[#01696f]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[#64748b]">Slot:</span>
                          <select value={s.slotDuration} onChange={e => {
                            const updated = [...managedSchedules];
                            updated[idx] = { ...s, slotDuration: parseInt(e.target.value) };
                            setManagedSchedules(updated);
                          }} className="px-2 py-1 border border-[#e9e9e7] rounded text-xs focus:outline-none focus:border-[#01696f]">
                            {[10,15,20,30,45,60].map(m => <option key={m} value={m}>{m}min</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e9e9e7]">
                <button onClick={() => setIsManageScheduleOpen(false)} className="px-4 py-2 border border-[#e9e9e7] rounded-lg text-sm font-semibold text-[#64748b] hover:bg-[#f4f4f3]">Cancel</button>
                <button onClick={handleSaveSchedule} disabled={isSavingSchedule} className="px-4 py-2 bg-[#01696f] text-white rounded-lg text-sm font-bold hover:bg-[#005459] disabled:opacity-50">
                  {isSavingSchedule ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isHistoryOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl p-6 relative border-l border-[#e9e9e7] animate-in slide-in-from-right duration-300">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b]">
              <X className="h-5 w-5" />
            </button>
            <h2 className="font-serif text-xl font-bold tracking-tight flex items-center gap-2 text-[#01696f] mb-1">
              <Activity className="h-5 w-5" /> Patient History
            </h2>
            <p className="text-sm text-[#64748b] mb-6 font-medium">{historyPatientName}</p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {patientHistory.length === 0 ? (
                <div className="py-20 text-center text-sm text-[#64748b] font-medium">No visit history found for this patient.</div>
              ) : (
                patientHistory.map((visit: any, idx: number) => (
                  <div key={visit.id || idx} className="p-4 border border-[#e9e9e7] bg-[#fbfbfa] rounded-xl shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[#01696f] uppercase tracking-wider">
                        Visit #{patientHistory.length - idx}
                      </span>
                      <span className="text-[10px] text-[#64748b] font-semibold">
                        {new Date(visit.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {visit.chiefComplaint && (
                      <p className="text-sm font-medium text-[#1a202c]">
                        <span className="text-xs text-[#64748b] font-semibold">Chief Complaint: </span>
                        {visit.chiefComplaint}
                      </p>
                    )}
                    {visit.notes && (
                      <div className="bg-white border border-[#e9e9e7] rounded-lg p-3">
                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Doctor Notes</p>
                        <p className="text-sm text-[#1a202c] whitespace-pre-wrap">{visit.notes}</p>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {visit.urgency && (
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase inline-block border ${
                          visit.urgency === 'EMERGENCY' ? 'bg-red-50 text-red-700 border-red-200' :
                          visit.urgency === 'URGENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {visit.urgency}
                        </span>
                      )}
                      {visit.visitType && (
                        <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold uppercase inline-block">
                          {visit.visitType}
                        </span>
                      )}
                    </div>
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
