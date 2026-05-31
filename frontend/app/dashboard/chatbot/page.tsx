'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { apiRequest } from '../../../src/utils/api';
import { useClerkSync } from '../../../src/utils/useClerkSync';
import { useToast } from '../../../src/components/Toast';
import UserGuide from '../../../src/components/UserGuide';
import {
  MessageCircle, Bot, Plus, Trash, Save, ArrowLeft, Activity,
  Loader2, CheckCircle2, Globe, Zap, Lock, MessageSquare, ChevronDown, ChevronRight, X,
  LayoutDashboard, Users, Settings, Calendar, Search, LogOut, Receipt,
  Share2, Copy, Code
} from 'lucide-react';

interface FAQPair { question: string; answer: string }
interface ChatConfig {
  botName: string;
  greeting: string;
  systemPromptExt: string;
  primaryColor: string;
  language: string;
  faqPairs: FAQPair[];
  enableQueueStatus: boolean;
  enableBooking: boolean;
  enableTriage: boolean;
  enablePrescriptionHistory: boolean;
  widgetPosition: string;
  isActive: boolean;
}

interface ChatSession {
  id: string;
  userRole: string;
  patientPhone: string | null;
  createdAt: string;
  updatedAt: string;
  messages: { content: string; role: string; createdAt: string }[];
}

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect (recommended)' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिंदी)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
  { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
];

const DEFAULT_CONFIG: ChatConfig = {
  botName: 'CureQ Assistant', greeting: 'Hello! 👋 How can I help you today?',
  systemPromptExt: '', primaryColor: '#01696f', language: 'auto', faqPairs: [],
  enableQueueStatus: true, enableBooking: true, enableTriage: true,
  enablePrescriptionHistory: false, widgetPosition: 'bottom-right', isActive: true,
};

