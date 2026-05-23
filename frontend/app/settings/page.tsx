'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../src/utils/api';
import { 
  Settings, MapPin, CreditCard, CheckCircle2, AlertTriangle, 
  Building, UserCheck, Plus, Sparkles
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

  // 1. Load clinic profile
  const fetchClinicConfig = async (id: string) => {
    try {
      const res = await apiRequest(`/clinics/${id}`);
      setClinicData(res.clinic);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem('cureq_clinic_id') || '';
    setClinicId(savedId);
    if (savedId) {
      fetchClinicConfig(savedId);
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
        </div>

        {/* Right Side: SaaS Billing Plans (1 column) */}
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
  );
}
