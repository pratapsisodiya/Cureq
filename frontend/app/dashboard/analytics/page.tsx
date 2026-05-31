'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest, API_URL } from '../../../src/utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Activity, Users, Clock, AlertTriangle, TrendingUp, Download, Sparkles, User, Calendar, ArrowRight,
  LayoutDashboard, FileBarChart, ChevronLeft, Printer, Settings, Search, LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useClerkSync } from '../../../src/utils/useClerkSync';
import AIOutbreakAlert from '../../../src/components/AIOutbreakAlert';
import UserGuide from '../../../src/components/UserGuide';

export default function AnalyticsDashboard() {
  const { syncing, isSignedIn } = useClerkSync();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!syncing && !isSignedIn) {
      router.replace('/login');
    }
  }, [syncing, isSignedIn, router]);

  const [clinicId, setClinicId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [revenueData, setRevenueData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const savedClinicId = localStorage.getItem('cureq_clinic_id');
      if (!savedClinicId) {
        setLoading(false);
        return;
      }
      setClinicId(savedClinicId);

      try {
        const res = await apiRequest(`/analytics/${savedClinicId}`);
        setData(res);
        try {
          const revRes = await apiRequest(`/features/clinics/${savedClinicId}/revenue`);
          setRevenueData(revRes);
        } catch { /* ignore */ }
      } catch (err) {
        console.error('Failed to load analytics', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || !clinicId) return;

    setIsAsking(true);
    setAiResponse('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await apiRequest(`/analytics/${clinicId}/query`, {
        method: 'POST',
        body: JSON.stringify({ question: aiQuery }),
        signal: controller.signal,
      });
      setAiResponse(res.analysis);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setAiResponse('Request timed out. The AI engine is taking too long. Please try again.');
      } else {
        setAiResponse('Error reaching CureQ AI Engine. Please try again later.');
      }
    } finally {
      clearTimeout(timeout);
      setIsAsking(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!clinicId) return;
    window.location.href = `${API_URL}/analytics/${clinicId}/report`;
  };

  const handlePrintReport = () => {
    if (!data) return;
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const s = data.stats || {};
    const docRows = (data.doctorPerformance || []).map((d: any) =>
      '<tr><td>' + d.name + '</td><td>' + d.speciality + '</td><td>' + d.servedCount +
      '</td><td>' + d.noShowRate + '%</td><td>' + d.avgConsultationTime + ' min</td></tr>'
    ).join('');
    const docTable = docRows ? '<h2>Doctor Performance</h2><table><tr><th>Doctor</th><th>Speciality</th><th>Served</th><th>No-Show Rate</th><th>Avg Consult</th></tr>' + docRows + '</table>' : '';
    const html = '<html><head><title>CureQ Daily Report</title><style>' +
      'body{font-family:Segoe UI,sans-serif;padding:40px;color:#1a202c;max-width:800px;margin:0 auto}' +
      'h1{color:#01696f;border-bottom:2px solid #e9e9e7;padding-bottom:12px;margin-bottom:24px}' +
      'h2{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin-top:28px;margin-bottom:12px}' +
      'table{width:100%;border-collapse:collapse;font-size:13px}' +
      'th{background:#f4f4f3;text-align:left;padding:8px 12px;border:1px solid #e9e9e7;font-weight:600}' +
      'td{padding:8px 12px;border:1px solid #e9e9e7}' +
      '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}' +
      '.card{background:#f4f4f3;border:1px solid #e9e9e7;border-radius:6px;padding:16px;text-align:center}' +
      '.val{font-size:28px;font-weight:700;color:#01696f}.lbl{font-size:11px;color:#64748b;margin-top:4px}' +
      'footer{margin-top:40px;font-size:10px;color:#a0aec0;text-align:center;border-top:1px solid #e9e9e7;padding-top:16px}' +
      '</style></head><body>' +
      '<h1>CureQ Daily Operations Report</h1>' +
      '<p style="color:#64748b;font-size:13px;margin-bottom:24px">Date: <strong>' + today + '</strong> &nbsp;|&nbsp; Generated: ' + new Date().toLocaleTimeString() + '</p>' +
      '<div class="grid">' +
      '<div class="card"><div class="val">' + (s.registered || 0) + '</div><div class="lbl">Registered Today</div></div>' +
      '<div class="card"><div class="val">' + (s.served || 0) + '</div><div class="lbl">Served</div></div>' +
      '<div class="card"><div class="val">' + (s.noshow || 0) + '</div><div class="lbl">No-Shows</div></div>' +
      '<div class="card"><div class="val">' + (s.inQueue || 0) + '</div><div class="lbl">In Queue</div></div>' +
      '</div>' + docTable +
      '<footer>Powered by CureQ Queue Management Engine &nbsp;|&nbsp; Confidential – Clinic Use Only</footer>' +
      '</body></html>';
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300); }
  };

  if (syncing || loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#01696f] animate-pulse">
          <Activity className="h-10 w-10 animate-spin" />
          <p className="text-sm font-semibold uppercase tracking-widest">
            {syncing ? 'Checking auth session...' : 'Aggregating Clinic Data'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] p-10 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-[#1a202c]">No Analytics Available</h2>
        <p className="text-[#64748b] mt-2">Please complete onboarding and generate some token traffic first.</p>
      </div>
    );
  }

  const { stats, volumeData, waitTimeData, doctorPerformance, heatmap } = data;

  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapHours = Array.from({ length: 9 }, (_, i) => {
    const h = 9 + i;
    return `${h === 12 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  });
  const maxHeatCount = Math.max(1, ...(heatmap || []).map((c: any) => c.count));

  return (
    <div className="min-h-screen bg-[#fbfbfa] font-sans flex flex-col md:flex-row selection:bg-[#01696f]/20">
      <UserGuide />
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-[#e9e9e7] flex flex-col h-auto md:h-screen sticky top-0 z-20 shadow-xs shrink-0">
        <div className="p-6 border-b border-[#e9e9e7] flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <span className="font-serif text-xl font-bold tracking-tight text-[#1a202c]">CureQ</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link href="/dashboard/reception?tab=Dashboard" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/dashboard/reception?tab=Patients" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Users className="h-4 w-4" /> Patient Records
          </Link>
          <Link href="/dashboard/reception?tab=Settings" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Settings className="h-4 w-4" /> Clinic Settings
          </Link>
          <Link href="/dashboard/reception?tab=All%20Queues" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Activity className="h-4 w-4" /> All Queues
          </Link>
          <Link href="/dashboard/reception?tab=Waitlist" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Calendar className="h-4 w-4" /> Waitlist
          </Link>
          <div className="pt-2 border-t border-[#e9e9e7] mt-2">
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm bg-[#f4f4f3] text-[#01696f]">
              <Activity className="h-4 w-4" /> Analytics
            </div>
            <Link href="/dashboard/doctor" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Users className="h-4 w-4" /> Doctor Console
            </Link>
            <Link href="/patient/portal" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Search className="h-4 w-4" /> Patient Portal
            </Link>
            {clinicId && (
              <a href={`/waitlist/${clinicId}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
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
            aria-label="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Avatar" className="h-10 w-10 rounded-full object-cover border border-[#e9e9e7]" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-[#e6f3f4] text-[#01696f] flex items-center justify-center font-bold">
                {user?.fullName ? user.fullName.charAt(0) : 'R'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold truncate max-w-[140px]" title={user?.fullName || 'Receptionist'}>
                {user?.fullName || 'Receptionist'}
              </p>
              <p className="text-xs text-[#64748b]">Front Desk</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-[#e9e9e7] px-8 py-5 sticky top-0 z-10 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-xl leading-tight text-[#1a202c]">Clinic Command Center</h1>
          <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Business Intelligence Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e9e9e7] text-[#1a202c] rounded-md text-sm font-bold shadow-xs hover:bg-[#f4f4f3] transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export CSV Report
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2 border border-[#e9e9e7] bg-white hover:bg-[#f4f4f3] text-[#1a202c] text-xs font-semibold rounded-md transition-colors shadow-xs"
          >
            <Printer className="h-4 w-4" /> Print Report
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8 w-full">
        
        {/* KPI Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Today's Volume</span>
              <div className="h-8 w-8 bg-[#e6f3f4] text-[#01696f] rounded flex items-center justify-center"><Users className="h-4 w-4" /></div>
            </div>
            <span className="text-4xl font-bold text-[#1a202c]">{stats.registered}</span>
            <span className="text-xs text-emerald-600 font-bold ml-2 flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3" /> Live Tracking
            </span>
          </div>

          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Currently Waiting</span>
              <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded flex items-center justify-center"><Clock className="h-4 w-4" /></div>
            </div>
            <span className="text-4xl font-bold text-[#1a202c]">{stats.inQueue}</span>
            <span className="text-xs text-[#64748b] font-medium block mt-2">Across all doctors</span>
          </div>

          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Total Served</span>
              <div className="h-8 w-8 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center"><Activity className="h-4 w-4" /></div>
            </div>
            <span className="text-4xl font-bold text-[#1a202c]">{stats.served}</span>
            <span className="text-xs text-[#64748b] font-medium block mt-2">Consultations completed</span>
          </div>

          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">No-Shows</span>
              <div className="h-8 w-8 bg-red-50 text-red-600 rounded flex items-center justify-center"><AlertTriangle className="h-4 w-4" /></div>
            </div>
            <span className="text-4xl font-bold text-[#1a202c]">{stats.noshow}</span>
            <span className="text-xs text-[#64748b] font-medium block mt-2">Tokens skipped/missed</span>
          </div>
        </div>

        {/* Revenue Overview */}
        {revenueData && (
          <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs">
            <h3 className="font-bold text-[#1a202c] mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#01696f]" /> Revenue Overview
            </h3>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 bg-[#fbfbfa] rounded-lg border border-[#e9e9e7]">
                <span className="text-2xl font-bold text-[#01696f]">₹{revenueData.todayRevenue?.toLocaleString('en-IN') || 0}</span>
                <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider mt-1">Today</p>
              </div>
              <div className="text-center p-4 bg-[#fbfbfa] rounded-lg border border-[#e9e9e7]">
                <span className="text-2xl font-bold text-[#1a202c]">₹{revenueData.weekRevenue?.toLocaleString('en-IN') || 0}</span>
                <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider mt-1">This Week</p>
              </div>
              <div className="text-center p-4 bg-[#fbfbfa] rounded-lg border border-[#e9e9e7]">
                <span className="text-2xl font-bold text-[#1a202c]">₹{revenueData.monthRevenue?.toLocaleString('en-IN') || 0}</span>
                <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider mt-1">This Month</p>
              </div>
            </div>
            {revenueData.dailyRevenue && revenueData.dailyRevenue.length > 0 && (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={revenueData.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => '₹' + v} />
                  <RechartsTooltip formatter={(v: any) => ['₹' + v, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#01696f" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {revenueData.todayTransactions?.length > 0 && (
              <div className="mt-4 border-t border-[#e9e9e7] pt-4">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Today's Transactions</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {revenueData.todayTransactions.map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[#f4f4f3]">
                      <div>
                        <span className="font-semibold text-[#1a202c]">{t.patientName}</span>
                        <span className="text-[#64748b] ml-2 font-mono">{t.tokenNo}</span>
                      </div>
                      <span className="font-bold text-[#01696f]">₹{t.consultationFee}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Volume Chart */}
          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <h3 className="font-bold text-[#1a202c] mb-6 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#01696f]" /> 7-Day Patient Volume
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e9e7" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#fbfbfa' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e9e9e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#01696f" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Wait Time Trend */}
          <div className="bg-white border border-[#e9e9e7] p-6 rounded-xl shadow-xs">
            <h3 className="font-bold text-[#1a202c] mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> Avg Wait Time Trend (Mins)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={waitTimeData}>
                  <defs>
                    <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e9e7" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e9e9e7' }} />
                  <Area type="monotone" dataKey="waitMinutes" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorWait)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Doctor Performance & AI Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Doctor Performance */}
          <div className="lg:col-span-2 bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
              <h3 className="font-bold text-[#1a202c] flex items-center gap-2">
                <User className="h-5 w-5 text-[#01696f]" /> Doctor Efficiency Report
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white border-b border-[#e9e9e7] text-xs uppercase font-bold text-[#64748b]">
                  <tr>
                    <th className="px-6 py-4">Doctor</th>
                    <th className="px-6 py-4">Avg Consult (Mins)</th>
                    <th className="px-6 py-4">Patients Served</th>
                    <th className="px-6 py-4 text-right">No-Show Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9e9e7]">
                  {doctorPerformance.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-[#64748b]">No active doctors found.</td></tr>
                  ) : (
                    doctorPerformance.map((doc: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#fbfbfa] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-[#1a202c]">{doc.name}</p>
                          <p className="text-[10px] text-[#64748b] font-medium uppercase tracking-wider mt-0.5">{doc.speciality}</p>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-[#01696f]">{doc.avgConsultationTime}m</td>
                        <td className="px-6 py-4 font-bold text-[#1a202c]">{doc.servedCount}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2 py-1 rounded font-bold text-xs ${doc.noShowRate > 15 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {doc.noShowRate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Symptom Outbreak Detector */}
          <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-5 border-b border-[#e9e9e7] flex items-center gap-2 bg-[#fbfbfa]">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h3 className="font-bold text-base text-[#1a202c]">Symptom Outbreak Detector</h3>
            </div>
            <div className="p-4">
              <AIOutbreakAlert clinicId={clinicId} />
            </div>
          </div>

          {/* AI Insights Copilot */}
          <div className="bg-white border border-[#e9e9e7] text-[#1a202c] rounded-xl shadow-xs flex flex-col overflow-hidden relative">
            <div className="px-6 py-5 border-b border-[#e9e9e7] flex items-center gap-2 bg-[#fbfbfa]">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-serif font-bold text-lg text-[#01696f]">CureQ AI Copilot</h3>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto mb-4 min-h-[150px]">
                {isAsking ? (
                  <div className="h-full flex flex-col justify-center items-center text-[#64748b] animate-pulse">
                    <Sparkles className="h-8 w-8 mb-2 text-[#01696f]" />
                    <p className="text-xs uppercase tracking-widest font-semibold">Analyzing Clinic Data...</p>
                  </div>
                ) : aiResponse ? (
                  <div className="bg-[#fbfbfa] p-4 rounded-lg border border-[#e9e9e7]">
                    <p className="text-sm font-light text-[#1a202c] leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center text-center">
                    <p className="text-sm text-[#64748b] font-light leading-relaxed">
                      Ask me anything about your clinic's performance. E.g., "Why is the wait time high on Tuesdays?" or "Who is my fastest doctor?"
                    </p>
                  </div>
                )}
              </div>
              
              <form onSubmit={handleAskAI} className="relative">
                <input 
                  type="text" 
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md py-3 pl-4 pr-12 text-sm text-[#1a202c] placeholder:text-gray-400 focus:outline-none focus:border-[#01696f] focus:bg-white transition-colors"
                />
                <button 
                  type="submit" disabled={isAsking || !aiQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#01696f] text-white rounded cursor-pointer hover:bg-[#005459] disabled:opacity-50 transition-colors"
                  aria-label="Submit AI question"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

        </div>

        {/* Peak Hours Heatmap */}
        {heatmap && heatmap.length > 0 && (
          <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
              <h3 className="font-bold text-[#1a202c] flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#01696f]" /> Peak Hours Heatmap (Last 30 Days)
              </h3>
              <p className="text-xs text-[#64748b] mt-1">Darker green = more patients registered during that hour.</p>
            </div>
            <div className="p-6 overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Column headers - days */}
                <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${heatmapDays.length}, 1fr)` }}>
                  <div></div>
                  {heatmapDays.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{d}</div>
                  ))}
                </div>
                {/* Rows - hours */}
                {heatmapHours.map(hour => (
                  <div key={hour} className="grid gap-1 mb-1" style={{ gridTemplateColumns: `80px repeat(${heatmapDays.length}, 1fr)` }}>
                    <div className="text-[10px] text-[#64748b] font-medium flex items-center pr-2">{hour}</div>
                    {heatmapDays.map(day => {
                      const cell = heatmap.find((c: any) => c.day === day && c.hour === hour);
                      const count = cell?.count || 0;
                      const intensity = count / maxHeatCount;
                      return (
                        <div
                          key={day}
                          title={`${day} ${hour}: ${count} patients`}
                          className="h-8 rounded-sm flex items-center justify-center text-[9px] font-bold transition-colors cursor-default"
                          style={{
                            backgroundColor: count === 0
                              ? '#f4f4f3'
                              : intensity < 0.25 ? '#b2dfdb'
                              : intensity < 0.5  ? '#4db6ac'
                              : intensity < 0.75 ? '#00897b'
                              : '#004d40',
                            color: intensity > 0.45 ? 'white' : '#004d40',
                          }}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-4 justify-end">
                  <span className="text-[10px] text-[#64748b]">Low</span>
                  {['#b2dfdb','#4db6ac','#00897b','#006064','#004d40'].map(c => (
                    <div key={c} className="h-4 w-6 rounded-sm" style={{ backgroundColor: c }}></div>
                  ))}
                  <span className="text-[10px] text-[#64748b]">High</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>
    </div>
  );
}
