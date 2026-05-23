'use client';

import React, { use, useState, useEffect } from 'react';
import { apiRequest, BACKEND_URL } from '../../../src/utils/api';
import io from 'socket.io-client';
import { Tv, Activity, Clock, Volume2, Calendar } from 'lucide-react';

interface DisplayParams {
  clinicId: string;
}

export default function TVDisplayScreen({ params }: { params: Promise<DisplayParams> }) {
  const resolvedParams = use(params);
  const clinicId = resolvedParams.clinicId;

  const [clinicData, setClinicData] = useState<any>(null);
  const [branchId, setBranchId] = useState('');
  const [activeQueue, setActiveQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Announcement ticker
  const [tickerIndex, setTickerIndex] = useState(0);
  const announcements = [
    'Welcome to CureQ Smart Waiting Rooms. Your estimated wait times are calculated dynamically.',
    'Please maintain social distancing and wear a mask if you have cough or cold symptoms.',
    'For fast check-in, scan the QR code at the reception desk to track your status on your phone.',
    'Follow us on WhatsApp for follow-up reminders and digital consultation slips.'
  ];

  // Visual called chime overlay
  const [calledAlert, setCalledAlert] = useState<{ tokenNo: string; doctorName: string } | null>(null);

  // 1. Fetch clinic details & initialize queue
  useEffect(() => {
    async function loadTVDetails() {
      try {
        const res = await apiRequest(`/clinics/${clinicId}`);
        setClinicData(res.clinic);
        
        const firstBranch = res.clinic.branches[0];
        if (firstBranch) {
          setBranchId(firstBranch.id);
          
          // Rebuild active tokens for all doctors at this branch
          const activeList: any[] = [];
          for (const sched of firstBranch.schedules) {
            const queueData = await apiRequest(`/queues/${firstBranch.id}/live?doctorId={sched.doctor.id}`);
            activeList.push(...(queueData.active || []));
          }
          setActiveQueue(activeList);
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    loadTVDetails();
  }, [clinicId]);

  // 2. WebSocket listener for live TV updates
  useEffect(() => {
    if (!branchId) return;

    const socket = io(BACKEND_URL);

    socket.on('connect', () => {
      socket.emit('join:branch', branchId);
    });

    // When anyone updates in this branch, rebuild the active lists
    socket.on('queue:updated', async () => {
      if (!clinicData) return;
      try {
        const activeList: any[] = [];
        for (const sched of clinicData.branches[0].schedules) {
          const queueData = await apiRequest(`/queues/${branchId}/live?doctorId=${sched.doctor.id}`);
          activeList.push(...(queueData.active || []));
        }
        setActiveQueue(activeList);
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('token:called', (data: { tokenNo: string; doctorName: string }) => {
      setCalledAlert(data);
      
      // Chime synthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Attention please. Token number ${data.tokenNo.replace('-', ' ')}, please proceed to Doctor ${data.doctorName}'s chamber.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }

      // Play a custom audio beep synthesized via Web Audio API
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (e) {
        console.warn('Audio Context beep failed to play.');
      }

      // Reset alert popup after 6 seconds
      setTimeout(() => setCalledAlert(null), 6000);
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId, clinicData]);

  // Rotate announcement ticker every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % announcements.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-mono text-sm">
        Connecting waiting room monitor to CureQ server...
      </div>
    );
  }

  // Filter queue tokens
  const servingTokens = activeQueue.filter(t => t.status === 'IN_CONSULTATION');
  const waitingTokens = activeQueue.filter(t => t.status === 'WAITING').slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* TV Header / Clinic Branding */}
      <header className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tv className="h-8 w-8 text-[#01696f]" />
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#01696f]">
              {clinicData?.name || 'CureQ Waiting Room'}
            </h1>
            <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">
              {clinicData?.branches[0]?.name || 'Main Chamber'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <Calendar className="h-5 w-5" />
          <span className="text-lg font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </header>

      {/* Main Grid: Split Widescreen Panel */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 p-8 gap-8 items-stretch">
        
        {/* Left Side (2/3 width): Serving Chambers */}
        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase text-slate-400 tracking-widest mb-6">
              Now Serving / Chamber Status
            </h2>
            
            {servingTokens.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-slate-500 font-light">
                <Activity className="h-12 w-12 opacity-20 mb-4 text-[#01696f]" />
                <p className="text-lg">No active consultations in progress.</p>
                <p className="text-xs mt-1 text-slate-600">Doctors will call the next patient shortly.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {servingTokens.map((token: any) => (
                  <div 
                    key={token.id} 
                    className="bg-slate-950 border border-slate-800 p-8 rounded-lg text-center flex flex-col justify-between space-y-4 animate-pulse"
                  >
                    <div>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Chamber Doctor</span>
                      <span className="text-lg font-bold text-slate-300 block mt-1">
                        {clinicData?.branches[0]?.schedules.find((s: any) => s.doctor.id === token.doctorId)?.doctor.user.name || 'Doctor'}
                      </span>
                    </div>

                    <div className="py-6 border-t border-b border-slate-800">
                      <span className="text-[10px] text-[#01696f] font-semibold tracking-widest block uppercase">Current Token</span>
                      <span className="text-6xl font-mono font-bold tracking-tighter text-[#01696f] mt-2 block">
                        {token.tokenNo}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 font-light block">{token.patientName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="text-[10px] text-slate-500 font-light flex items-center gap-1">
            <Volume2 className="h-3 w-3" /> Voice announcement triggers automatically. Keep monitor volume unmuted.
          </div>
        </section>

        {/* Right Side (1/3 width): Up Next Queue */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col">
          <h2 className="text-xs font-semibold uppercase text-slate-400 tracking-widest mb-6">
            Up Next (Waiting)
          </h2>

          <div className="flex-1 space-y-4">
            {waitingTokens.length === 0 ? (
              <p className="text-xs text-slate-500 font-light">Queue is empty.</p>
            ) : (
              waitingTokens.map((token: any, idx: number) => (
                <div 
                  key={token.id} 
                  className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-slate-500">#{idx + 1}</span>
                    <div>
                      <span className="text-2xl font-mono font-bold tracking-tighter text-slate-200">{token.tokenNo}</span>
                      <span className="block text-[10px] text-slate-500 font-light mt-0.5">{token.patientName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Est. Wait</span>
                    <span className="text-xs font-semibold text-emerald-500 mt-0.5 inline-block">
                      ~{token.estimatedWait} Mins
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Bottom sliding announcements ticker */}
      <footer className="bg-slate-900 border-t border-slate-800 px-8 py-4 flex items-center overflow-hidden">
        <div className="bg-[#01696f] text-white px-3 py-1 text-xs uppercase font-bold tracking-wider rounded mr-6 shrink-0 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Notice
        </div>
        <div className="flex-1 relative h-6 overflow-hidden">
          <p className="absolute inset-0 text-slate-300 text-sm font-light transition-all duration-700 ease-in-out">
            {announcements[tickerIndex]}
          </p>
        </div>
      </footer>

      {/* Called Alert TV overlay */}
      {calledAlert && (
        <div className="fixed inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-50 text-center animate-flash-chime">
          <div className="max-w-xl p-8 bg-slate-900 border-2 border-[#01696f] rounded-lg shadow-2xl space-y-6">
            <span className="text-xs text-[#01696f] font-bold uppercase tracking-widest block">TOKEN CALLED</span>
            
            <div className="py-8 border-t border-b border-slate-800">
              <span className="text-8xl font-mono font-bold tracking-tighter text-[#01696f] block">
                {calledAlert.tokenNo}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-light block">Please proceed to chamber of</span>
              <span className="text-2xl font-serif font-bold text-slate-200">
                Dr. {calledAlert.doctorName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
