'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle, X, ChevronRight, ChevronLeft, Search, CheckCircle2,
  Users, Stethoscope, BarChart2, Tv, Smartphone, Brain, Printer,
  Zap, Bell, Calendar, Shield, Settings, BookOpen, Clock, UserPlus,
  Star, MessageSquare, AlertTriangle, Activity
} from 'lucide-react';

interface GuideStep {
  title: string;
  description: string;
  tip?: string;
}

interface GuideChapter {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  badge: string;
  steps: GuideStep[];
}

const CHAPTERS: GuideChapter[] = [
  {
    id: 'overview',
    title: 'Getting Started',
    icon: BookOpen,
    color: 'text-[#01696f]',
    badge: 'bg-[#e6f3f4] text-[#01696f]',
    steps: [
      {
        title: 'Welcome to CureQ',
        description: 'CureQ is an AI-powered clinic management platform. It handles your patient queue, doctor consultations, appointment bookings, real-time analytics, and smart waiting room displays — all in one place.',
        tip: 'CureQ works best on desktop for reception and doctor consoles, but is fully installable as a mobile app.',
      },
      {
        title: 'Onboarding Your Clinic',
        description: 'On first login, you\'ll go through a 3-step setup wizard: create your admin profile, add clinic details and specialities, then onboard your doctors with their schedules. This takes about 5 minutes.',
        tip: 'You can add more doctors anytime from the Reception Dashboard using the "Add Doctor" button.',
      },
      {
        title: 'User Roles',
        description: 'CureQ has 4 roles: Clinic Admin (full access), Receptionist (queue + walk-ins + notifications), Doctor (consultation console + patient history), and Patient (mobile token tracking + medical records).',
        tip: 'Each doctor gets their own login credentials created during onboarding. Share them securely.',
      },
      {
        title: 'Navigation',
        description: 'The sidebar gives you access to Dashboard (stats overview), Reception, Doctor Console, and Analytics. The top bar shows your clinic name, active doctor, and quick actions.',
        tip: 'Use the keyboard shortcut guides visible on hover throughout the app.',
      },
    ],
  },
  {
    id: 'reception',
    title: 'Reception Dashboard',
    icon: Users,
    color: 'text-blue-600',
    badge: 'bg-blue-50 text-blue-700',
    steps: [
      {
        title: 'Walk-in Token Registration',
        description: 'Search a patient by phone number — if they exist, their details auto-fill. Set the urgency level (General / Priority / Emergency), visit type, and chief complaint. Click "Issue Token" to add them to the queue and print their slip.',
        tip: 'Type the 10-digit phone number and the system auto-searches after all digits are entered.',
      },
      {
        title: 'AI Triage Button',
        description: 'After entering the chief complaint, click "AI Triage" to let the AI analyze symptoms and automatically set the urgency level and suggest which doctor\'s specialty to route to. The AI shows its reasoning so you can override if needed.',
        tip: 'Works offline too — uses keyword-based heuristics when no internet is available.',
      },
      {
        title: 'Active Queue Management',
        description: 'The queue table shows all waiting patients with their token number, urgency badge, estimated wait time, seat status (Seated / Waiting Outside), and no-show risk indicator. Use the up/down arrows to reprioritize any patient.',
        tip: 'Emergency tokens automatically jump to the front of the queue.',
      },
      {
        title: 'No-Show Risk Badges',
        description: '"High Risk" (red) and "Med Risk" (amber) badges automatically appear on patients based on their historical no-show rate, time of day, and day of week. Follow up with high-risk patients proactively.',
        tip: 'Badges load silently in the background — no action needed from you.',
      },
      {
        title: 'Doctor Selector & Workload Balance',
        description: 'Use the doctor dropdown to switch between doctors\' queues. If one doctor has 4+ more patients than another, an orange alert banner appears recommending you route the next walk-in to the less-busy doctor.',
        tip: 'Click "Route Here" on the alert banner to instantly switch the active doctor selection.',
      },
      {
        title: 'Waitlist & All Queues Tabs',
        description: 'The "Waitlist" tab shows patients who pre-registered online for a future date — convert them to tokens with one click. "All Queues" shows every doctor\'s active patients at a glance for full clinic oversight.',
        tip: 'Filter the waitlist by date using the date picker at the top.',
      },
      {
        title: 'Seat Management',
        description: 'Set the physical waiting room seat count in Settings. The system automatically tracks who is physically seated vs. waiting outside and shows a seat availability indicator when issuing new tokens.',
      },
      {
        title: 'Notification Logs',
        description: 'Every SMS and WhatsApp notification sent to patients is logged. Click the bell icon to view delivery status, timestamps, and message content for any patient.',
      },
    ],
  },
  {
    id: 'doctor',
    title: 'Doctor Console',
    icon: Stethoscope,
    color: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700',
    steps: [
      {
        title: 'Your Live Queue',
        description: 'Your dashboard shows all patients currently waiting — token number, name, urgency type, chief complaint, and how long they\'ve been waiting. The patient currently in consultation is highlighted in teal.',
        tip: 'Patient wait times update automatically via live WebSocket connection.',
      },
      {
        title: 'AI Patient Brief',
        description: 'When a patient enters consultation, an AI-generated briefing card automatically appears showing their last 6 months of visit history: known conditions, last diagnosis, prior medications, and any red-flag alerts.',
        tip: 'Click the card header to collapse it if you don\'t need it for this session.',
      },
      {
        title: 'Call Next Patient',
        description: 'Click "Call Next" to bring in the next patient. This changes their token status to IN_CONSULTATION, starts the consultation timer, triggers the waiting room TV display to update, and sends the patient an SMS/WhatsApp alert.',
        tip: 'The consultation timer turns amber at 15 minutes and red at 30 minutes.',
      },
      {
        title: 'Voice Dictation',
        description: 'Click the microphone icon next to the notes area to dictate consultation notes using your voice. The app uses your browser\'s Speech API — speak clearly and your words appear in real time.',
        tip: 'Works in Chrome and Edge. Firefox has limited support. Speak in English for best accuracy.',
      },
      {
        title: 'Prescription Templates',
        description: 'Click "Templates" to see pre-built prescription phrases for your specialty (e.g. "Tab. Paracetamol 500mg TDS × 5 days"). Click any template to insert it instantly into the notes field.',
        tip: 'Templates are organized by specialty and update when you switch doctor profiles.',
      },
      {
        title: 'AI SOAP Note Structurer',
        description: 'After dictating raw notes, click "AI Structure" to automatically convert them into the standard SOAP clinical format (Subjective / Objective / Assessment / Plan). Review the result and click "Apply to Notes" to use it.',
        tip: 'SOAP notes are the standard for medical record documentation and legal compliance.',
      },
      {
        title: 'AI Follow-up Message',
        description: 'Click "Follow-up Msg" to generate a patient-friendly WhatsApp/SMS discharge message from your consultation notes. The AI translates medical language into simple instructions the patient can follow.',
        tip: 'Copy the message and paste it into WhatsApp Web for instant patient communication.',
      },
      {
        title: 'Break Mode & Availability',
        description: 'Click "Break" to set a break with estimated return time. The waiting room TV display automatically shows "Dr. X — On Break, Back at 3:30 PM". Toggle "Unavailable" to block yourself for the full day.',
        tip: 'Reception gets a notification when you go on/return from break.',
      },
      {
        title: 'Patient Medical History',
        description: 'Click "Medical History" next to any patient\'s name to view their complete visit log — every consultation, complaint, notes, and prescription in chronological order.',
      },
      {
        title: 'Follow-up Scheduling',
        description: 'Use the Follow-up Date picker before clicking "Call Next" to schedule the patient\'s next appointment. It automatically creates a booking in the appointments system.',
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI Features',
    icon: Brain,
    color: 'text-purple-600',
    badge: 'bg-purple-50 text-purple-700',
    steps: [
      {
        title: 'Smart Wait Time Predictor',
        description: 'CureQ calculates each patient\'s estimated wait time using your clinic\'s last 30 days of consultation data. It applies behavioral heuristics: Monday blues (+20%), post-lunch boost (-15%), evening fatigue (+10%).',
        tip: 'ETAs update automatically every time a token is called, skipped, or completed.',
      },
      {
        title: 'AI Smart Triage',
        description: 'Enter a chief complaint and click "AI Triage" — the AI classifies urgency as GENERAL, PRIORITY, or EMERGENCY using GPT-4o-mini. It also suggests the right doctor specialty and lists extracted symptoms with a confidence score.',
        tip: 'Falls back to keyword matching when OPENAI_API_KEY is not configured.',
      },
      {
        title: 'AI SOAP Notes',
        description: 'Converts raw doctor dictation into structured SOAP notes (Subjective, Objective, Assessment, Plan). Helps maintain clinical documentation standards and makes notes reusable for insurance and referrals.',
      },
      {
        title: 'AI Patient Pre-Brief',
        description: 'Auto-generated before each consultation. Pulls from 6 months of records to give the doctor: clinical summary, known conditions, last diagnosis, medications, and alert flags — in under 5 seconds.',
        tip: 'The brief updates each time a new patient enters consultation — no manual refresh needed.',
      },
      {
        title: 'No-Show Risk Predictor',
        description: 'Scores each waiting patient\'s likelihood of not showing up based on: their personal no-show history, time of day (late afternoon is riskier), and day of week (Friday has higher rates). Red = High Risk, Amber = Medium Risk.',
        tip: 'Use this to proactively call high-risk patients or move them earlier in the queue.',
      },
      {
        title: 'Queue Workload Balancer',
        description: 'Monitors queue sizes across all doctors in real time. When one doctor has 4+ more patients than another, an alert banner recommends routing the next walk-in to the less-busy doctor — one click to apply.',
      },
      {
        title: 'Follow-up Message Generator',
        description: 'Translates your clinical consultation notes into a warm, patient-friendly WhatsApp message. Includes medication reminders, care instructions, and follow-up appointment date in simple language.',
      },
      {
        title: 'Symptom Outbreak Detector',
        description: 'Found in the Analytics dashboard. Scans all of today\'s chief complaints and groups them into symptom clusters (Fever/Flu, Respiratory, GI, Eye, Skin). Shows a public health alert when one cluster exceeds 40% of today\'s visits.',
        tip: 'Useful for early detection of seasonal outbreaks or common illness clusters.',
      },
      {
        title: 'NLP Analytics Copilot',
        description: 'Ask any question in plain English: "Why is Tuesday so busy?", "Who is my slowest doctor?", "What\'s my average wait time trend?" — and get a 2-3 paragraph AI-generated operational analysis with actionable suggestions.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reports',
    icon: BarChart2,
    color: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700',
    steps: [
      {
        title: 'Today\'s KPI Strip',
        description: 'The top stats row shows live counts: Total Registered, In Queue, Served, and No-Shows — all scoped to today. These update automatically via the live WebSocket connection.',
      },
      {
        title: '7-Day Patient Volume',
        description: 'A bar chart showing how many patients visited each day over the past week. Use this to identify your busiest and quietest days for staffing decisions.',
        tip: 'Data is pulled fresh from the database each time you load analytics.',
      },
      {
        title: 'Wait Time Trend',
        description: 'An area chart of average patient wait time per day over the past 7 days. Spikes indicate days where the queue backed up — often correlating with no-shows or unexpected walk-in surges.',
      },
      {
        title: 'Peak Hours Heatmap',
        description: 'A color-coded grid (Hour × Day of Week) showing your clinic\'s busiest windows over the past 30 days. Darker cells = higher patient volume. Use this to plan optimal doctor schedules.',
        tip: 'Most clinics see a peak at 10 AM–12 PM and a secondary peak at 4 PM–6 PM.',
      },
      {
        title: 'Doctor Performance Table',
        description: 'Ranks all your doctors by: patients served this week, no-show rate, and average consultation time. Helps you identify high performers and doctors who may need support.',
      },
      {
        title: 'Revenue Analytics',
        description: 'Track daily, weekly, and monthly revenue from consultation fees. Set fees per token from the reception dashboard and monitor totals in real time.',
      },
      {
        title: 'Outbreak Detector Card',
        description: 'The AI Symptom Outbreak Detector panel scans today\'s complaints and shows pattern clusters with severity ratings. Refresh at any time with the refresh button.',
      },
      {
        title: 'CSV Export & Print Report',
        description: 'Click "Download CSV" to export your full visit history for external analysis. "Print Report" generates a formatted HTML report with today\'s stats and doctor performance table — print or save as PDF.',
        tip: 'CSV exports are useful for importing into Excel, Google Sheets, or your accounting software.',
      },
    ],
  },
  {
    id: 'display',
    title: 'Waiting Room TV',
    icon: Tv,
    color: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700',
    steps: [
      {
        title: 'Smart TV Display',
        description: 'Navigate to `/display/[clinicId]` on a TV or large screen in your waiting room. It shows the current "Now Serving" token and "Up Next" tokens for each doctor in real time.',
        tip: 'Use the clinic ID from your settings. The display updates automatically — no manual refresh needed.',
      },
      {
        title: 'Audio Announcements',
        description: 'When a patient\'s token is called, the display plays a chime sound and uses the browser\'s Text-to-Speech to announce: "Token [number] please proceed to [Doctor Name]."',
        tip: 'Make sure the TV or display device has sound turned on and browser autoplay allowed.',
      },
      {
        title: 'Doctor Break Status',
        description: 'When a doctor goes on break, their card on the TV display shows a "On Break — Returns at [time]" badge so patients know to wait.',
      },
      {
        title: 'Scrolling Announcements',
        description: 'The bottom of the display has a scrolling ticker for clinic announcements (e.g. holiday notices, health tips, doctor schedules). Configure these from the Settings page.',
      },
    ],
  },
  {
    id: 'patient',
    title: 'Patient Features',
    icon: Smartphone,
    color: 'text-sky-600',
    badge: 'bg-sky-50 text-sky-700',
    steps: [
      {
        title: 'Real-Time Queue Tracker',
        description: 'When a token is issued, the patient receives an SMS with a link to `/queue/[tokenId]`. This page shows their position in the queue, estimated wait time, and updates live — no app install needed.',
        tip: 'The tracker also shows if the doctor is on break and the estimated return time.',
      },
      {
        title: 'Online Appointment Booking',
        description: 'Share your clinic\'s booking link `/book/[clinicId]` with patients. They can browse available time slots for any doctor and book an appointment directly — no account required.',
        tip: 'Booked appointments appear in the reception\'s Appointments tab and the doctor\'s schedule.',
      },
      {
        title: 'Online Waitlist Pre-Registration',
        description: 'Share `/waitlist/[clinicId]` for patients who want to join tomorrow\'s queue in advance. They fill in their details and chief complaint the night before — reception converts them to tokens on arrival.',
      },
      {
        title: 'Patient Medical Portal',
        description: 'Patients access their medical records at `/patient/portal` by entering their phone number. They can see past consultations, prescriptions with notes, upcoming appointments, and print prescription slips.',
        tip: 'Prescriptions can be downloaded as PDFs directly from the portal.',
      },
      {
        title: 'Consultation Rating',
        description: 'After each visit, patients can rate their consultation (1–5 stars) through the portal. Ratings are tracked in analytics and help you monitor doctor performance and patient satisfaction.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Admin',
    icon: Settings,
    color: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-700',
    steps: [
      {
        title: 'Clinic Profile',
        description: 'Update your clinic name, address, phone number, and specialities from the Settings page. Changes take effect immediately across all patient-facing pages.',
      },
      {
        title: 'Doctor Schedules',
        description: 'Click "Manage Schedule" next to any doctor in reception to configure their working days, start/end times, slot duration, and maximum patients per day.',
        tip: 'Slot duration affects appointment booking intervals. A 15-minute slot allows 4 appointments per hour.',
      },
      {
        title: 'Clinic Holidays',
        description: 'Mark specific dates as clinic holidays to block appointment bookings and show a closure notice on patient-facing pages.',
      },
      {
        title: 'Doctor Unavailability',
        description: 'Mark specific dates when individual doctors are unavailable (sick leave, conference, etc.) without blocking the entire clinic.',
      },
      {
        title: 'Subscription Plans',
        description: 'CureQ has 4 tiers: Free (1 doctor, 50 tokens/day), Starter (3 doctors, 200 tokens, SMS), Pro (unlimited, WhatsApp + AI Copilot + Smart TV), Chain (multi-branch). Upgrade from the settings panel.',
      },
      {
        title: 'Audit Logs',
        description: 'Every action taken by staff (token creation, queue reordering, fee updates, doctor schedule changes) is logged with user identity and timestamp for compliance and accountability.',
      },
    ],
  },
];

export default function UserGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState('overview');
  const [activeStep, setActiveStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('guide_completed') || '[]'));
    } catch { return new Set(); }
  });

  const activeChapter = CHAPTERS.find(c => c.id === activeChapterId) || CHAPTERS[0];
  const currentStep = activeChapter.steps[activeStep];
  const stepKey = `${activeChapterId}-${activeStep}`;

  // Search across all chapters/steps
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    const results: { chapterId: string; chapterTitle: string; stepIndex: number; step: GuideStep }[] = [];
    CHAPTERS.forEach(ch => {
      ch.steps.forEach((step, i) => {
        if (step.title.toLowerCase().includes(q) || step.description.toLowerCase().includes(q)) {
          results.push({ chapterId: ch.id, chapterTitle: ch.title, stepIndex: i, step });
        }
      });
    });
    return results.slice(0, 8);
  }, [searchQuery]);

  const markComplete = () => {
    const newSet = new Set(completedSteps);
    newSet.add(stepKey);
    setCompletedSteps(newSet);
    localStorage.setItem('guide_completed', JSON.stringify([...newSet]));
  };

  const goNext = () => {
    markComplete();
    if (activeStep < activeChapter.steps.length - 1) {
      setActiveStep(s => s + 1);
    } else {
      const idx = CHAPTERS.findIndex(c => c.id === activeChapterId);
      if (idx < CHAPTERS.length - 1) {
        setActiveChapterId(CHAPTERS[idx + 1].id);
        setActiveStep(0);
      }
    }
  };

  const goPrev = () => {
    if (activeStep > 0) {
      setActiveStep(s => s - 1);
    } else {
      const idx = CHAPTERS.findIndex(c => c.id === activeChapterId);
      if (idx > 0) {
        const prevChapter = CHAPTERS[idx - 1];
        setActiveChapterId(prevChapter.id);
        setActiveStep(prevChapter.steps.length - 1);
      }
    }
  };

  const selectChapter = (id: string) => {
    setActiveChapterId(id);
    setActiveStep(0);
    setSearchQuery('');
  };

  const totalSteps = CHAPTERS.reduce((acc, c) => acc + c.steps.length, 0);
  const completedCount = completedSteps.size;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  const Icon = activeChapter.icon;

  // Keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, activeStep, activeChapterId]);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-[#01696f] text-white shadow-xl hover:bg-[#005459] hover:shadow-2xl transition-all duration-200 flex items-center justify-center group"
        title="Open User Guide"
        aria-label="Open User Guide"
      >
        <HelpCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
        {completedCount < totalSteps && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 border-2 border-white text-[8px] font-bold text-white flex items-center justify-center">
            ?
          </span>
        )}
      </button>

      {/* Guide Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa] flex-shrink-0">
              <div className="p-2 bg-[#e6f3f4] rounded-xl">
                <BookOpen className="h-5 w-5 text-[#01696f]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-[#1a202c]">CureQ User Guide</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 max-w-[120px] bg-[#e9e9e7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#01696f] rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#64748b] font-medium">{completedCount}/{totalSteps} steps done</span>
                </div>
              </div>
              {/* Search */}
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748b]" />
                <input
                  type="text"
                  placeholder="Search topics…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs border border-[#e9e9e7] rounded-xl bg-white outline-none focus:border-[#01696f] w-48"
                />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#f4f4f3] text-[#64748b] hover:text-[#1a202c] transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Results Overlay */}
            {searchResults.length > 0 && (
              <div className="absolute top-16 right-6 w-80 bg-white border border-[#e9e9e7] rounded-xl shadow-xl z-10 overflow-hidden">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { selectChapter(r.chapterId); setActiveStep(r.stepIndex); setSearchQuery(''); }}
                    className="w-full px-4 py-3 text-left hover:bg-[#fbfbfa] border-b border-[#e9e9e7] last:border-0 transition-colors"
                  >
                    <p className="text-[10px] font-bold text-[#64748b] uppercase mb-0.5">{r.chapterTitle}</p>
                    <p className="text-xs font-semibold text-[#1a202c]">{r.step.title}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-52 flex-shrink-0 border-r border-[#e9e9e7] bg-[#fbfbfa] overflow-y-auto hidden sm:block">
                {CHAPTERS.map((ch) => {
                  const ChIcon = ch.icon;
                  const chCompleted = ch.steps.filter((_, i) => completedSteps.has(`${ch.id}-${i}`)).length;
                  const isActive = activeChapterId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => selectChapter(ch.id)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors border-b border-[#e9e9e7]/60 ${
                        isActive ? 'bg-[#e6f3f4] border-l-2 border-l-[#01696f]' : 'hover:bg-white'
                      }`}
                    >
                      <ChIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${isActive ? 'text-[#01696f]' : 'text-[#64748b]'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isActive ? 'text-[#01696f]' : 'text-[#1a202c]'}`}>{ch.title}</p>
                        <p className="text-[10px] text-[#64748b] mt-0.5">{chCompleted}/{ch.steps.length} done</p>
                      </div>
                      {chCompleted === ch.steps.length && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Main content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Chapter header */}
                <div className="px-6 pt-5 pb-4 border-b border-[#e9e9e7]/60 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${activeChapter.badge}`}>
                      {activeChapter.title}
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      Step {activeStep + 1} of {activeChapter.steps.length}
                    </span>
                  </div>

                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {activeChapter.steps.map((_, i) => {
                      const done = completedSteps.has(`${activeChapterId}-${i}`);
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveStep(i)}
                          className={`transition-all duration-200 rounded-full ${
                            i === activeStep
                              ? 'w-6 h-2 bg-[#01696f]'
                              : done
                              ? 'w-2 h-2 bg-emerald-400'
                              : 'w-2 h-2 bg-[#e9e9e7] hover:bg-[#d0d0ce]'
                          }`}
                          title={activeChapter.steps[i].title}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[#e6f3f4] flex items-center justify-center flex-shrink-0">
                      <Icon className={`h-5 w-5 ${activeChapter.color}`} />
                    </div>
                    <h3 className="text-xl font-bold text-[#1a202c] leading-tight">{currentStep.title}</h3>
                  </div>

                  <p className="text-sm text-[#64748b] leading-relaxed mb-5">{currentStep.description}</p>

                  {currentStep.tip && (
                    <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <Zap className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <span className="font-bold">Pro tip: </span>{currentStep.tip}
                      </p>
                    </div>
                  )}
                </div>

                {/* Navigation footer */}
                <div className="px-6 py-4 border-t border-[#e9e9e7] bg-[#fbfbfa] flex items-center justify-between flex-shrink-0">
                  <button
                    onClick={goPrev}
                    disabled={activeChapterId === CHAPTERS[0].id && activeStep === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#64748b] rounded-xl hover:bg-[#e9e9e7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>

                  <div className="flex items-center gap-2">
                    {completedSteps.has(stepKey) && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                    <button
                      onClick={goNext}
                      className="flex items-center gap-1.5 px-5 py-2 bg-[#01696f] text-white text-xs font-bold rounded-xl hover:bg-[#005459] transition-colors shadow-sm"
                    >
                      {activeChapterId === CHAPTERS[CHAPTERS.length - 1].id && activeStep === activeChapter.steps.length - 1
                        ? 'Finish'
                        : 'Next'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