export default function ChatbotConfigurator() {
  const { syncing, isSignedIn } = useClerkSync();
  const { user } = useUser();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();

  const [clinicId, setClinicId] = useState('');
  const [activeTab, setActiveTab] = useState<'configure' | 'history'>('configure');
  const [config, setConfig] = useState<ChatConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // FAQ editor state
  const [newFAQ, setNewFAQ] = useState({ question: '', answer: '' });
  const [showFAQForm, setShowFAQForm] = useState(false);

  // Share & embed panel
  const [showShare, setShowShare] = useState(true);

  // Chat history
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionPage, setSessionPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Record<string, any[]>>({});
  const [phoneFilter, setPhoneFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Live preview state
  const [previewMsg, setPreviewMsg] = useState('');
  const [previewThread, setPreviewThread] = useState([
    { role: 'assistant', content: '' },
  ]);

  useEffect(() => {
    if (!syncing && !isSignedIn) router.replace('/login');
  }, [syncing, isSignedIn, router]);

  useEffect(() => {
    const cId = localStorage.getItem('cureq_clinic_id') || '';
    setClinicId(cId);
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    apiRequest(`/chatbot/${clinicId}/config/full`)
      .then(data => setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [clinicId]);

  useEffect(() => {
    setPreviewThread([{ role: 'assistant', content: config.greeting || 'Hello! How can I help you today?' }]);
  }, [config.greeting]);

  const handleSave = async () => {
    if (!clinicId) return;
    setIsSaving(true);
    try {
      await apiRequest(`/chatbot/${clinicId}/config`, { method: 'PUT', body: JSON.stringify(config) });
      showToast('Chatbot configuration saved!', 'success');
    } catch {
      showToast('Failed to save configuration.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addFAQ = () => {
    if (!newFAQ.question.trim() || !newFAQ.answer.trim()) { showToast('Both question and answer are required.', 'error'); return; }
    setConfig(c => ({ ...c, faqPairs: [...c.faqPairs, { ...newFAQ }] }));
    setNewFAQ({ question: '', answer: '' });
    setShowFAQForm(false);
  };

  const removeFAQ = (idx: number) => setConfig(c => ({ ...c, faqPairs: c.faqPairs.filter((_, i) => i !== idx) }));

  const toggle = (key: keyof ChatConfig) => setConfig(c => ({ ...c, [key]: !c[key] }));

  const fetchSessions = async () => {
    if (!clinicId) return;
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(sessionPage) });
      if (phoneFilter) params.set('phone', phoneFilter);
      if (dateFilter) params.set('date', dateFilter);
      const data = await apiRequest(`/chatbot/${clinicId}/sessions?${params}`);
      setSessions(data.sessions || []);
      setTotalPages(data.pages || 1);
    } catch { showToast('Failed to load chat history.', 'error'); }
    finally { setSessionsLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'history' && clinicId) fetchSessions();
  }, [activeTab, clinicId, sessionPage]);

  const loadMessages = async (sessionId: string) => {
    if (sessionMessages[sessionId]) { setExpandedSession(expandedSession === sessionId ? null : sessionId); return; }
    try {
      const data = await apiRequest(`/chatbot/session/${sessionId}/messages`);
      setSessionMessages(prev => ({ ...prev, [sessionId]: data }));
      setExpandedSession(sessionId);
    } catch { showToast('Failed to load messages.', 'error'); }
  };

  const ToggleSwitch = ({ enabled, onToggle, label, description, locked }: any) => (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-[#1a202c] flex items-center gap-1.5">
          {label} {locked && <Lock className="h-3 w-3 text-[#9ca3af]" />}
        </p>
        {description && <p className="text-[11px] text-[#64748b] mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={locked ? undefined : onToggle} disabled={locked}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-[#01696f]' : 'bg-[#e9e9e7]'} ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-[#01696f] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] font-sans flex flex-col md:flex-row selection:bg-[#01696f]/20">
      {ToastComponent}
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
            <Link href="/dashboard/billing" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Receipt className="h-4 w-4" /> Billing
            </Link>
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm bg-[#f4f4f3] text-[#01696f]">
              <MessageCircle className="h-4 w-4" /> AI Chatbot
            </div>
            <Link href="/dashboard/analytics" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Activity className="h-4 w-4" /> Analytics
            </Link>
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
        <header className="bg-white border-b border-[#e9e9e7] px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-xs">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#01696f]" />
          <span className="font-serif text-lg font-bold tracking-tight">CureQ</span>
          <span className="text-[#e9e9e7] mx-1">/</span>
          <MessageCircle className="h-4 w-4 text-[#64748b]" />
          <span className="font-semibold text-[#64748b] text-sm">AI Chatbot</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-[#64748b]">{config.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <button onClick={handleSave} disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-[#01696f] text-white rounded-lg text-sm font-semibold hover:bg-[#015a5f] disabled:opacity-60 transition-colors">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e9e9e7] px-6">
        <div className="flex gap-0">
          {[{ id: 'configure', label: 'Configure', icon: Bot }, { id: 'history', label: 'Chat History', icon: MessageSquare }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? 'border-[#01696f] text-[#01696f]' : 'border-transparent text-[#64748b] hover:text-[#1a202c]'}`}>
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">

        {/* ── CONFIGURE TAB ── */}
        {activeTab === 'configure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — Editor */}
            <div className="lg:col-span-2 space-y-5">

              {/* Branding */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
                <h2 className="font-bold text-[#1a202c] mb-4 flex items-center gap-2"><Bot className="h-4 w-4 text-[#01696f]" /> Branding & Identity</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Bot Name</label>
                    <input value={config.botName || ''} onChange={e => setConfig(c => ({ ...c, botName: e.target.value }))} placeholder="e.g. HealthBot, Dr. Helper"
                      className="w-full px-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Greeting Message</label>
                    <textarea value={config.greeting || ''} onChange={e => setConfig(c => ({ ...c, greeting: e.target.value }))} rows={3}
                      placeholder="Hello! How can I help you today?"
                      className="w-full px-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Brand Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={config.primaryColor || ''} onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))}
                          className="h-10 w-12 rounded border border-[#e9e9e7] cursor-pointer p-0.5" />
                        <input value={config.primaryColor || ''} onChange={e => setConfig(c => ({ ...c, primaryColor: e.target.value }))} placeholder="#01696f"
                          className="flex-1 px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm font-mono focus:outline-none focus:border-[#01696f]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Widget Position</label>
                      <select value={config.widgetPosition || ''} onChange={e => setConfig(c => ({ ...c, widgetPosition: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] bg-white appearance-none">
                        <option value="bottom-right">Bottom Right</option>
                        <option value="bottom-left">Bottom Left</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Language */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
                <h2 className="font-bold text-[#1a202c] mb-4 flex items-center gap-2"><Globe className="h-4 w-4 text-[#01696f]" /> Language</h2>
                <select value={config.language || ''} onChange={e => setConfig(c => ({ ...c, language: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] bg-white appearance-none">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <p className="text-[11px] text-[#64748b] mt-2">Auto-detect responds in the patient's language — ideal for multilingual clinics.</p>
              </div>

              {/* Feature Toggles */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
                <h2 className="font-bold text-[#1a202c] mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-[#01696f]" /> Feature Toggles</h2>
                <div className="space-y-4">
                  <ToggleSwitch enabled={config.isActive} onToggle={() => toggle('isActive')} label="Chatbot Active" description="When off, the chat bubble is hidden from all pages." />
                  <div className="border-t border-[#f4f4f3] pt-4 space-y-4">
                    <ToggleSwitch enabled={config.enableQueueStatus} onToggle={() => toggle('enableQueueStatus')} label="Queue Status" description="Patients can ask 'What's the wait time?' and 'What's my token?'" />
                    <ToggleSwitch enabled={config.enableBooking} onToggle={() => toggle('enableBooking')} label="Appointment Booking" description="Bot can book and cancel appointments through chat." />
                    <ToggleSwitch enabled={config.enableTriage} onToggle={() => toggle('enableTriage')} label="Symptom Triage" description="AI assesses urgency and recommends care level before visit." />
                    <ToggleSwitch enabled={config.enablePrescriptionHistory} onToggle={() => toggle('enablePrescriptionHistory')} label="Prescription History" description="Patients can ask for their last visit summary. Ideal for dispensaries." />
                  </div>
                </div>
              </div>

              {/* FAQ Editor */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-[#1a202c] flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#01696f]" /> Clinic FAQ</h2>
                  <button onClick={() => setShowFAQForm(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#01696f] hover:underline">
                    <Plus className="h-3.5 w-3.5" /> Add FAQ
                  </button>
                </div>

                {showFAQForm && (
                  <div className="mb-4 p-3 bg-[#f9f9f8] border border-[#e9e9e7] rounded-lg space-y-2">
                    <input value={newFAQ.question} onChange={e => setNewFAQ(f => ({ ...f, question: e.target.value }))} placeholder="Question e.g. What are your clinic hours?"
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                    <textarea value={newFAQ.answer} onChange={e => setNewFAQ(f => ({ ...f, answer: e.target.value }))} placeholder="Answer the bot will give..." rows={2}
                      className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] resize-none" />
                    <div className="flex gap-2">
                      <button onClick={addFAQ} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#01696f] text-white rounded-lg text-xs font-semibold hover:bg-[#015a5f]"><CheckCircle2 className="h-3.5 w-3.5" /> Add</button>
                      <button onClick={() => setShowFAQForm(false)} className="px-3 py-1.5 border border-[#e9e9e7] rounded-lg text-xs font-semibold text-[#64748b] hover:bg-[#f4f4f3]">Cancel</button>
                    </div>
                  </div>
                )}

                {config.faqPairs.length === 0 ? (
                  <p className="text-sm text-[#9ca3af] italic">No FAQs yet. Add common questions patients ask — the bot will use these to answer instantly without calling the AI.</p>
                ) : (
                  <div className="space-y-2">
                    {config.faqPairs.map((faq, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1a202c] truncate">Q: {faq.question}</p>
                          <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">A: {faq.answer}</p>
                        </div>
                        <button onClick={() => removeFAQ(idx)} className="p-1.5 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 shadow-xs">
                <h2 className="font-bold text-[#1a202c] mb-2">Advanced — Custom Instructions</h2>
                <p className="text-[11px] text-[#64748b] mb-3">Add clinic-specific personality or constraints. Examples: "This is a paediatric-only clinic." / "We charge ₹300 for consultations." / "Do not discuss dental procedures."</p>
                <textarea value={config.systemPromptExt || ''} onChange={e => setConfig(c => ({ ...c, systemPromptExt: e.target.value }))} rows={4}
                  placeholder="e.g. Our clinic specialises in diabetic care. Always mention that patients with diabetes should bring their blood sugar logs."
                  className="w-full px-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] resize-none" />
              </div>
            </div>

            {/* Right — Share + Live Preview */}
            <div className="space-y-4">

              {/* Share & Embed — collapsible, at top of right column */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
                <button
                  onClick={() => setShowShare(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#fbfbfa] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-[#01696f]" />
                    <span className="text-sm font-bold text-[#1a202c]">Share & Embed Chatbot</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-semibold">Ready to share</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-[#64748b] transition-transform duration-200 ${showShare ? 'rotate-180' : ''}`} />
                </button>

                {showShare && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#e9e9e7] space-y-3">
                    <p className="text-[11px] text-[#64748b] pt-2">
                      Share this link with patients or embed the chatbot on your clinic website — no login needed.
                    </p>

                    {/* Direct link */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Patient Chat Link</label>
                      <div className="flex gap-1.5">
                        <input
                          readOnly
                          value={typeof window !== 'undefined' ? `${window.location.origin}/chat/${clinicId}` : ''}
                          className="flex-1 px-2.5 py-1.5 border border-[#e9e9e7] bg-[#fbfbfa] rounded-lg text-[11px] font-mono focus:outline-none min-w-0"
                        />
                        <button
                          onClick={() => { if (typeof window !== 'undefined') window.open(`${window.location.origin}/chat/${clinicId}`, '_blank'); }}
                          className="shrink-0 px-2.5 py-1.5 bg-[#01696f] text-white rounded-lg text-[11px] font-semibold hover:bg-[#015a5f] transition-colors"
                        >Open</button>
                        <button
                          onClick={() => { if (typeof window !== 'undefined') { navigator.clipboard.writeText(`${window.location.origin}/chat/${clinicId}`); showToast('Link copied!', 'success'); } }}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-[#f4f4f3] hover:bg-[#e9e9e7] border border-[#e9e9e7] rounded-lg text-[11px] font-semibold transition-colors"
                        ><Copy className="h-3 w-3" /> Copy</button>
                      </div>
                    </div>

                    {/* Embed snippet */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Website Embed (iframe)</label>
                      <div className="flex gap-1.5">
                        <input
                          readOnly
                          value={typeof window !== 'undefined' ? `<iframe src="${window.location.origin}/chat/${clinicId}" style="border:none;position:fixed;bottom:0;right:0;width:420px;height:680px;z-index:99999;border-radius:16px;" title="AI Health Assistant"></iframe>` : ''}
                          className="flex-1 px-2.5 py-1.5 border border-[#e9e9e7] bg-[#fbfbfa] rounded-lg text-[11px] font-mono focus:outline-none min-w-0"
                        />
                        <button
                          onClick={() => { if (typeof window !== 'undefined') { navigator.clipboard.writeText(`<iframe src="${window.location.origin}/chat/${clinicId}" style="border:none;position:fixed;bottom:0;right:0;width:420px;height:680px;z-index:99999;border-radius:16px;" title="AI Health Assistant"></iframe>`); showToast('Embed snippet copied!', 'success'); } }}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-[#f4f4f3] hover:bg-[#e9e9e7] border border-[#e9e9e7] rounded-lg text-[11px] font-semibold transition-colors"
                        ><Code className="h-3 w-3" /> Copy</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden sticky top-24">
                <div className="px-4 py-3 border-b border-[#e9e9e7]">
                  <p className="text-sm font-bold text-[#1a202c]">Live Preview</p>
                  <p className="text-[11px] text-[#64748b]">How your widget will look</p>
                </div>
                {/* Simulated chat window */}
                <div className="bg-[#fbfbfa] p-3 h-80 flex flex-col overflow-hidden">
                  <div className="rounded-t-xl overflow-hidden mb-2" style={{ background: config.primaryColor }}>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-xs">{config.botName || 'CureQ Assistant'}</p>
                        <p className="text-white/70 text-[9px]">● Online</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 overflow-hidden">
                    <div className="flex items-end gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: config.primaryColor }}>
                        <Bot className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div className="bg-white border border-[#e9e9e7] rounded-2xl rounded-bl-sm px-2.5 py-1.5 max-w-[85%] shadow-xs">
                        <p className="text-[11px] text-[#1a202c] leading-relaxed">{config.greeting || 'Hello! How can I help you today?'}</p>
                      </div>
                    </div>
                    <div className="flex flex-row-reverse items-end gap-1.5">
                      <div className="rounded-2xl rounded-br-sm px-2.5 py-1.5 max-w-[80%]" style={{ background: config.primaryColor }}>
                        <p className="text-[11px] text-white">What is the wait time?</p>
                      </div>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: config.primaryColor }}>
                        <Bot className="h-2.5 w-2.5 text-white" />
                      </div>
                      <div className="bg-white border border-[#e9e9e7] rounded-2xl rounded-bl-sm px-2.5 py-1.5 max-w-[85%] shadow-xs">
                        <p className="text-[11px] text-[#1a202c]">There are currently 4 patients waiting. Estimated wait: ~20 minutes.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white border border-[#e9e9e7] rounded-xl px-2.5 py-1.5 mt-2">
                    <span className="text-[11px] text-[#9ca3af] flex-1">Type a message...</span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: config.primaryColor }}>
                      <span className="text-white text-[10px]">→</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-[#e9e9e7] space-y-2">
                  <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">Active Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.enableQueueStatus && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-medium">Queue</span>}
                    {config.enableBooking && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-medium">Booking</span>}
                    {config.enableTriage && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3f4] text-[#01696f] font-medium">Triage</span>}
                    {config.enablePrescriptionHistory && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium">Rx History</span>}
                    {!config.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">INACTIVE</span>}
                  </div>
                  <p className="text-[10px] text-[#9ca3af]">Language: {LANGUAGES.find(l => l.value === config.language)?.label || config.language}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Filter by Phone</label>
                <input value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} placeholder="9876543210"
                  className="px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">Date</label>
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
              </div>
              <button onClick={fetchSessions} className="flex items-center gap-1.5 px-4 py-2 bg-[#01696f] text-white rounded-lg text-sm font-semibold hover:bg-[#015a5f]">
                {sessionsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </button>
              {(phoneFilter || dateFilter) && (
                <button onClick={() => { setPhoneFilter(''); setDateFilter(''); }} className="text-xs text-[#64748b] hover:underline flex items-center gap-1"><X className="h-3 w-3" /> Clear</button>
              )}
            </div>

            <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-[#01696f] animate-spin" /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-16 text-[#64748b]">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">No chat sessions found</p>
                  <p className="text-xs mt-1">Conversations will appear here once patients start chatting.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#f4f4f3]">
                  {sessions.map(session => (
                    <div key={session.id}>
                      <button onClick={() => loadMessages(session.id)} className="w-full flex items-start gap-3 px-5 py-4 hover:bg-[#fbfbfa] transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-[#e6f3f4] flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-[#01696f]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${session.userRole === 'staff' ? 'bg-purple-50 text-purple-700' : 'bg-[#e6f3f4] text-[#01696f]'}`}>
                              {session.userRole}
                            </span>
                            {session.patientPhone && <span className="text-[11px] text-[#64748b]">{session.patientPhone}</span>}
                          </div>
                          <p className="text-sm text-[#64748b] truncate">
                            {session.messages[0]?.content || 'No messages'}
                          </p>
                          <p className="text-[10px] text-[#9ca3af] mt-0.5">{new Date(session.updatedAt).toLocaleString('en-IN')}</p>
                        </div>
                        {expandedSession === session.id ? <ChevronDown className="h-4 w-4 text-[#9ca3af] shrink-0 mt-1" /> : <ChevronRight className="h-4 w-4 text-[#9ca3af] shrink-0 mt-1" />}
                      </button>

                      {expandedSession === session.id && sessionMessages[session.id] && (
                        <div className="bg-[#fbfbfa] border-t border-[#f4f4f3] px-5 py-4 space-y-3">
                          {sessionMessages[session.id].map((msg: any) => (
                            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user' ? 'bg-[#01696f] text-white rounded-br-sm' : 'bg-white border border-[#e9e9e7] text-[#1a202c] rounded-bl-sm'}`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button disabled={sessionPage <= 1} onClick={() => setSessionPage(p => p - 1)} className="px-3 py-1.5 text-xs font-semibold border border-[#e9e9e7] rounded-lg disabled:opacity-40 hover:bg-[#f4f4f3]">← Prev</button>
                <span className="text-xs text-[#64748b]">Page {sessionPage} of {totalPages}</span>
                <button disabled={sessionPage >= totalPages} onClick={() => setSessionPage(p => p + 1)} className="px-3 py-1.5 text-xs font-semibold border border-[#e9e9e7] rounded-lg disabled:opacity-40 hover:bg-[#f4f4f3]">Next →</button>
              </div>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
