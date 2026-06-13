'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../src/utils/api';
import {
  Settings, MapPin, CreditCard, CheckCircle2, AlertTriangle,
  Building, UserCheck, Plus, Sparkles, Calendar, Activity, Megaphone
} from 'lucide-react';

export default function ClinicSettings() {
  const [clinicId, setClinicId] = useState('');
  const [clinicData, setClinicData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New Branch Form
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  
  // UI feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  // Clinic profile edit
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSpeciality, setEditSpeciality] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Holiday management
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayReason, setNewHolidayReason] = useState('');
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // TV Announcements
  const [announcementMessages, setAnnouncementMessages] = useState<string[]>(['', '', '', '', '']);
  const [isSavingAnnouncements, setIsSavingAnnouncements] = useState(false);

  // Audit log
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // 1. Load clinic profile
  const fetchClinicConfig = async (id: string) => {
    try {
      const res = await apiRequest(`/clinics/${id}`);
      setClinicData(res.clinic);
      setEditName(res.clinic.name || '');
      setEditAddress(res.clinic.branches?.[0]?.address || '');
      setEditSpeciality(res.clinic.speciality || '');
      setLoading(false);
      const branchId = res.clinic.branches?.[0]?.id;
      if (branchId) fetchAnnouncements(branchId);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchHolidays = async (cId: string) => {
    try {
      const res = await apiRequest(`/features/clinics/${cId}/holidays`);
      setHolidays(res.holidays || []);
    } catch { /* ignore */ }
  };

  const fetchAnnouncements = async (branchId: string) => {
    try {
      const res = await apiRequest(`/notifications/${branchId}/announcements`);
      if (res.announcements && res.announcements.length > 0) {
        const msgs = [...res.announcements];
        while (msgs.length < 5) msgs.push('');
        setAnnouncementMessages(msgs.slice(0, 5));
      }
    } catch { /* use defaults */ }
  };

  const handleSaveAnnouncements = async () => {
    const branchId = clinicData?.branches?.[0]?.id;
    if (!branchId) return;
    setIsSavingAnnouncements(true);
    try {
      const messages = announcementMessages.filter(m => m.trim());
      await apiRequest(`/notifications/${branchId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
      setSuccessMsg('TV announcements saved successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save announcements.');
    } finally {
      setIsSavingAnnouncements(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!clinicId) return;
    setIsLoadingAuditLogs(true);
    try {
      const res = await apiRequest(`/features/clinics/${clinicId}/audit-logs`);
      setAuditLogs(res.logs || []);
    } catch { /* ignore */ } finally { setIsLoadingAuditLogs(false); }
  };

  useEffect(() => {
    const savedId = localStorage.getItem('cureq_clinic_id') || '';
    setClinicId(savedId);
    if (savedId) {
      fetchClinicConfig(savedId);
      fetchHolidays(savedId);
    } else {
      setLoading(false);
    }
  }, []);

  // 2. Submit new Branch (gated by SaaS limits)
  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoadingAction(true);

    try {
      await apiRequest(`/clinics/${clinicId}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          name: branchName,
          address: branchAddress,
          phone: branchPhone,
        }),
      });

      setSuccessMsg('Branch registered successfully!');
      setBranchName('');
      setBranchAddress('');
      setBranchPhone('');
      
      // Refresh config
      fetchClinicConfig(clinicId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create branch.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoadingAction(true);
    try {
      await apiRequest(`/clinics/${clinicId}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, speciality: editSpeciality }),
      });
      setSuccessMsg('Clinic profile updated successfully!');
      fetchClinicConfig(clinicId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoadingAction(false);
    }
  };

  // 3. Upgrade SaaS plan
  const handleUpgradePlan = async (tier: 'FREE' | 'STARTER' | 'PRO' | 'CHAIN') => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await apiRequest(`/clinics/${clinicId}/plan`, {
        method: 'PUT',
        body: JSON.stringify({ plan: tier }),
      });
      setSuccessMsg(`Successfully upgraded to the ${tier} Plan!`);
      fetchClinicConfig(clinicId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Upgrade failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1516] flex items-center justify-center text-xs text-gray-400 font-light">
        Loading clinic configurations...
      </div>
    );
  }

  if (!clinicId || !clinicData) {
    return (
      <div className="min-h-screen bg-[#0d1516] flex items-center justify-center p-4">
        <div className="text-center p-6 bg-[#111e20] border border-[#1c2e31] rounded-[6px] max-w-sm">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
          <h2 className="font-serif text-lg font-bold">No Workspace Setup</h2>
          <p className="text-xs text-gray-400 mt-2 font-light">
            You must onboard your clinic branch before configuring settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1516] text-gray-100 p-4 md:p-8">
      
      {/* Header */}
      <div className="border-b border-[#1c2e31] pb-6 mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8 text-[#01696f]" /> Workspace Settings
        </h1>
        <p className="text-xs text-gray-400 font-light mt-0.5">Configure branch details, subscription plans, and limit controls</p>
      </div>

      {/* Success/Error Feedbacks */}
      {successMsg && (
        <div className="mb-6 p-3 bg-emerald-950/20 text-emerald-400 text-xs rounded border border-emerald-900/50 flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="h-4 w-4" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-3 bg-red-950/20 text-red-400 text-xs rounded border border-red-900/50 flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-4 w-4" /> {errorMsg}
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Side: Branches List & Creation (2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Clinic Profile Edit */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
              <Building className="h-4 w-4" /> Clinic Profile
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Clinic Name</label>
                  <input
                    type="text" required
                    className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Speciality</label>
                  <input
                    type="text" required
                    placeholder="e.g. General Physician, Dentist"
                    className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                    value={editSpeciality}
                    onChange={(e) => setEditSpeciality(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loadingAction}
                className="px-4 py-2 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-semibold rounded-[4px] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loadingAction ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
          </div>

          {/* Active branches list */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
              <Building className="h-4 w-4" /> Registered Branches
            </h3>
            
            <div className="divide-y divide-[#1c2e31]">
              {clinicData.branches.map((b: any) => (
                <div key={b.id} className="py-3 flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm">{b.name}</h4>
                    <p className="text-xs text-gray-400 font-light mt-0.5">{b.address} • Contact: {b.phone}</p>
                  </div>
                  <span className="text-[9px] bg-[#0d1516] text-gray-400 px-2 py-0.5 rounded uppercase font-semibold">
                    Branch ID: {b.id.slice(0, 8)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add branch form */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
              <Plus className="h-4 w-4" /> Add Clinic Branch
            </h3>
            
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Branch Location Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Clinic - Andheri West"
                    className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Contact Phone</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 022-263720"
                    className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-medium">Branch Address</label>
                <input
                  type="text"
                  required
                  placeholder="Street details, Landmark, City"
                  className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loadingAction}
                className="px-4 py-2 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-semibold rounded-[4px] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loadingAction ? 'Validating limits...' : 'Register Branch'}
              </button>
            </form>
          </div>

          {/* Holiday Management */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
              <Calendar className="h-4 w-4" /> Clinic Holidays & Closures
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {holidays.length === 0 ? (
                <p className="text-[10px] text-gray-400">No holidays configured.</p>
              ) : holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-[#1c2e31]">
                  <div>
                    <span className="text-xs font-mono text-[#01696f] font-bold">{h.date}</span>
                    {h.reason && <span className="text-[10px] text-gray-400 ml-2">{h.reason}</span>}
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`Remove holiday on ${h.date}?`)) return;
                    await apiRequest(`/features/clinics/${clinicId}/holidays/${h.date}`, { method: 'DELETE' });
                    setHolidays(prev => prev.filter(x => x.id !== h.id));
                  }} className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-[#1c2e31]">
              <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                className="px-2 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs text-gray-100 focus:outline-none focus:border-[#01696f]" />
              <input type="text" placeholder="Reason (optional)" value={newHolidayReason} onChange={e => setNewHolidayReason(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs text-gray-100 focus:outline-none focus:border-[#01696f]" />
              <button disabled={!newHolidayDate || isAddingHoliday}
                onClick={async () => {
                  setIsAddingHoliday(true);
                  try {
                    const res = await apiRequest(`/features/clinics/${clinicId}/holidays`, { method: 'POST', body: JSON.stringify({ date: newHolidayDate, reason: newHolidayReason }) });
                    setHolidays(prev => [...prev, res.holiday].sort((a, b) => a.date.localeCompare(b.date)));
                    setNewHolidayDate(''); setNewHolidayReason('');
                    setSuccessMsg('Holiday added.');
                  } catch (err: any) { setErrorMsg(err.message); }
                  finally { setIsAddingHoliday(false); }
                }}
                className="px-3 py-1.5 bg-[#01696f] text-white text-[10px] font-bold rounded-[4px] cursor-pointer disabled:opacity-50">
                {isAddingHoliday ? '...' : 'Add'}
              </button>
            </div>
          </div>

          {/* TV Announcements */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
              <Megaphone className="h-4 w-4" /> Waiting Room TV Announcements
            </h3>
            <p className="text-[10px] text-gray-400 font-light">
              Custom ticker messages shown on the TV display. Up to 5 messages, rotating every 8 seconds.
              Leave blank to use the default CureQ messages.
            </p>
            <div className="space-y-2">
              {announcementMessages.map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-500 font-bold w-4 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder={`Announcement ${idx + 1} (optional)`}
                    maxLength={160}
                    value={msg}
                    onChange={e => {
                      const updated = [...announcementMessages];
                      updated[idx] = e.target.value;
                      setAnnouncementMessages(updated);
                    }}
                    className="flex-1 px-2 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs text-gray-100 focus:outline-none focus:border-[#01696f] placeholder:text-gray-600"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveAnnouncements}
              disabled={isSavingAnnouncements}
              className="px-4 py-2 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-semibold rounded-[4px] disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSavingAnnouncements ? 'Saving...' : 'Save Announcements'}
            </button>
          </div>

          {/* Audit Log */}
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1c2e31] pb-2">
              <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 text-[#01696f]">
                <Activity className="h-4 w-4" /> Activity Audit Log
              </h3>
              <button onClick={() => { setShowAuditLog(true); fetchAuditLogs(); }}
                className="text-[10px] text-[#01696f] border border-[#01696f]/30 px-2 py-1 rounded hover:bg-[#01696f]/10 cursor-pointer">
                View Log
              </button>
            </div>
            <p className="text-[10px] text-gray-400 font-light">Track all staff actions: token operations, doctor management, schedule changes.</p>
          </div>
        </div>

        {/* Right Side: Quick Links + SaaS Billing Plans (1 column) */}
        <div>
        {/* Quick Links */}
        <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] h-fit space-y-4 mb-6">
          <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
            <UserCheck className="h-4 w-4" /> Shareable Links
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-medium">Patient Booking Portal</p>
              <div className="flex items-center gap-2">
                <code className="text-[10px] bg-[#0d1516] text-[#01696f] px-2 py-1 rounded border border-[#1c2e31] flex-1 truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/book/${clinicId}` : `/book/${clinicId}`}
                </code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${clinicId}`); setSuccessMsg('Booking link copied!'); }}
                  className="text-[10px] text-gray-300 bg-[#0d1516] border border-[#1c2e31] px-2 py-1 rounded hover:bg-[#1c2e31] cursor-pointer whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-1 font-medium">Waiting Room TV Display</p>
              <div className="flex items-center gap-2">
                <code className="text-[10px] bg-[#0d1516] text-[#01696f] px-2 py-1 rounded border border-[#1c2e31] flex-1 truncate">
                  {typeof window !== 'undefined' ? `${window.location.origin}/display/${clinicId}` : `/display/${clinicId}`}
                </code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/display/${clinicId}`); setSuccessMsg('TV display link copied!'); }}
                  className="text-[10px] text-gray-300 bg-[#0d1516] border border-[#1c2e31] px-2 py-1 rounded hover:bg-[#1c2e31] cursor-pointer whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] h-fit space-y-6">
          <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5 border-b border-[#1c2e31] pb-2 text-[#01696f]">
            <CreditCard className="h-4 w-4" /> Subscription Plan Tiers
          </h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#01696f]/10 p-3 rounded border border-[#01696f]/20">
              <span className="text-xs font-bold">Active Tier Plan</span>
              <span className="text-xs bg-[#01696f] text-white px-2 py-0.5 rounded font-mono font-bold uppercase">{clinicData.plan}</span>
            </div>

            {/* Selection items */}
            {['FREE', 'STARTER', 'PRO', 'CHAIN'].map((plan) => {
              const isActive = clinicData.plan === plan;
              return (
                <div 
                  key={plan}
                  className={`p-3 border rounded-[4px] flex justify-between items-center transition-all ${
                    isActive 
                      ? 'border-[#01696f] bg-[#01696f]/10' 
                      : 'border-[#1c2e31] hover:bg-[#0d1516]/50'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-xs capitalize">{plan.toLowerCase()} plan</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {plan === 'FREE' && '1 Doctor • 1 Branch • 50 tokens/day'}
                      {plan === 'STARTER' && '3 Doctors • 1 Branch • 200 tokens/day'}
                      {plan === 'PRO' && 'Unlimited Doctors • 1 Branch • Unlimited tokens'}
                      {plan === 'CHAIN' && 'Unlimited Doctors • Unlimited Branches • Custom Analytics'}
                    </p>
                  </div>
                  {!isActive && (
                    <button
                      onClick={() => handleUpgradePlan(plan as any)}
                      className="bg-[#0d1516] hover:bg-[#1c2e31] text-[10px] rounded border border-[#1c2e31] font-semibold cursor-pointer text-gray-200 px-3 py-1"
                    >
                      Choose
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

      </div>

      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="w-full max-w-lg bg-[#0d1516] border-l border-[#1c2e31] h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1c2e31]">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">Activity Log</h2>
              <button onClick={() => setShowAuditLog(false)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoadingAuditLogs ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-[#111e20] rounded animate-pulse" />)}</div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">No activity logged yet.</p>
              ) : auditLogs.map((log: any) => (
                <div key={log.id} className="p-3 bg-[#111e20] border border-[#1c2e31] rounded-[4px]">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono font-bold text-[#01696f]">{log.action}</span>
                    <span className="text-[9px] text-gray-500">{new Date(log.createdAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                  {log.details && <p className="text-[10px] text-gray-400 mt-1">{log.details}</p>}
                  {log.userName && <p className="text-[9px] text-gray-500 mt-0.5">By: {log.userName} ({log.userRole})</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
