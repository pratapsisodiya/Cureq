'use client';

import React, { use, useState, useEffect } from 'react';
import { apiRequest, BACKEND_URL } from '../../../src/utils/api';
import io from 'socket.io-client';
import { 
  Activity, Clock, Users, ArrowRightLeft, FileText,
  MapPin, CheckCircle, Bell, ArrowRight, Printer, Share2, Copy, Check
} from 'lucide-react';

interface TrackerParams {
  tokenId: string;
}

export default function PatientQueueTracker({ params }: { params: Promise<TrackerParams> }) {
  const resolvedParams = use(params);
  const tokenId = resolvedParams.tokenId;

  const [tokenData, setTokenData] = useState<any>(null);
  const [patientsAhead, setPatientsAhead] = useState(0);
  const [currentlyServing, setCurrentlyServing] = useState('None');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Virtual check-in states
  const [isOnWay, setIsOnWay] = useState(false);
  const [onWayComplaint, setOnWayComplaint] = useState('');
  const [showOnWayModal, setShowOnWayModal] = useState(false);

  // Rating states
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // History states
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // 1. Fetch token status and details
  const fetchTokenStatus = async () => {
    try {
      const res = await apiRequest(`/queues/token/${tokenId}`);
      setTokenData(res.token);
      setPatientsAhead(res.patientsAhead);
      setCurrentlyServing(res.currentlyServingToken);
      
      // Fetch visit history if patient account is linked
      if (res.token.patientId) {
        const histRes = await apiRequest(`/patients/id/${res.token.patientId}/history`);
        setHistoryLogs(histRes.history || []);
      }
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load token.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenStatus();
  }, [tokenId]);

  // 2. WebSocket listener to sync status updates live
  useEffect(() => {
    if (!tokenId) return;
    
    const socket = io(BACKEND_URL);
    
    socket.on('connect', () => {
      socket.emit('join:token', tokenId);
    });

    socket.on('token:updated', (data: { status: string; estimatedWait: number; patientsAhead: number; tokenNo?: string }) => {
      setTokenData((prev: any) => {
        if (!prev) return null;
        if (data.status === 'IN_CONSULTATION') {
          setCurrentlyServing(prev.tokenNo || 'Serving');
        }
        return { ...prev, status: data.status, estimatedWait: data.estimatedWait };
      });
      setPatientsAhead(data.patientsAhead ?? 0);
    });

    socket.on('broadcast:alert', (data: { message: string }) => {
      setBroadcastMessage(data.message);
      // Auto-hide alert after 15 seconds
      setTimeout(() => setBroadcastMessage(''), 15000);
    });

    // Also join branch room to track currently serving token changes
    const queueUpdatedHandler = (data: any) => {
      const activeConsult = data.queue?.find((t: any) => t.status === 'IN_CONSULTATION');
      setCurrentlyServing(activeConsult ? activeConsult.tokenNo : 'None');
    };

    if (tokenData?.branchId) {
      socket.emit('join:branch', tokenData.branchId);
      socket.on('queue:updated', queueUpdatedHandler);
    }

    return () => {
      socket.off('queue:updated', queueUpdatedHandler);
      socket.disconnect();
    };
  }, [tokenId, tokenData?.branchId]);

  // 3. Submit rating after consultation
  const handleSubmitRating = async () => {
    if (rating === 0) return;
    setIsSubmittingRating(true);
    try {
      await apiRequest(`/features/tokens/${tokenId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, ratingComment }),
      });
      setRatingSubmitted(true);
    } catch { /* ignore */ } finally {
      setIsSubmittingRating(false);
    }
  };

  // 4. Trigger "On My Way" virtual check-in
  const handleVirtualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/queues/token/${tokenId}/on-my-way`, {
        method: 'POST',
        body: JSON.stringify({ complaint: onWayComplaint }),
      });
      setIsOnWay(true);
      setShowOnWayModal(false);
      fetchTokenStatus();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1516] flex items-center justify-center text-xs text-gray-400 font-light">
        Syncing with CureQ engine...
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen bg-[#0d1516] flex items-center justify-center p-4">
        <div className="text-center p-6 bg-[#111e20] border border-[#1c2e31] rounded-[6px] max-w-sm">
          <h2 className="font-serif text-lg font-bold text-red-400">Token Not Found</h2>
          <p className="text-xs text-gray-400 mt-2 font-light">
            This token does not exist or has expired. Make sure you scanned the correct QR code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1516] text-gray-100 flex flex-col items-center p-4 md:p-8 font-sans">
      
      {/* Broadcast alert marquee */}
      {broadcastMessage && (
        <div className="w-full max-w-md bg-amber-950/20 border border-amber-900/50 p-3 rounded-[4px] mb-6 flex items-start gap-2.5 text-xs text-amber-400">
          <Bell className="h-4 w-4 shrink-0 mt-0.5" />
          <p><strong>Clinic Alert:</strong> {broadcastMessage}</p>
        </div>
      )}

      {/* Main tracker card (Mobile viewport optimized) */}
      <div className="w-full max-w-md bg-[#111e20] border border-[#1c2e31] rounded-[6px] p-6 space-y-6 shadow-sm">
        
        {/* Clinic & Doctor header */}
        <div className="text-center border-b border-[#1c2e31] pb-4">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#01696f]">
            {tokenData.branch.clinic.name}
          </h1>
          <span className="text-[10px] text-gray-400 font-medium block uppercase tracking-wider mt-0.5">
            {tokenData.branch.name}
          </span>
          <p className="text-xs mt-3 font-semibold text-gray-300">
            Consulting: {tokenData.doctor.user.name} · {tokenData.doctor.speciality}
          </p>
          {tokenData.branch?.address && (
            <p className="text-[10px] text-gray-500 mt-1 font-light">{tokenData.branch.address}</p>
          )}
        </div>

        {/* Doctor Delay Warning Alert */}
        {tokenData.status === 'WAITING' && tokenData.doctor && tokenData.doctor.delayBuffer > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-[4px] space-y-1 text-xs text-amber-400 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="font-bold flex items-center gap-1.5">
              <span className="animate-pulse h-2 w-2 rounded-full bg-amber-500"></span>
              ⚠️ Doctor Delay Notice
            </div>
            <p className="font-light leading-relaxed">
              Dr. {tokenData.doctor.user?.name || tokenData.doctorName} is running approximately {tokenData.doctor.delayBuffer} minutes behind schedule. Your estimated wait time has been automatically adjusted.
            </p>
          </div>
        )}

        {/* Patient Journey Timeline */}
        {tokenData.status !== 'SKIPPED' && tokenData.status !== 'NO_SHOW' && (
          <div className="space-y-2">
            <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest text-center">Your Visit Journey</p>
            <div className="flex items-center justify-between">
              {[
                { label: 'Registered', done: true, active: false },
                { label: 'Seated', done: tokenData.seatStatus === 'SEATED' || tokenData.status === 'IN_CONSULTATION' || tokenData.status === 'SERVED', active: tokenData.status === 'WAITING' && tokenData.seatStatus !== 'SEATED' },
                { label: 'Consulting', done: tokenData.status === 'IN_CONSULTATION' || tokenData.status === 'SERVED', active: tokenData.status === 'IN_CONSULTATION' },
                { label: 'Complete', done: tokenData.status === 'SERVED', active: false },
              ].map((step, i, arr) => (
                <React.Fragment key={step.label}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all ${
                      step.done
                        ? 'bg-[#01696f] border-[#01696f] text-white'
                        : step.active
                          ? 'bg-[#01696f]/10 border-[#01696f] text-[#01696f] animate-pulse'
                          : 'bg-[#0d1516] border-[#1c2e31] text-gray-600'
                    }`}>
                      {step.done
                        ? <CheckCircle className="h-3.5 w-3.5" />
                        : <span className="text-[9px] font-bold">{i + 1}</span>}
                    </div>
                    <span className={`text-[9px] font-semibold ${step.done ? 'text-[#01696f]' : step.active ? 'text-gray-300' : 'text-gray-600'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all duration-700 ${step.done ? 'bg-[#01696f]' : 'bg-[#1c2e31]'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Live Token Status Box */}
        <div className="bg-[#0d1516] border border-[#1c2e31] p-6 rounded-[6px] text-center">
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest block">Your Token Number</span>
          <span className="text-5xl font-mono font-bold tracking-tighter text-[#01696f] my-3 block">
            {tokenData.tokenNo}
          </span>
          <span className={`px-2 py-0.5 rounded-[2px] text-[10px] border border-[#1c2e31] inline-block uppercase font-semibold ${
            tokenData.status === 'WAITING' 
              ? 'bg-amber-950/20 text-amber-400 border-amber-900/50' 
              : tokenData.status === 'IN_CONSULTATION'
                ? 'bg-[#01696f]/20 text-[#01696f] border-[#01696f] animate-pulse'
                : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50'
          }`}>
            {tokenData.status.replace('_', ' ')}
          </span>
        </div>

        {/* Dynamic waiting metrics grid */}
        <div className="grid grid-cols-3 gap-3 text-center border-t border-b border-[#1c2e31] py-4">
          <div>
            <div className="flex justify-center text-gray-400 mb-1"><Clock className="h-4 w-4" /></div>
            <span className="text-[9px] text-gray-400 font-semibold uppercase block">Est. Wait</span>
            <span className="text-sm font-bold text-[#01696f] mt-0.5 block">
              {tokenData.status === 'IN_CONSULTATION' ? 'Your Turn' : tokenData.status === 'SERVED' ? 'Complete' : `~${tokenData.estimatedWait} mins`}
            </span>
          </div>
          <div>
            <div className="flex justify-center text-gray-400 mb-1"><Users className="h-4 w-4" /></div>
            <span className="text-[9px] text-gray-400 font-semibold uppercase block">Ahead of you</span>
            <span className="text-sm font-bold mt-0.5 block">
              {tokenData.status === 'WAITING' ? `${patientsAhead} Patients` : '0'}
            </span>
          </div>
          <div>
            <div className="flex justify-center text-gray-400 mb-1"><ArrowRightLeft className="h-4 w-4" /></div>
            <span className="text-[9px] text-gray-400 font-semibold uppercase block">Serving</span>
            <span className="text-sm font-bold mt-0.5 block font-mono text-emerald-400">
              {currentlyServing}
            </span>
          </div>
        </div>

        {/* Nudge Counter Banner */}
        {tokenData.nudgeCount > 0 && tokenData.status === 'WAITING' && (
          <div className="bg-amber-950/30 border border-amber-800/60 p-3 rounded-[4px] flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400 shrink-0 animate-bounce" />
              <span>Nudge Reminder ({tokenData.nudgeCount}/3 Strikes) — Please be near the waiting room!</span>
            </div>
          </div>
        )}

        {/* Share Live Queue Link via WhatsApp */}
        <div className="bg-[#0d1516] p-3 rounded-[4px] border border-[#1c2e31] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-300 overflow-hidden">
            <Share2 className="h-4 w-4 text-[#01696f] shrink-0" />
            <span className="truncate text-[11px]">Share live tracking link</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
              }}
              className="px-2.5 py-1 bg-[#1c2e31] hover:bg-[#253d41] text-gray-200 text-[10px] font-semibold rounded flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`📍 Tracking my queue status live (Token ${tokenData.tokenNo}): ${typeof window !== 'undefined' ? window.location.href : ''}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded flex items-center gap-1 transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>

        {/* Visual Queue Progress Bar */}
        {tokenData.status === 'WAITING' && patientsAhead <= 10 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] text-gray-400 font-medium">
              <span>Queue Position</span>
              <span>#{patientsAhead + 1} in line</span>
            </div>
            <div className="h-2 bg-[#1c2e31] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: patientsAhead === 0 ? '100%' : `${Math.max(5, 100 - (patientsAhead / 10) * 100)}%`,
                  backgroundColor: patientsAhead === 0 ? '#01696f' : patientsAhead <= 2 ? '#f59e0b' : '#64748b',
                }}
              />
            </div>
            {patientsAhead <= 2 && patientsAhead > 0 && (
              <p className="text-[10px] text-amber-400 font-semibold text-center animate-pulse">
                Almost your turn! Please be ready near the chamber.
              </p>
            )}
          </div>
        )}

        {/* Called to chamber alert */}
        {tokenData.status === 'IN_CONSULTATION' && (
          <div className="bg-[#01696f]/20 border-2 border-[#01696f] p-4 rounded-[6px] text-center animate-pulse">
            <p className="text-[#01696f] font-bold text-base">It's Your Turn!</p>
            <p className="text-xs text-gray-300 mt-1 font-light">Please proceed to Dr. {tokenData.doctor.user.name}'s chamber now.</p>
          </div>
        )}

        {/* "On my way" virtual check-in button */}
        {tokenData.status === 'WAITING' && (
          <div>
            {isOnWay || tokenData.chiefComplaint?.includes('VIRTUAL CHECK-IN') ? (
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-[4px] flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <p>Virtual check-in active. Reception notified that you are on your way.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowOnWayModal(true)}
                className="w-full py-2.5 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-semibold rounded-[4px] flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <MapPin className="h-4 w-4" /> I'm On My Way (Virtual Queue)
              </button>
            )}
          </div>
        )}
        {/* Served state with rating */}
        {tokenData.status === 'SERVED' && (
          <div className="bg-emerald-950/20 border border-emerald-900/50 p-5 rounded-[6px] space-y-4">
            <div className="text-center">
              <p className="text-emerald-400 font-semibold text-sm">Consultation Complete</p>
              <p className="text-xs text-gray-400 mt-1 font-light">Thank you for visiting. See you again!</p>
            </div>
            {!ratingSubmitted ? (
              <div className="border-t border-[#1c2e31] pt-4 space-y-3">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center">Rate your experience</p>
                <div className="flex justify-center gap-3">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setRating(star)}
                      className={`text-2xl transition-transform hover:scale-110 cursor-pointer ${rating >= star ? 'text-amber-400' : 'text-gray-600'}`}>
                      ★
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <textarea
                    placeholder="Optional comment..."
                    rows={2}
                    className="w-full px-3 py-2 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100 resize-none"
                    value={ratingComment}
                    onChange={e => setRatingComment(e.target.value)}
                  />
                )}
                {rating > 0 && (
                  <button onClick={handleSubmitRating} disabled={isSubmittingRating}
                    className="w-full py-2 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-semibold rounded-[4px] cursor-pointer disabled:opacity-50">
                    {isSubmittingRating ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-emerald-400 font-semibold border-t border-[#1c2e31] pt-3">
                ✓ Thank you for your feedback!
              </p>
            )}
          </div>
        )}
        {tokenData.status === 'SKIPPED' && (
          <div className="bg-amber-950/20 border border-amber-900/50 p-4 rounded-[6px] text-center">
            <p className="text-amber-400 font-semibold text-sm">Token Skipped</p>
            <p className="text-xs text-gray-400 mt-1 font-light">Please check with reception to get a new token.</p>
          </div>
        )}
      </div>

      {/* Patient History panel */}
      {historyLogs.length > 0 && (
        <div className="w-full max-w-md mt-8 bg-[#111e20] border border-[#1c2e31] rounded-[6px] p-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
            <FileText className="h-4 w-4" /> Your Consult History (Read-only)
          </h3>
          <div className="space-y-4 pr-1 max-h-60 overflow-y-auto divide-y divide-[#1c2e31]">
            {historyLogs.map((log, idx) => (
              <div key={log.id} className={`pt-3 ${idx === 0 ? '' : 'mt-4'}`}>
                <div className="flex justify-between items-center text-[10px] text-gray-400 mb-1">
                  <span>{new Date(log.date).toLocaleDateString()}</span>
                  <strong>Dr. {log.doctorName}</strong>
                </div>
                <p className="text-xs font-light text-gray-300 whitespace-pre-wrap mt-2 p-2 bg-[#0d1516] rounded border border-[#1c2e31]">
                  {log.notes}
                </p>
                <div className="flex justify-between items-center mt-3">
                  {log.followUpDate && (
                    <span className="text-[9px] text-[#01696f] block">
                      Follow-up: Return in {log.followUpDate}
                    </span>
                  )}
                  <button 
                    onClick={() => {
                      // Simple client-side print trigger
                      const printContents = `
                        <div style="font-family: sans-serif; padding: 40px; color: black;">
                          <h1 style="color: #01696f; border-bottom: 2px solid #e9e9e7; padding-bottom: 10px;">CureQ Digital Prescription</h1>
                          <p><strong>Date:</strong> ${new Date(log.date).toLocaleDateString()}</p>
                          <p><strong>Doctor:</strong> Dr. ${log.doctorName} (${log.specialty})</p>
                          <p><strong>Patient Token:</strong> ${log.tokenNo}</p>
                          <hr style="margin: 20px 0;" />
                          <h3>Chief Complaint</h3>
                          <p>${log.chiefComplaint || 'None recorded'}</p>
                          <h3>Consultation Notes & Prescription</h3>
                          <p style="white-space: pre-wrap;">${log.notes}</p>
                          <hr style="margin: 40px 0 20px 0;" />
                          <p style="font-size: 10px; color: gray; text-align: center;">Generated securely via CureQ Queue Engine</p>
                        </div>
                      `;
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write('<html><head><title>Prescription</title></head><body>');
                        printWindow.document.write(printContents);
                        printWindow.document.write('</body></html>');
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 250);
                      }
                    }}
                    className="text-[10px] text-white bg-[#01696f] px-2 py-1 rounded-[2px] flex items-center gap-1 cursor-pointer hover:bg-[#005459]"
                  >
                    <Printer className="h-3 w-3" /> Download PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Virtual check-in popup modal */}
      {showOnWayModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] w-full max-w-sm space-y-4 relative">
            <h3 className="font-serif text-lg font-bold">Virtual Check-In</h3>
            <p className="text-xs text-gray-400 font-light">
              Checking in confirms that you have left home and are on your way. Enter any quick update or complaint for the receptionist:
            </p>
            <form onSubmit={handleVirtualCheckIn} className="space-y-4">
              <input
                type="text"
                placeholder="e.g. Stuck in traffic, arriving in 15 mins"
                className="w-full px-3 py-2 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                value={onWayComplaint}
                onChange={(e) => setOnWayComplaint(e.target.value)}
              />
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowOnWayModal(false)}
                  className="px-4 py-2 border border-[#1c2e31] text-xs font-semibold rounded-[4px] cursor-pointer hover:bg-[#0d1516] text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#01696f] text-white text-xs font-semibold rounded-[4px] hover:bg-[#005459] cursor-pointer"
                >
                  Confirm Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share token link */}
      <div className="mt-8 flex flex-col items-center gap-2">
        <button
          onClick={() => {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            });
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-[#01696f] border-[#e9e9e7] hover:border-[#01696f] hover:bg-[#f0fafb]'
          }`}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" /> Link Copied!</>
          ) : (
            <><Share2 className="h-3.5 w-3.5" /> Share Token Link</>
          )}
        </button>
        <p className="text-[9px] text-gray-400">Share this page link to let family track your queue position</p>
      </div>

      <footer className="text-[10px] text-gray-400 mt-6 text-center">
        Powered by CureQ Queue Management Engine.
      </footer>
    </div>
  );
}
