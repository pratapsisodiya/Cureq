'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest, API_URL } from '../../../src/utils/api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Activity, Users, Clock, AlertTriangle, TrendingUp, Download, Sparkles, User, Calendar, ArrowRight
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const [clinicId, setClinicId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAsking, setIsAsking] = useState(false);

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
    try {
      const res = await apiRequest(`/analytics/${clinicId}/query`, {
        method: 'POST',
        body: JSON.stringify({ question: aiQuery })
      });
      setAiResponse(res.analysis);
    } catch (err) {
      setAiResponse('Error reaching CureQ AI Engine. Please try again later.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!clinicId) return;
    window.location.href = `${API_URL}/analytics/${clinicId}/report`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#01696f] animate-pulse">
          <Activity className="h-10 w-10" />
          <p className="text-sm font-semibold uppercase tracking-widest">Aggregating Clinic Data</p>
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

  const { stats, volumeData, waitTimeData, doctorPerformance } = data;

  return (
    <div className="min-h-screen bg-[#fbfbfa] font-sans selection:bg-[#01696f]/20">
      
      {/* Header */}
      <header className="bg-white border-b border-[#e9e9e7] px-8 py-5 sticky top-0 z-20 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <div>
            <h1 className="font-serif font-bold text-xl leading-tight text-[#1a202c]">Clinic Command Center</h1>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Business Intelligence Dashboard</p>
          </div>
        </div>
        <button 
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-[#e9e9e7] text-[#1a202c] rounded-md text-sm font-bold shadow-xs hover:bg-[#f4f4f3] transition-colors cursor-pointer"
        >
          <Download className="h-4 w-4" /> Export CSV Report
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8">
        
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

          {/* AI Insights Copilot */}
          <div className="bg-[#111e20] text-white rounded-xl shadow-xl flex flex-col overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 bg-[#01696f]/20 blur-3xl rounded-full"></div>
            
            <div className="px-6 py-5 border-b border-[#1c2e31] relative z-10 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <h3 className="font-serif font-bold text-lg">CureQ AI Copilot</h3>
            </div>
            
            <div className="p-6 flex-1 flex flex-col relative z-10">
              <div className="flex-1 overflow-y-auto mb-4 min-h-[150px]">
                {isAsking ? (
                  <div className="h-full flex flex-col justify-center items-center text-[#64748b] animate-pulse">
                    <Sparkles className="h-8 w-8 mb-2 text-[#01696f]" />
                    <p className="text-xs uppercase tracking-widest font-semibold">Analyzing Clinic Data...</p>
                  </div>
                ) : aiResponse ? (
                  <div className="bg-[#0d1516] p-4 rounded-lg border border-[#1c2e31]">
                    <p className="text-sm font-light text-gray-300 leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center text-center">
                    <p className="text-sm text-gray-400 font-light leading-relaxed">
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
                  className="w-full bg-[#0d1516] border border-[#1c2e31] rounded-md py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#01696f] transition-colors"
                />
                <button 
                  type="submit" disabled={isAsking || !aiQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#01696f] text-white rounded cursor-pointer hover:bg-[#005459] disabled:opacity-50 transition-colors"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
