'use client';

import React, { useState, useEffect } from 'react';
import { useQueueStore, TokenItem } from '../../../src/store/useQueueStore';
import { apiRequest } from '../../../src/utils/api';
import VoiceDictation from '../../../src/components/VoiceDictation';
import { 
  Play, SkipForward, AlertCircle, Save, CheckCircle2,
  Clock, ShieldAlert, FileText, ChevronRight, Activity,
  LayoutDashboard, Calendar, Users, FileBarChart, Bell, Search, Plus, UserPlus, X, User, Phone
} from 'lucide-react';

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

  // 1. Check/Seed sandbox context
  useEffect(() => {
    async function loadDoctorContext() {
      let savedClinicId = localStorage.getItem('cureq_clinic_id') || '';
      let savedBranchId = localStorage.getItem('cureq_branch_id') || '';
      
      if (!savedClinicId || !savedBranchId) {
        try {
          const mockAdmin = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Doctor Demo Admin',
              email: `doctor_${Math.round(Math.random()*1000)}@cureq.com`,
              password: 'DemoPassword123!',
              phone: `90001${Math.round(Math.random()*90000)}`,
            }),
          });
          localStorage.setItem('cureq_token', mockAdmin.token);

          const mockOnboard = await apiRequest('/auth/onboard', {
            method: 'POST',
            body: JSON.stringify({
              clinicName: 'CureQ Care Clinic',
              speciality: 'Dermatologist',
              doctors: [
                { name: 'Dr. Priya Sharma', email: `priya_${Math.round(Math.random()*1000)}@cureq.com`, speciality: 'Dermatologist', phone: '9888866661' }
              ]
            }),
          });

          savedClinicId = mockOnboard.clinic.id;
          savedBranchId = mockOnboard.branch.id;
          localStorage.setItem('cureq_clinic_id', savedClinicId);
          localStorage.setItem('cureq_branch_id', savedBranchId);
        } catch (err) {
          console.error(err);
        }
      }

      setClinicId(savedClinicId);
      setBranchId(savedBranchId);

      try {
        const res = await apiRequest('/auth/me');
        if (res.user && res.user.doctorProfile) {
          setDoctorId(res.user.doctorProfile.id);
          setDoctorName(res.user.name);
          setSpeciality(res.user.doctorProfile.speciality);
        } else if (savedClinicId) {
          const clinicRes = await apiRequest(`/clinics/${savedClinicId}`);
          const sched = clinicRes.clinic.branches[0]?.schedules[0];
          if (sched) {
            setDoctorId(sched.doctor.id);
            setDoctorName(sched.doctor.user.name);
            setSpeciality(sched.doctor.speciality);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadDoctorContext();
  }, []);

  // 2. Init queue syncing
  useEffect(() => {
    if (branchId && doctorId) {
      fetchQueue(branchId, doctorId);
      initSocket(branchId);
      loadPerformanceStats();
    }
    return () => {
      disconnectSocket();
    };
  }, [branchId, doctorId]);

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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#e6f3f4] text-[#01696f] flex items-center justify-center font-bold">
              {doctorName.charAt(0)}
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
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748b]" />
            <input 
              type="text" 
              placeholder="Search patients, appointments..." 
              className="w-full pl-10 pr-4 py-2 bg-[#fbfbfa] border border-[#e9e9e7] rounded-md text-sm focus:outline-none focus:border-[#01696f] focus:ring-1 focus:ring-[#01696f] transition-all"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-[#64748b] hover:text-[#1a202c] hover:bg-[#fbfbfa] rounded-full transition-transitions relative cursor-pointer">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-2 h-2 w-2 bg-[#01696f] rounded-full"></span>
            </button>
            <div className="h-6 w-px bg-[#e9e9e7]"></div>
            <span className="text-xs bg-[#e6f3f4] text-[#01696f] px-2.5 py-1 rounded border border-[#01696f]/20 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#01696f] animate-pulse"></span> Live Sync
            </span>
          </div>
        </header>

        {/* Dynamic Content based on Active Tab */}
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
                              Token: {nextPatient.tokenNo} • Type: {nextPatient.type}
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
                <h2 className="font-semibold text-lg">Today's Schedule</h2>
                <span className="text-xs font-semibold bg-[#e6f3f4] text-[#01696f] px-3 py-1 rounded-full">
                  {activeQueue.length} Waiting
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-xs uppercase font-semibold text-[#64748b]">
                    <tr>
                      <th className="px-6 py-3">Token</th>
                      <th className="px-6 py-3">Patient Name</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Est. Wait</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e9e9e7]">
                    {activeQueue.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-[#64748b]">No patients in queue currently.</td>
                      </tr>
                    ) : (
                      activeQueue.map((pt) => (
                        <tr key={pt.id} className="hover:bg-[#fbfbfa] transition-colors">
                          <td className="px-6 py-4 font-bold text-[#01696f]">{pt.tokenNo}</td>
                          <td className="px-6 py-4 font-medium">{pt.patientName}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] uppercase rounded font-bold tracking-wider">
                              {pt.type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-[10px] uppercase rounded font-bold tracking-wider ${
                              pt.status === 'IN_CONSULTATION' ? 'bg-[#e6f3f4] text-[#01696f]' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {pt.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-[#64748b]">{pt.estimatedWait} mins</td>
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
                  <input type="text" placeholder="Search records..." className="w-full pl-10 pr-3 py-1.5 border border-[#e9e9e7] rounded text-sm" />
                </div>
              </div>
              <div className="p-8 text-center">
                <Users className="h-12 w-12 text-[#e9e9e7] mx-auto mb-3" />
                <h3 className="font-medium text-[#1a202c]">No records found</h3>
                <p className="text-sm text-[#64748b] mt-1">Add a new patient to see them listed here.</p>
                <button onClick={() => setShowAddPatient(true)} className="mt-4 px-4 py-2 bg-[#01696f] text-white rounded-md text-sm font-semibold hover:bg-[#005459]">
                  Add First Patient
                </button>
              </div>
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
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Full Name</label>
                <input type="text" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Phone Number</label>
                <input type="tel" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" placeholder="+91 9876543210" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Age</label>
                  <input type="number" className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]" placeholder="30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1">Gender</label>
                  <select className="w-full px-3 py-2 border border-[#e9e9e7] rounded-md focus:outline-none focus:border-[#01696f]">
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa] flex justify-end gap-3">
              <button onClick={() => setShowAddPatient(false)} className="px-4 py-2 border border-[#e9e9e7] bg-white text-[#1a202c] font-semibold text-sm rounded-md hover:bg-[#f4f4f3]">Cancel</button>
              <button onClick={() => setShowAddPatient(false)} className="px-4 py-2 bg-[#01696f] text-white font-semibold text-sm rounded-md hover:bg-[#005459]">Register Patient</button>
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

    </div>
  );
}